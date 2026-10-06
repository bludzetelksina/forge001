import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGES } from "@/lib/languages";
import { deleteProject, duplicateProject, type FileRow, type ProjectRow } from "@/lib/projects";

export const VM_MEMORY_OPTIONS = [128, 256, 512, 1024];

export function vmMemoryFor(projectId: string) {
  if (typeof window === "undefined") return 256;
  return Number(window.localStorage.getItem(`forge-vm-mem-${projectId}`)) || 256;
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
    if (error) return toast.error(error.message);
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
