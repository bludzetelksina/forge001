/**
 * Turns a multi-file project into the single program that the sandboxed run
 * service accepts. Pure and dependency-free so it can be unit tested.
 */

export type BundleFile = { path: string; content: string };
export type BundlePackage = { name: string; version: string | null };

export type BundleResult = {
  source: string;
  /** Human-readable warnings surfaced in the console before the program output. */
  notes: string[];
};

export const MAX_BUNDLE_BYTES = 180_000;

function b64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // btoa exists in browsers and in the worker runtime.
  return btoa(binary);
}

function jsonMap(files: BundleFile[]): string {
  return `{\n${files
    .map((file) => `  ${JSON.stringify(file.path)}: ${JSON.stringify(b64(file.content))}`)
    .join(",\n")}\n}`;
}

function phpMap(files: BundleFile[]): string {
  return `[\n${files
    .map((file) => `  ${JSON.stringify(file.path)} => ${JSON.stringify(b64(file.content))},`)
    .join("\n")}\n]`;
}

function pkgLabel(pkg: BundlePackage) {
  return pkg.version ? `${pkg.name}@${pkg.version}` : pkg.name;
}

function pkgList(packages: BundlePackage[]) {
  return packages.map((p) => (p.version ? `${p.name}==${p.version}` : p.name));
}

function byPath(files: BundleFile[], path: string) {
  return files.find((f) => f.path === path || f.path === `./${path}`);
}

function ext(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

/* ------------------------------------------------------------------ */
/* Interpreted languages: recreate the tree, then run the entry file.  */
/* ------------------------------------------------------------------ */

function pythonBundle(entry: string, files: BundleFile[], packages: BundlePackage[]) {
  const installs = packages.length
    ? `
import subprocess
for _pkg in ${JSON.stringify(pkgList(packages))}:
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--disable-pip-version-check", _pkg],
                       check=True, timeout=90, capture_output=True)
    except Exception as _err:
        print("[forge] could not install " + _pkg + " (the run sandbox has no package access)", file=sys.stderr)
`
    : "";

  return `import base64, os, sys, runpy

_FORGE_FILES = ${jsonMap(files)}

for _path, _blob in _FORGE_FILES.items():
    _dir = os.path.dirname(_path)
    if _dir:
        os.makedirs(_dir, exist_ok=True)
    with open(_path, "wb") as _handle:
        _handle.write(base64.b64decode(_blob))

sys.path.insert(0, os.getcwd())
${installs}
sys.argv = [${JSON.stringify(entry)}]
runpy.run_path(${JSON.stringify(entry)}, run_name="__main__")
`;
}

function rubyBundle(entry: string, files: BundleFile[], packages: BundlePackage[]) {
  const installs = packages.length
    ? packages
        .map(
          (p) =>
            `unless system("gem", "install", ${JSON.stringify(p.name)}, "--silent")\n  warn "[forge] could not install ${pkgLabel(p)} (the run sandbox has no package access)"\nend`,
        )
        .join("\n")
    : "";

  return `require 'base64'
require 'fileutils'

FORGE_FILES = ${jsonMap(files)}

FORGE_FILES.each do |path, blob|
  dir = File.dirname(path)
  FileUtils.mkdir_p(dir) unless dir == '.'
  File.binwrite(path, Base64.decode64(blob))
end

$LOAD_PATH.unshift(Dir.pwd)
${installs}
$0 = ${JSON.stringify(entry)}
load File.expand_path(${JSON.stringify(entry)})
`;
}

function phpBundle(entry: string, files: BundleFile[], packages: BundlePackage[]) {
  const warn = packages.length
    ? packages
        .map(
          (p) =>
            `fwrite(STDERR, "[forge] ${pkgLabel(p)} cannot be installed here (the run sandbox has no package access)\\n");`,
        )
        .join("\n")
    : "";

  return `<?php
$forgeFiles = ${phpMap(files)};

foreach ($forgeFiles as $path => $blob) {
    $dir = dirname($path);
    if ($dir !== '.' && !is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    file_put_contents($path, base64_decode($blob));
}
${warn}
require getcwd() . '/' . ${JSON.stringify(entry)};
`;
}

function nodeBundle(entry: string, files: BundleFile[]) {
  return `const fs = require("fs");
const path = require("path");

const FORGE_FILES = ${jsonMap(files)};

for (const [file, blob] of Object.entries(FORGE_FILES)) {
  const dir = path.dirname(file);
  if (dir !== ".") fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, Buffer.from(blob, "base64"));
}

require(path.resolve(process.cwd(), ${JSON.stringify(entry)}));
`;
}

function bashBundle(entry: string, files: BundleFile[]) {
  const writes = files
    .map(
      (file) => `mkdir -p "$(dirname ${JSON.stringify(file.path)})"
printf '%s' ${JSON.stringify(b64(file.content))} | base64 -d > ${JSON.stringify(file.path)}`,
    )
    .join("\n");

  return `#!/usr/bin/env bash
set -o pipefail
${writes}
chmod +x ${JSON.stringify(entry)} 2>/dev/null
bash ${JSON.stringify(entry)}
`;
}

/* ------------------------------------------------------------------ */
/* Compiled languages: merge the sources into one compilation unit.    */
/* ------------------------------------------------------------------ */

function goBundle(entry: string, files: BundleFile[]) {
  const sources = [
    ...files.filter((f) => f.path === entry),
    ...files.filter((f) => f.path !== entry && ext(f.path) === "go"),
  ];

  const imports = new Set<string>();
  const bodies: string[] = [];

  for (const file of sources) {
    let body = file.content;
    body = body.replace(/^\s*package\s+\w+\s*$/m, "");
    body = body.replace(/^import\s*\(([\s\S]*?)\)\s*$/gm, (_all, block: string) => {
      for (const line of block.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) imports.add(trimmed);
      }
      return "";
    });
    body = body.replace(/^import\s+((?:\w+\s+)?"[^"]+")\s*$/gm, (_all, spec: string) => {
      imports.add(spec.trim());
      return "";
    });
    bodies.push(body.trim());
  }

  const importBlock = imports.size ? `import (\n\t${Array.from(imports).join("\n\t")}\n)\n` : "";
  return `package main\n\n${importBlock}\n${bodies.join("\n\n")}\n`;
}

