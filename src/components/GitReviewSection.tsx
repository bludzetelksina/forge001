import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GitPullRequest, Play, RotateCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addStarterWorkflow,
  dispatchWorkflow,
  listPulls,
  listRuns,
  listWorkflows,
  mergePull,
  openPull,
  pullFiles,
  rerunRun,
  reviewPull,
  runJobs,
} from "@/lib/github-review.functions";

export default function GitReviewSection({
  projectId,
  repo,
  branch,
  canEdit,
  language,
}: {
  projectId: string;
  repo: string;
  branch: string;
  canEdit: boolean;
  language: string;
}) {
  const qc = useQueryClient();
  const fns = {
    pulls: useServerFn(listPulls),
    open: useServerFn(openPull),
    files: useServerFn(pullFiles),
    review: useServerFn(reviewPull),
    merge: useServerFn(mergePull),
    runs: useServerFn(listRuns),
    jobs: useServerFn(runJobs),
    rerun: useServerFn(rerunRun),
    workflows: useServerFn(listWorkflows),
    dispatch: useServerFn(dispatchWorkflow),
    starter: useServerFn(addStarterWorkflow),
  };

  const [base, setBase] = useState("main");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [runId, setRunId] = useState<number | null>(null);

  const pulls = useQuery({ queryKey: ["pulls", repo], queryFn: () => fns.pulls({ data: { repo } }) });
  const files = useQuery({
    queryKey: ["pull-files", repo, selected],
    queryFn: () => fns.files({ data: { repo, number: selected! } }),
    enabled: selected !== null,
  });
  const runs = useQuery({ queryKey: ["runs", repo], queryFn: () => fns.runs({ data: { repo } }) });
  const jobs = useQuery({
    queryKey: ["jobs", repo, runId],
    queryFn: () => fns.jobs({ data: { repo, runId: runId! } }),
    enabled: runId !== null,
  });
  const workflows = useQuery({ queryKey: ["workflows", repo], queryFn: () => fns.workflows({ data: { repo } }) });

  const act = useMutation({
    mutationFn: (job: () => Promise<unknown>) => job(),
    onSuccess: () => {
      toast.success("Done.");
      void qc.invalidateQueries({ queryKey: ["pulls", repo] });
      void qc.invalidateQueries({ queryKey: ["runs", repo] });
      void qc.invalidateQueries({ queryKey: ["workflows", repo] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const label = "mt-5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground";

  return (
    <div className="mt-4 border-t border-border pt-2">
      <span className={label}>Pull requests</span>
      {canEdit && branch ? (
        <div className="mt-2 space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Title (${branch} → base)`} className="h-8 font-mono text-xs" aria-label="Pull request title" />
          <div className="flex gap-2">
            <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="Base branch" className="h-8 font-mono text-xs" aria-label="Base branch" />
            <Button size="sm" className="h-8" disabled={!title.trim() || act.isPending}
              onClick={() => act.mutate(() => fns.open({ data: { projectId, repo, head: branch, base, title, body: "Opened from Forge" } }))}>
              <GitPullRequest className="size-3.5" />Open
            </Button>
          </div>
        </div>
      ) : null}
      <ul className="mt-2 space-y-1 font-mono text-[11px]">
        {(pulls.data ?? []).map((p) => (
          <li key={p.number}>
            <button type="button" className="w-full truncate text-left text-foreground hover:underline" onClick={() => setSelected(selected === p.number ? null : p.number)}>
              #{p.number} {p.title} <span className="text-muted-foreground">· {p.head} → {p.base}</span>
            </button>
            {selected === p.number ? (
              <div className="mt-1 rounded-md border border-border p-2">
                {(files.data ?? []).map((f) => (
                  <details key={f.filename} className="mb-1">
                    <summary className="cursor-pointer truncate">{f.filename} <span className="text-primary">+{f.additions}</span> <span className="text-destructive">-{f.deletions}</span></summary>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre text-[10px]">
                      {f.patch.split("\n").map((line, i) => (
                        <div key={i} className={line.startsWith("+") ? "text-primary" : line.startsWith("-") ? "text-destructive" : "text-muted-foreground"}>{line}</div>
                      ))}
                    </pre>
                  </details>
                ))}
                {canEdit ? (
                  <>
                    <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Review comment" className="mt-2 h-8 font-mono text-xs" aria-label="Review comment" />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(["COMMENT", "APPROVE", "REQUEST_CHANGES"] as const).map((event) => (
                        <Button key={event} size="sm" variant="secondary" className="h-7 text-[10px]" disabled={act.isPending}
                          onClick={() => act.mutate(() => fns.review({ data: { projectId, repo, number: p.number, event, body: comment } }))}>
                          {event === "COMMENT" ? "Comment" : event === "APPROVE" ? "Approve" : "Request changes"}
                        </Button>
                      ))}
                      <Button size="sm" className="h-7 text-[10px]" disabled={act.isPending}
                        onClick={() => confirm(`Merge #${p.number}?`) && act.mutate(() => fns.merge({ data: { projectId, repo, number: p.number } }))}>
                        Merge
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
        {pulls.data?.length === 0 ? <li className="text-muted-foreground">No open pull requests.</li> : null}
      </ul>

      <span className={label}>Actions</span>
      {canEdit ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {(workflows.data ?? []).map((w) => (
            <Button key={w.id} size="sm" variant="secondary" className="h-7 text-[10px]" disabled={act.isPending || !branch}
              onClick={() => act.mutate(() => fns.dispatch({ data: { projectId, repo, workflowId: w.id, ref: branch } }))}>
              <Play className="size-3" />{w.name}
            </Button>
          ))}
          {workflows.data && workflows.data.length === 0 && branch ? (
            <Button size="sm" variant="secondary" className="h-7 text-[10px]" disabled={act.isPending}
              onClick={() => act.mutate(() => fns.starter({ data: { projectId, repo, branch, language } }))}>
              Add a starter workflow
            </Button>
          ) : null}
        </div>
      ) : null}
      <ul className="mt-2 space-y-1 font-mono text-[11px]">
        {(runs.data ?? []).map((r) => (
          <li key={r.id}>
            <div className="flex items-center gap-2">
              <button type="button" className="flex-1 truncate text-left hover:underline" onClick={() => setRunId(runId === r.id ? null : r.id)}>
                <span className={r.conclusion === "success" ? "text-primary" : r.conclusion ? "text-destructive" : "text-muted-foreground"}>●</span> {r.name} · {r.branch} · {r.conclusion ?? r.status}
              </button>
              {canEdit ? (
                <button type="button" aria-label="Re-run" onClick={() => act.mutate(() => fns.rerun({ data: { projectId, repo, runId: r.id } }))}>
                  <RotateCw className="size-3" />
                </button>
              ) : null}
            </div>
            {runId === r.id ? (
              <div className="ml-3 mt-1 space-y-1 text-muted-foreground">
                {(jobs.data ?? []).map((j) => (
                  <div key={j.id}>
                    <div className="text-foreground">{j.name} — {j.conclusion}</div>
                    {j.steps.map((s) => <div key={s.name} className="ml-2">{s.name}: {s.conclusion}</div>)}
                  </div>
                ))}
                <a href={r.url} target="_blank" rel="noreferrer" className="underline">Full logs on GitHub</a>
              </div>
            ) : null}
          </li>
        ))}
        {runs.data?.length === 0 ? <li className="text-muted-foreground">No workflow runs yet.</li> : null}
      </ul>
    </div>
  );
}
