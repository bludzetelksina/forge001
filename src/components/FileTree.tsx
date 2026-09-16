import { ChevronDown, ChevronRight, Copy, FilePlus2, FolderPlus, Pencil, Play, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { FileRow } from "@/lib/projects";

type TreeNode =
  | { kind: "file"; name: string; file: FileRow }
  | { kind: "dir"; name: string; path: string; children: TreeNode[] };

function buildTree(files: FileRow[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const segments = file.path.split("/").filter(Boolean);
    let level = root;
    let prefix = "";

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;
      prefix = prefix ? `${prefix}/${segment}` : segment;

      if (isLeaf) {
        level.push({ kind: "file", name: segment, file });
        return;
      }

      let dir = level.find(
        (node): node is Extract<TreeNode, { kind: "dir" }> =>
          node.kind === "dir" && node.name === segment,
      );
      if (!dir) {
        dir = { kind: "dir", name: segment, path: prefix, children: [] };
        level.push(dir);
      }
      level = dir.children;
    });
  }

  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .map((node) => (node.kind === "dir" ? { ...node, children: sort(node.children) } : node))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "dir" ? -1 : 1));

  return sort(root);
}

export default function FileTree({
  files,
  activeId,
  entryPath,
  canEdit,
  onOpen,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onSetEntry,
}: {
  files: FileRow[];
  activeId: string | null;
  entryPath: string;
  canEdit: boolean;
  onOpen: (file: FileRow) => void;
  onCreate: (path: string) => void;
  onRename: (file: FileRow, path: string) => void;
  onDuplicate: (file: FileRow) => void;
  onDelete: (file: FileRow) => void;
  onSetEntry: (file: FileRow) => void;
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function renderNodes(nodes: TreeNode[], depth: number) {
    return nodes.map((node) => {
      if (node.kind === "dir") {
        const isCollapsed = collapsed[node.path] ?? false;
        return (
          <li key={`dir:${node.path}`}>
            <button
              type="button"
              onClick={() => setCollapsed((current) => ({ ...current, [node.path]: !isCollapsed }))}
              className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 font-mono text-xs text-muted-foreground hover:bg-secondary/60"
              style={{ paddingLeft: `${depth * 10 + 8}px` }}
            >
              {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
              {node.name}
            </button>
            {isCollapsed ? null : <ul>{renderNodes(node.children, depth + 1)}</ul>}
          </li>
        );
      }

      const file = node.file;
      const isEntry = file.path === entryPath;

      return (
        <li key={file.id}>
          <div
            className={`group flex items-center gap-1 rounded-md py-1.5 pr-2 font-mono text-xs ${
              file.id === activeId
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60"
            }`}
            style={{ paddingLeft: `${depth * 10 + 8}px` }}
          >
            <button type="button" className="flex-1 truncate text-left" onClick={() => onOpen(file)}>
              {node.name}
              {isEntry ? <span className="ml-1 text-primary">▸</span> : null}
            </button>

            {canEdit ? (
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!isEntry ? (
                  <button type="button" aria-label={`Run ${file.path} by default`} onClick={() => onSetEntry(file)}>
                    <Play className="size-3" />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`Rename ${file.path}`}
                  onClick={() => {
                    const next = prompt("Rename or move (use / for folders)", file.path)?.trim();
                    if (next && next !== file.path) onRename(file, next);
                  }}
                >
                  <Pencil className="size-3" />
                </button>
                <button type="button" aria-label={`Duplicate ${file.path}`} onClick={() => onDuplicate(file)}>
                  <Copy className="size-3" />
                </button>
                <button type="button" aria-label={`Delete ${file.path}`} onClick={() => onDelete(file)}>
                  <Trash2 className="size-3" />
                </button>
              </div>
            ) : null}
          </div>
        </li>
      );
    });
  }

  return (
    <div className="flex h-full flex-col">
      {canEdit ? (
        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 font-mono text-[11px]"
            onClick={() => {
              const path = prompt("New file name (e.g. utils/helpers.py)")?.trim();
              if (path) onCreate(path);
            }}
          >
            <FilePlus2 className="size-3.5" /> File
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 font-mono text-[11px]"
            onClick={() => {
              const folder = prompt("New folder name (e.g. utils)")?.trim().replace(/\/+$/, "");
              if (!folder) return;
              const name = prompt("First file in that folder", "__init__.py")?.trim();
              if (name) onCreate(`${folder}/${name}`);
            }}
          >
            <FolderPlus className="size-3.5" /> Folder
          </Button>
        </div>
      ) : null}

      <ul className="flex-1 overflow-auto p-1.5">{renderNodes(tree, 0)}</ul>

      <div className="border-t border-border p-3">
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          ▸ marks the file that Run executes. Every file in the tree is sent to the runner.
        </p>
      </div>
    </div>
  );
}