function javaBundle(entry: string, files: BundleFile[]) {
  const sources = [
    ...files.filter((f) => f.path === entry),
    ...files.filter((f) => f.path !== entry && ext(f.path) === "java"),
  ];

  const imports = new Set<string>();
  const bodies: string[] = [];

  for (const file of sources) {
    let body = file.content;
    body = body.replace(/^\s*package\s+[\w.]+;\s*$/gm, "");
    body = body.replace(/^\s*import\s+([\w.*]+);\s*$/gm, (_all, spec: string) => {
      imports.add(`import ${spec};`);
      return "";
    });
    if (file.path !== entry) {
      body = body.replace(/^\s*public\s+(?=(?:final\s+|abstract\s+)?(?:class|interface|enum|record)\b)/gm, "");
    }
    bodies.push(body.trim());
  }

  return `${Array.from(imports).join("\n")}\n\n${bodies.join("\n\n")}\n`;
}

function rustBundle(entry: string, files: BundleFile[]) {
  const seen = new Set<string>();

  function expand(source: string, depth: number): string {
    if (depth > 6) return source;
    return source.replace(/^([ \t]*)(pub\s+)?mod\s+(\w+)\s*;/gm, (all, indent: string, pub: string | undefined, name: string) => {
      const module =
        byPath(files, `${name}.rs`) ?? byPath(files, `${name}/mod.rs`) ?? byPath(files, `src/${name}.rs`);
      if (!module || seen.has(module.path)) return all;
      seen.add(module.path);
      const inner = expand(module.content, depth + 1)
        .split("\n")
        .map((line) => (line ? `${indent}    ${line}` : line))
        .join("\n");
      return `${indent}${pub ?? ""}mod ${name} {\n${inner}\n${indent}}`;
    });
  }

  const main = byPath(files, entry) ?? files[0]!;
  return expand(main.content, 0);
}

const C_HEADER_EXT = new Set(["h", "hpp", "hh"]);

