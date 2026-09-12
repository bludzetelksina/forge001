import { useMemo } from "react";

type SimpleFile = { path: string; content: string };

/** Inlines local css/js references so the page renders inside a sandboxed frame. */
function buildDocument(files: SimpleFile[]) {
  const entry =
    files.find((f) => f.path === "index.html") ?? files.find((f) => f.path.endsWith(".html"));
  if (!entry) {
    return "<!doctype html><title>No page</title><body style='font-family:sans-serif;padding:24px'>Add an <code>index.html</code> file to see a preview.</body>";
  }

  let doc = entry.content;

  for (const file of files) {
    if (file.path.endsWith(".css")) {
      const pattern = new RegExp(`<link[^>]*href=["']\\.?/?${file.path}["'][^>]*>`, "gi");
      doc = doc.replace(pattern, `<style>\n${file.content}\n</style>`);
    }
    if (file.path.endsWith(".js")) {
      const pattern = new RegExp(`<script[^>]*src=["']\\.?/?${file.path}["'][^>]*>\\s*</script>`, "gi");
      doc = doc.replace(pattern, `<script>\n${file.content}\n</script>`);
    }
  }

  return doc;
}

export default function WebPreview({
  files,
  refreshKey = 0,
}: {
  files: SimpleFile[];
  refreshKey?: number;
}) {
  const doc = useMemo(() => buildDocument(files), [files]);

  return (
    <iframe
      key={refreshKey}
      title="Live preview"
      srcDoc={doc}
      sandbox="allow-scripts allow-modals allow-forms"
      className="h-full w-full border-0 bg-background"
    />
  );
}
