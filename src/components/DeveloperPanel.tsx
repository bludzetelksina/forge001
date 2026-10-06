import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import OutputConsole from "@/components/OutputConsole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { RunResult } from "@/lib/run.functions";

export async function listEnv(projectId: string) {
  const { data, error } = await supabase.from("project_env").select("id, key, value").eq("project_id", projectId).order("key");
  if (error) throw error;
  return data ?? [];
}

export default function DeveloperPanel({
  projectId,
  canEdit,
  result,
  running,
}: {
  projectId: string;
  canEdit: boolean;
  result: RunResult | null;
  running: boolean;
}) {
  const qc = useQueryClient();
  const [view, setView] = useState<"console" | "history" | "env">("console");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const env = useQuery({ queryKey: ["env", projectId], queryFn: () => listEnv(projectId), enabled: canEdit });
  const history = useQuery({
    queryKey: ["runs", projectId],
    enabled: view === "history",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("runs")
        .select("id, language, stdout, stderr, exit_code, duration_ms, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error("Names use letters, numbers and _ only.");
      const { error } = await supabase
        .from("project_env")
        .upsert({ project_id: projectId, key, value }, { onConflict: "project_id,key" });
      if (error) throw error;
    },
    onSuccess: () => {
      setKey("");
      setValue("");
      void qc.invalidateQueries({ queryKey: ["env", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tab = (id: typeof view, label: string) => (
    <button type="button" onClick={() => setView(id)}
      className={`px-3 py-1.5 font-mono text-[11px] ${view === id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-col bg-editor">
      <div className="flex shrink-0 border-b border-border bg-chrome">
        {tab("console", "Console")}
        {tab("history", "Run history")}
        {canEdit ? tab("env", "Environment") : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {view === "console" ? (
          <OutputConsole result={result} running={running} />
        ) : view === "history" ? (
          <ul className="divide-y divide-border font-mono text-[11px]">
            {(history.data ?? []).map((run) => (
              <li key={run.id} className="p-2">
                <details>
                  <summary className="cursor-pointer text-muted-foreground">
                    <span className={run.exit_code === 0 ? "text-primary" : "text-destructive"}>●</span>{" "}
                    {new Date(run.created_at).toLocaleString()} · {run.language} · exit {run.exit_code ?? "—"} · {run.duration_ms ?? 0} ms
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-foreground">{run.stdout || "(no output)"}</pre>
                  {run.stderr ? <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-destructive">{run.stderr}</pre> : null}
                </details>
              </li>
            ))}
            {history.data?.length === 0 ? <li className="p-3 text-muted-foreground">No runs yet.</li> : null}
          </ul>
        ) : (
          <div className="space-y-3 p-3">
            <p className="font-mono text-[11px] text-muted-foreground">
              Passed to Python, JavaScript, TypeScript, Ruby and bash runs. Only owners and editors can see these, and they never
              appear on the public share page.
            </p>
            <div className="flex gap-2">
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="NAME" className="h-8 font-mono text-xs" aria-label="Variable name" />
              <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" type="password" className="h-8 font-mono text-xs" aria-label="Variable value" />
              <Button size="sm" className="h-8" disabled={!key || save.isPending} onClick={() => save.mutate()}>
                <Plus className="size-3.5" />Save
              </Button>
            </div>
            <ul className="space-y-1 font-mono text-xs">
              {(env.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-secondary/60">
                  <span className="flex-1 text-foreground">{row.key}</span>
                  <span className="text-muted-foreground">••••••</span>
                  <button type="button" aria-label={`Delete ${row.key}`}
                    onClick={async () => {
                      await supabase.from("project_env").delete().eq("id", row.id);
                      void qc.invalidateQueries({ queryKey: ["env", projectId] });
                    }}>
                    <Trash2 className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