function cBundle(entry: string, files: BundleFile[]) {
  const included = new Set<string>();

  function inline(source: string, depth: number): string {
    if (depth > 8) return source;
    return source.replace(/^[ \t]*#include\s+"([^"]+)"[ \t]*$/gm, (all, target: string) => {
      const header = byPath(files, target) ?? byPath(files, target.replace(/^\.\//, ""));
      if (!header) return all;
      if (included.has(header.path)) return "";
      included.add(header.path);
      return inline(header.content, depth + 1);
    });
  }

  const main = byPath(files, entry) ?? files[0]!;
  const others = files.filter(
    (f) => f.path !== main.path && !C_HEADER_EXT.has(ext(f.path)) && ["c", "cpp", "cc"].includes(ext(f.path)),
  );

  const parts = [...others.map((f) => inline(f.content, 0)), inline(main.content, 0)];
  return parts.join("\n\n");
}

function tsBundle(entry: string, files: BundleFile[]) {
  const main = byPath(files, entry) ?? files[0]!;
  const others = files.filter((f) => f.path !== main.path && ["ts", "tsx"].includes(ext(f.path)));

  const strip = (source: string) =>
    source
      .replace(/^\s*import\s+[^;]*?from\s+['"]\.[^'"]*['"];?\s*$/gm, "")
      .replace(/^\s*export\s+\*\s+from\s+['"]\.[^'"]*['"];?\s*$/gm, "")
      .replace(/^\s*export\s+(?=(?:default\s+)?(?:const|let|var|function|class|type|interface|enum|async))/gm, "")
      .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, "");

  return [...others.map((f) => strip(f.content)), strip(main.content)].join("\n\n");
}

/* ------------------------------------------------------------------ */

const UNSUPPORTED_PACKAGES: Record<string, string> = {
  go: "Go modules cannot be downloaded in the run sandbox — only the standard library is available.",
  rust: "Crates cannot be downloaded in the run sandbox — only the standard library is available.",
  java: "Maven/Gradle dependencies cannot be downloaded in the run sandbox — only the JDK standard library is available.",
  c: "System libraries cannot be installed in the run sandbox — only the standard C library is available.",
  cpp: "System libraries cannot be installed in the run sandbox — only the standard C++ library is available.",
  javascript: "npm packages cannot be downloaded in the run sandbox; they do work in web projects through the CDN.",
  typescript: "npm packages cannot be downloaded in the run sandbox; they do work in web projects through the CDN.",
  bash: "Packages cannot be installed in the run sandbox.",
};

export function bundleProject(input: {
  language: string;
  entry: string;
  files: BundleFile[];
  packages?: BundlePackage[];
}): BundleResult {
  const notes: string[] = [];
  const packages = input.packages ?? [];
  const files = input.files.filter((f) => f.path.trim().length > 0);
  const entry = byPath(files, input.entry) ? input.entry : (files[0]?.path ?? input.entry);

  if (packages.length) {
    const message = UNSUPPORTED_PACKAGES[input.language];
    if (message) {
      notes.push(`[forge] ${packages.map(pkgLabel).join(", ")}: ${message}`);
    }
  }

  const total = files.reduce((sum, file) => sum + file.content.length, 0);
  if (total > MAX_BUNDLE_BYTES) {
    notes.push(
      `[forge] This project is ${Math.round(total / 1000)} KB of source; only the first ${Math.round(
        MAX_BUNDLE_BYTES / 1000,
      )} KB is sent to the runner.`,
    );
  }

  let source: string;
  switch (input.language) {
    case "python":
      source = pythonBundle(entry, files, packages);
      break;
    case "ruby":
      source = rubyBundle(entry, files, packages);
      break;
    case "php":
      source = phpBundle(entry, files, packages);
      break;
    case "javascript":
      source = nodeBundle(entry, files);
      break;
    case "bash":
      source = bashBundle(entry, files);
      break;
    case "typescript":
      source = tsBundle(entry, files);
      if (files.length > 1) {
        notes.push(
          "[forge] TypeScript files are merged into one program, so local imports between them are removed automatically.",
        );
      }
      break;
    case "go":
      source = goBundle(entry, files);
      if (files.length > 1) notes.push("[forge] All .go files are merged into package main.");
      break;
    case "java":
      source = javaBundle(entry, files);
      if (files.length > 1)
        notes.push("[forge] All .java files are merged into one file; extra classes lose their public modifier.");
      break;
    case "rust":
      source = rustBundle(entry, files);
      break;
    case "c":
    case "cpp":
      source = cBundle(entry, files);
      break;
    default:
      source = byPath(files, entry)?.content ?? "";
  }

  return { source: source.slice(0, MAX_BUNDLE_BYTES), notes };
}
