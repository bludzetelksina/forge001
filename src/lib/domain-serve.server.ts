/** Serves a public web project's files on a verified custom domain. */

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  xml: "application/xml; charset=utf-8",
};

function contentType(path: string) {
  const ext = path.includes(".") ? path.split(".").pop()!.toLowerCase() : "";
  return TYPES[ext] ?? "text/plain; charset=utf-8";
}

function isAppHost(host: string) {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.dev")
  );
}

export async function serveCustomDomain(request: Request): Promise<Response | null> {
  const rawHost = request.headers.get("host") ?? "";
  const host = rawHost.split(":")[0]!.toLowerCase();
  if (!host || isAppHost(host)) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: domain } = await supabaseAdmin
    .from("project_domains")
    .select("project_id, status")
    .eq("hostname", host)
    .maybeSingle();
  if (!domain || domain.status !== "verified") return null;

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, entry_file, is_public, language")
    .eq("id", domain.project_id)
    .maybeSingle();
  if (!project || !project.is_public) {
    return new Response("This site is not published.", { status: 404 });
  }

  const { data: files } = await supabaseAdmin
    .from("project_files")
    .select("path, content")
    .eq("project_id", project.id);
  const tree = new Map((files ?? []).map((f) => [f.path.replace(/^\.?\//, ""), f.content]));

  const pathname = decodeURIComponent(new URL(request.url).pathname).replace(/^\//, "");
  const candidates = pathname
    ? [pathname, `${pathname}.html`, `${pathname.replace(/\/$/, "")}/index.html`]
    : [project.entry_file, "index.html"];

  for (const candidate of candidates) {
    const key = candidate.replace(/^\.?\//, "");
    const content = tree.get(key);
    if (content !== undefined) {
      return new Response(content, {
        status: 200,
        headers: { "content-type": contentType(key), "cache-control": "public, max-age=60" },
      });
    }
  }

  const notFound = tree.get("404.html");
  return new Response(notFound ?? "<!doctype html><title>Not found</title><h1>404 — page not found</h1>", {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
