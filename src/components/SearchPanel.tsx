import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type SearchFile = { id: string; path: string; content: string };

export function findMatches(files: SearchFile[], query: string) {
  if (!query) return [];
  const q = query.toLowerCase();
  const out: { file: SearchFile; line: number; text: string }[] = [];
  for (const file of files) {
    file.content.split("\n").forEach((text, i) => {
      if (text.toLowerCase().includes(q) && out.length < 500) out.push({ file, line: i + 1, text });
    });
  }
  return out;
}

export function replaceAllIn(content: string, query: string, replacement: string) {
  if (!query) return content;
  return content.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), () => replacement);
}

export default function SearchPanel({
  files,
  canEdit,
  onOpen,
  onReplace,
}: {
  files: SearchFile[];
  canEdit: boolean;
  onOpen: (fileId: string) => void;
  onReplace: (changes: { id: string; content: string }[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const matches = useMemo(() => findMatches(files, query), [files, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find in files" aria-label="Find in files" className="h-7 font-mono text-xs" />
        {canEdit ? (
          <div className="flex gap-1">
            <Input value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="Replace with" aria-label="Replace with" className="h-7 font-mono text-xs" />
            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" disabled={!matches.length}
              onClick={() => {
                const ids = new Set(matches.map((m) => m.file.id));
                onReplace(files.filter((f) => ids.has(f.id)).map((f) => ({ id: f.id, content: replaceAllIn(f.content, query, replacement) })));
              }}>
              All
            </Button>
          </div>
        ) : null}
        <p className="font-mono text-[10px] text-muted-foreground">{query ? `${matches.length} matches` : "Type to search"}</p>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto">
        {matches.map((m, i) => (
          <li key={i}>
            <button type="button" onClick={() => onOpen(m.file.id)} className="block w-full px-2 py-1 text-left font-mono text-[11px] hover:bg-accent">
              <span className="text-primary">{m.file.path}:{m.line}</span>
              <span className="block truncate text-muted-foreground">{m.text.trim()}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
