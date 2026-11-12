import { strToU8, zipSync } from "fflate";

export function zipEntries(files: { path: string; content: string }[]) {
  const out: Record<string, Uint8Array> = {};
  for (const f of files) out[f.path.replace(/^\/+/, "")] = strToU8(f.content ?? "");
  return out;
}

export function downloadZip(name: string, files: { path: string; content: string }[]) {
  const bytes = zipSync(zipEntries(files));
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w.-]+/g, "-") || "project"}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function findReadme<T extends { path: string }>(files: T[]) {
  return files.find((f) => /^readme\.md$/i.test(f.path)) ?? null;
}
