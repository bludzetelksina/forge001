/**
 * Fetches pure-source private packages for Python and JavaScript runs, so they
 * can be shipped to the run sandbox alongside the project's own files.
 */

const MAX_PACKAGE_BYTES = 150_000;
const JS_EXT = /\.(c?m?js|json)$/;
const PY_EXT = /\.py$/;

type Pkg = { name: string; version: string | null };
type File = { path: string; content: string };

async function inflate(data: Uint8Array, format: "gzip" | "deflate-raw") {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function untar(buf: Uint8Array): Array<{ name: string; data: Uint8Array }> {
  const out: Array<{ name: string; data: Uint8Array }> = [];
  const dec = new TextDecoder();
  let off = 0;
  while (off + 512 <= buf.length) {
    const name = dec.decode(buf.subarray(off, off + 100)).replace(/\0.*$/s, "");
    if (!name) break;
    const size = parseInt(dec.decode(buf.subarray(off + 124, off + 136)).replace(/\0.*$/s, "").trim() || "0", 8);
    const type = String.fromCharCode(buf[off + 156] ?? 48);
    const prefix = dec.decode(buf.subarray(off + 345, off + 500)).replace(/\0.*$/s, "");
    if (type === "0" || type === "\0") {
      out.push({ name: prefix ? `${prefix}/${name}` : name, data: buf.subarray(off + 512, off + 512 + size) });
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}

async function unzip(buf: Uint8Array): Promise<Array<{ name: string; data: Uint8Array }>> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66_000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: Array<{ name: string; data: Uint8Array }> = [];
  for (let n = 0; n < count; n++) {
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const lNameLen = view.getUint16(local + 26, true);
    const lExtra = view.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtra;
    const raw = buf.subarray(start, start + csize);
    if (name.endsWith("/")) continue;
    out.push({ name, data: method === 8 ? await inflate(raw, "deflate-raw") : raw });
  }
  return out;
}

export async function prefetchPrivatePackages(input: {
  projectId: string;
  language: string;
  packages: Pkg[];
}): Promise<{ files: File[]; notes: string[] }> {
  const notes: string[] = [];
  const files: File[] = [];
  const lang = input.language;
  if (!["python", "javascript", "typescript"].includes(lang) || !input.packages.length) return { files, notes };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: reg } = await supabaseAdmin
    .from("project_registries")
    .select("registry_url, scope, token_ciphertext, kind")
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (!reg) return { files, notes };

  const wanted = input.packages.filter((p) => !reg.scope || p.name.startsWith(reg.scope));
  if (!wanted.length) return { files, notes };

  const headers = new Headers();
  if (reg.token_ciphertext) {
    const { decryptSecret } = await import("./connectionKeyCrypto.server");
    headers.set("Authorization", `Bearer ${decryptSecret(reg.token_ciphertext)}`);
  }
  const base = reg.registry_url.replace(/\/$/, "");
  const dec = new TextDecoder();

  for (const pkg of wanted) {
    try {
      if (lang === "python") {
        if (reg.kind !== "pypi") {
          notes.push(`[forge] ${pkg.name}: this project's registry is npm, so Python can't use it.`);
          continue;
        }
        const meta = (await (await fetch(`${base}/pypi/${pkg.name}/${pkg.version ? `${pkg.version}/` : ""}json`, { headers })).json()) as any;
        const wheel = ((meta?.urls ?? []) as any[]).find((u) => String(u.filename).endsWith("-none-any.whl"));
        if (!wheel) {
          notes.push(`[forge] ${pkg.name}: no pure-Python wheel found, skipped.`);
          continue;
        }
        const entries = await unzip(new Uint8Array(await (await fetch(wheel.url, { headers })).arrayBuffer()));
        const src = entries.filter((e) => PY_EXT.test(e.name) && !e.name.includes(".dist-info/"));
        const size = src.reduce((s, e) => s + e.data.length, 0);
        if (!src.length || size > MAX_PACKAGE_BYTES) {
          notes.push(`[forge] ${pkg.name}: too large or not pure Python, skipped.`);
          continue;
        }
        for (const e of src) files.push({ path: e.name, content: dec.decode(e.data) });
        notes.push(`[forge] Loaded ${pkg.name} from your private registry.`);
      } else {
        if (reg.kind === "pypi") {
          notes.push(`[forge] ${pkg.name}: this project's registry is PyPI, so JavaScript can't use it.`);
          continue;
        }
        const meta = (await (await fetch(`${base}/${pkg.name.replace("/", "%2F")}`, { headers })).json()) as any;
        const version = pkg.version ?? meta?.["dist-tags"]?.latest;
        const tarball = meta?.versions?.[version]?.dist?.tarball;
        if (!tarball) {
          notes.push(`[forge] ${pkg.name}: version not found in your private registry.`);
          continue;
        }
        const tar = untar(await inflate(new Uint8Array(await (await fetch(tarball, { headers })).arrayBuffer()), "gzip"));
        const src = tar.filter((e) => JS_EXT.test(e.name));
        const size = src.reduce((s, e) => s + e.data.length, 0);
        if (tar.some((e) => e.name.endsWith(".node")) || size > MAX_PACKAGE_BYTES) {
          notes.push(`[forge] ${pkg.name}: too large or needs compiling, skipped.`);
          continue;
        }
        for (const e of src) {
          files.push({ path: `node_modules/${pkg.name}/${e.name.replace(/^[^/]+\//, "")}`, content: dec.decode(e.data) });
        }
        notes.push(`[forge] Loaded ${pkg.name}@${version} from your private registry.`);
      }
    } catch (error) {
      notes.push(`[forge] ${pkg.name}: couldn't be fetched from your private registry (${(error as Error).message}).`);
    }
  }
  return { files, notes };
}
