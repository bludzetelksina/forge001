import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGES } from "@/lib/languages";
import { listSnapshots, restoreSnapshot, type SnapshotRow } from "@/lib/snapshots";
import { deleteProject, duplicateProject, type FileRow, type ProjectRow } from "@/lib/projects";

export const VM_MEMORY_OPTIONS = [128, 256, 512, 1024];

export function vmMemoryFor(projectId: string) {
  if (typeof window === "undefined") return 1024;
  return Number(window.localStorage.getItem(`forge-vm-mem-${projectId}`)) || 1024;
}

export default function SettingsPanel({
  project,
  files,
  canEdit,
  isOwner,
}: {
  project: ProjectRow;
  files: FileRow[];
  canEdit: boolean;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(project.name);
  const [language, setLanguage] = useState(project.language);
  const [entry, setEntry] = useState(project.entry_file);
  const [memory, setMemory] = useState(() => vmMemoryFor(project.id));

  async function save() {
    const { error } = await supabase
      .from("projects")
      .update({ name: name.trim() || project.name, language, entry_file: entry })
      .eq("id", project.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.localStorage.setItem(`forge-vm-mem-${project.id}`, String(memory));
    toast.success("Settings saved.");
    void qc.invalidateQueries({ queryKey: ["project", project.id] });
  }

  const label = "block font-mono text-[10px] uppercase tracking-widest text-muted-foreground";
  const select = "mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 font-mono text-xs";

  return (
    <div className="h-full space-y-4 overflow-auto bg-editor p-4">
      <div>
        <label className={label} htmlFor="set-name">Project name</label>
        <Input id="set-name" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} className="mt-1 h-8 font-mono text-xs" />
      </div>
      <div>
        <label className={label} htmlFor="set-lang">Language</label>
        <select id="set-lang" className={select} value={language} disabled={!canEdit} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="set-entry">Entry file</label>
        <select id="set-entry" className={select} value={entry} disabled={!canEdit} onChange={(e) => setEntry(e.target.value)}>
          {files.map((f) => <option key={f.id} value={f.path}>{f.path}</option>)}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="set-mem">Shell machine memory</label>
        <select id="set-mem" className={select} value={memory} onChange={(e) => setMemory(Number(e.target.value))}>
          {VM_MEMORY_OPTIONS.map((m) => <option key={m} value={m}>{m >= 1024 ? `${m / 1024} GB` : `${m} MB`}</option>)}
        </select>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">1 CPU. Takes effect next time Shell starts. Saved in this browser.</p>
      </div>
      {canEdit ? <Button size="sm" onClick={() => void save()}>Save settings</Button> : null}

      <VersionHistory projectId={project.id} files={files} canEdit={canEdit} />

      <div className="flex gap-2 border-t border-border pt-4">
        <Button size="sm" variant="secondary"
          onClick={async () => {
            const copy = await duplicateProject(project.id);
            navigate({ to: "/app/$projectId", params: { projectId: copy.id } });
          }}>
          Duplicate project
        </Button>
        {isOwner ? (
          <Button size="sm" variant="destructive"
            onClick={async () => {
              if (!confirm(`Delete "${project.name}" for everyone? This can't be undone.`)) return;
              await deleteProject(project.id);
              void qc.invalidateQueries({ queryKey: ["projects"] });
              navigate({ to: "/app" });
            }}>
            Delete project
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function VersionHistory({ projectId, files, canEdit }: { projectId: string; files: FileRow[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["snapshots", projectId], queryFn: () => listSnapshots(projectId) });
  const [preview, setPreview] = useState<SnapshotRow | null>(null);

  async function restore(snap: SnapshotRow) {
    if (!confirm("Restore this version? Current file contents will be replaced.")) return;
    try {
      await restoreSnapshot(projectId, snap, files);
      await qc.invalidateQueries({ queryKey: ["files", projectId] });
      toast.success("Version restored.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore.");
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Version history</p>
      <p className="text-xs text-muted-foreground">Saved on every Run and every 10 minutes. Last 30 kept.</p>
      {q.data?.length ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {q.data.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-2 py-1.5 font-mono text-xs">
              <span className="flex-1 truncate">{new Date(s.created_at).toLocaleString()} · {s.label} · {s.files.length} files</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setPreview(preview?.id === s.id ? null : s)}>
                {preview?.id === s.id ? "Hide" : "Preview"}
              </Button>
              {canEdit ? <Button size="sm" variant="secondary" className="h-6 px-2 text-xs" onClick={() => void restore(s)}>Restore</Button> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{q.isLoading ? "Loading…" : "No versions yet — press Run to save one."}</p>
      )}
      {preview ? (
        <div className="max-h-64 space-y-2 overflow-auto rounded-md border border-border p-2">
          {preview.files.map((f) => (
            <div key={f.path}>
              <p className="font-mono text-[10px] text-primary">{f.path}</p>
              <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{f.content.slice(0, 2000)}</pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
