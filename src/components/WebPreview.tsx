import { useEffect, useMemo, useState } from "react";

type SimpleFile = { path: string; content: string };
type PreviewPackage = { name: string; url: string };

function normalise(path: string) {
  return path.replace(/^\.\//, "").replace(/^\//, "");
}

/** Resolves an href written inside `fromPath` against the project tree. */
function resolvePath(fromPath: string, href: string) {
  const clean = normalise(href.split("?")[0]!.split("#")[0]!);
  const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
  const stack = dir ? dir.split("/") : [];
  for (const segment of clean.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") stack.pop();
    else stack.push(segment);
  }
  return stack.join("/");
}

const NAV_SCRIPT = `<script>
document.addEventListener("click", function (event) {
  var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
  if (!link) return;
  var href = link.getAttribute("href") || "";
  if (/^(https?:|mailto:|#)/.test(href)) return;
  event.preventDefault();
  parent.postMessage({ forgeNavigate: href }, "*");
});
</script>`;

function buildDocument(files: SimpleFile[], entryPath: string, packages: PreviewPackage[]) {
  const entry = files.find((f) => normalise(f.path) === normalise(entryPath));
  if (!entry) {
    return "<!doctype html><title>No page</title><body style='font-family:sans-serif;padding:24px'>Add an <code>index.html</code> file to see a preview.</body>";
  }

  let doc = entry.content;

  for (const file of files) {
    const rel = normalise(file.path);
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const name = rel.split("/").pop()!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const target = `(?:\\.{0,2}/)*(?:${escaped}|${name})`;

    if (rel.endsWith(".css")) {
      doc = doc.replace(
        new RegExp(`<link[^>]*href=["']${target}["'][^>]*>`, "gi"),
        `<style>\n${file.content}\n</style>`,
      );
    }
    if (rel.endsWith(".js")) {
      doc = doc.replace(
        new RegExp(`<script([^>]*)src=["']${target}["']([^>]*)>\\s*</script>`, "gi"),
        (_all, before: string, after: string) => {
          const attrs = `${before} ${after}`;
          const type = /type=["']module["']/i.test(attrs) ? ' type="module"' : "";
          return `<script${type}>\n${file.content}\n</script>`;
        },
      );
    }
  }

  const importMap = packages.length
    ? `<script type="importmap">${JSON.stringify({
        imports: Object.fromEntries(packages.map((pkg) => [pkg.name, pkg.url])),
      })}</script>`
    : "";

  return `${importMap}${doc}${NAV_SCRIPT}`;
}

export default function WebPreview({
  files,
  packages = [],
  refreshKey = 0,
}: {
  files: SimpleFile[];
  packages?: PreviewPackage[];
  refreshKey?: number;
}) {
  const pages = useMemo(
    () => files.filter((file) => normalise(file.path).endsWith(".html")).map((f) => normalise(f.path)),
    [files],
  );

  const [page, setPage] = useState<string>(pages[0] ?? "index.html");

  useEffect(() => {
    if (pages.length && !pages.includes(page)) {
      setPage(pages.includes("index.html") ? "index.html" : pages[0]!);
    }
  }, [pages, page]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const href = (event.data as { forgeNavigate?: string } | null)?.forgeNavigate;
      if (typeof href !== "string") return;
      const target = resolvePath(page, href);
      if (pages.includes(target)) setPage(target);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [page, pages]);

  const doc = useMemo(() => buildDocument(files, page, packages), [files, page, packages]);

  return (
    <div className="flex h-full flex-col">
      {pages.length > 1 ? (
        <div className="flex shrink-0 items-stretch overflow-x-auto border-b border-border bg-chrome">
          {pages.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => setPage(path)}
              className={`border-r border-border px-3 py-1.5 font-mono text-[11px] ${
                path === page ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {path}
            </button>
          ))}
        </div>
      ) : null}

      <iframe
        key={`${refreshKey}:${page}`}
        title="Live preview"
        srcDoc={doc}
        sandbox="allow-scripts allow-modals allow-forms"
        className="min-h-0 flex-1 w-full border-0 bg-background"
      />
    </div>
  );
}
