const PARSERS: Record<string, string> = {
  js: "babel", jsx: "babel", mjs: "babel", cjs: "babel",
  ts: "typescript", tsx: "typescript",
  html: "html", htm: "html",
  css: "css", json: "json",
};

export function formatParserFor(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return PARSERS[ext] ?? null;
}

/** Formats code with Prettier in the browser. Returns null for unsupported files. */
export async function formatCode(path: string, code: string): Promise<string | null> {
  const parser = formatParserFor(path);
  if (!parser) return null;
  const [prettier, babel, estree, ts, html, css] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),
    import("prettier/plugins/typescript"),
    import("prettier/plugins/html"),
    import("prettier/plugins/postcss"),
  ]);
  return prettier.format(code, {
    parser,
    plugins: [babel, estree, ts, html, css] as never,
  });
}
