import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronLeft,
  FilePlus2,
  Globe,
  Loader2,
  Monitor,
  Pencil,
  Play,
  Terminal,
  Trash2,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { toast } from "sonner";

import OutputConsole from "@/components/OutputConsole";
import WebPreview from "@/components/WebPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { editorLanguageFor, languageById } from "@/lib/languages";
import {
  createFile,
  deleteFile,
  getProject,
  listFiles,
  recordRun,
  renameFile,
  renameProject,
  saveFile,
  setEntryFile,
  setProjectVisibility,
  type FileRow,
} from "@/lib/projects";
import { runCode, type RunResult } from "@/lib/run.functions";

const CodeEditor = lazy(() => import("@/components/CodeEditor"));

export const Route = createFileRoute("/_authenticated/app/$projectId")({
  head: () => ({
    meta: [
      { title: "Workspace — Forge" },
      { name: "description", content: "Edit, run and share your Forge project." },
      { property: "og:title", content: "Workspace — Forge" },
      { property: "og:description", content: "Edit, run and share your Forge project." },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const run = useServerFn(runCode);

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });
  const filesQuery = useQuery({
    queryKey: ["files", projectId],
    queryFn: () => listFiles(projectId),
  });

  const project = projectQuery.data;
  const files = useMemo(() => filesQuery.data ?? [], [filesQuery.data]);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftsRef = useRef<Record<string, string>>({});
  const dirtyRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [stdin, setStdin] = useState("");
  const [panel, setPanel] = useState<"console" | "preview">("console");
  const [previewKey, setPreviewKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [nameDraft, setNameDraft] = useState("");

  const spec = project ? languageById(project.language) : null;
  const isWeb = spec?.runner === null;

  useEffect(() => {
    if (project) setNameDraft(project.name);
  }, [project?.id, project?.name]);

  useEffect(() => {
    if (isWeb) setPanel("preview");
  }, [isWeb]);

  useEffect(() => {
    if (!files.length || activeId) return;
    const entry = files.find((f) => f.path === project?.entry_file) ?? files[0]!;
    setActiveId(entry.id);
    setOpenIds([entry.id]);
  }, [files, activeId, project?.entry_file]);

  const contentOf = useCallback(
    (file: FileRow) => draftsRef.current[file.id] ?? drafts[file.id] ?? file.content,
    [drafts],
  );

  const flushSaves = useCallback(async () => {
    const ids = Array.from(dirtyRef.current);
    if (!ids.length) return;
    dirtyRef.current.clear();
    setSaving(true);
    try {
      await Promise.all(
        ids.map((id) => {
          const content = draftsRef.current[id];
          return content === undefined ? Promise.resolve() : saveFile(id, content);
        }),
      );
      queryClient.setQueryData<FileRow[]>(["files", projectId], (old) =>
        (old ?? []).map((file) =>
          ids.includes(file.id) ? { ...file, content: draftsRef.current[file.id] ?? file.content } : file,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [projectId, queryClient]);

  const handleChange = useCallback(
    (fileId: string, next: string) => {
      draftsRef.current = { ...draftsRef.current, [fileId]: next };
      setDrafts((current) => ({ ...current, [fileId]: next }));
      dirtyRef.current.add(fileId);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flushSaves(), 900);
    },
    [flushSaves],
  );

  useEffect(() => () => void flushSaves(), [flushSaves]);

  const doRun = useCallback(async () => {
    if (!project || !spec) return;
    await flushSaves();

    if (!spec.runner) {
      setPreviewKey((key) => key + 1);
      setPanel("preview");
      return;
    }

    const entry = files.find((f) => f.path === project.entry_file) ?? files[0];
    if (!entry) {
      toast.error("Add a file to run.");
      return;
    }

    setRunning(true);
    setPanel("console");
    try {
      const output = await run({
        data: { runner: spec.runner, source: contentOf(entry), stdin },
      });
      setResult(output);
      await recordRun({
        projectId: project.id,
        language: project.language,
        stdout: output.stdout,
        stderr: output.stderr,
        exitCode: output.exitCode,
        durationMs: output.durationMs,
        runCount: project.run_count,
      });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (error) {
      setResult({
        stdout: "",
        stderr: error instanceof Error ? error.message : "The run failed.",
        exitCode: null,
        durationMs: 0,
        timedOut: false,
      });
    } finally {
      setRunning(false);
    }
  }, [project, spec, files, stdin, run, contentOf, flushSaves, queryClient, projectId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key === "s") {
        event.preventDefault();
        void flushSaves();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        void doRun();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doRun, flushSaves]);

  if (projectQuery.isError) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <p className="text-sm text-muted-foreground">This project could not be opened.</p>
          <Button asChild className="mt-4" variant="secondary">
            <Link to="/app">Back to my projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeFile = files.find((f) => f.id === activeId) ?? null;
  const openFiles = openIds
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is FileRow => Boolean(f));

  function openFile(file: FileRow) {
    setActiveId(file.id);
    setOpenIds((ids) => (ids.includes(file.id) ? ids : [...ids, file.id]));
  }

  async function addFile() {
    const path = prompt("New file name (e.g. helpers.py)")?.trim();
    if (!path) return;
    try {
      const file = await createFile(projectId, path, files.length);
      await queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      openFile(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the file.");
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-chrome px-3">
        <Button asChild size="icon" variant="ghost" aria-label="Back to projects">
          <Link to="/app">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <Input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={async () => {
            const next = nameDraft.trim();
            if (!next || next === project.name) return;
            await renameProject(projectId, next);
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
          }}
          className="h-8 w-48 border-transparent bg-transparent font-mono text-sm focus-visible:border-input"
          aria-label="Project name"
        />

        <span className="hidden rounded-md border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground sm:inline">
          {spec?.label}
        </span>

        <span className="font-mono text-xs text-muted-foreground">
          {saving ? "saving…" : "saved"}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <label className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <Globe className="size-3.5" />
            Public
            <Switch
              checked={project.is_public}
              onCheckedChange={async (checked) => {
                await setProjectVisibility(projectId, checked);
                queryClient.invalidateQueries({ queryKey: ["project", projectId] });
                if (checked) {
                  const url = `${window.location.origin}/p/${project.share_slug}`;
                  await navigator.clipboard.writeText(url).catch(() => undefined);
                  toast.success("Share link copied to your clipboard.");
                }
              }}
            />
          </label>
          <Button onClick={() => void doRun()} disabled={running} size="sm">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Run
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {sidebarOpen ? (
          <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-sidebar">
            <div className="flex items-center gap-1 border-b border-border px-3 py-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Files
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto size-7"
                onClick={() => void addFile()}
                aria-label="New file"
              >
                <FilePlus2 className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => setSidebarOpen(false)}
                aria-label="Hide files"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
            </div>
            <ul className="flex-1 overflow-auto p-1.5">
              {files.map((file) => (
                <li key={file.id}>
                  <div
                    className={`group flex items-center gap-1 rounded-md px-2 py-1.5 font-mono text-xs ${
                      file.id === activeId
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex-1 truncate text-left"
                      onClick={() => openFile(file)}
                    >
                      {file.path}
                      {file.path === project.entry_file ? (
                        <span className="ml-1 text-primary">▸</span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      aria-label={`Rename ${file.path}`}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={async () => {
                        const next = prompt("Rename file", file.path)?.trim();
                        if (!next || next === file.path) return;
                        await renameFile(file.id, next);
                        if (file.path === project.entry_file) await setEntryFile(projectId, next);
                        queryClient.invalidateQueries({ queryKey: ["files", projectId] });
                        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
                      }}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${file.path}`}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={async () => {
                        if (files.length === 1) {
                          toast.error("A project needs at least one file.");
                          return;
                        }
                        if (!confirm(`Delete ${file.path}?`)) return;
                        await deleteFile(file.id);
                        setOpenIds((ids) => ids.filter((id) => id !== file.id));
                        if (activeId === file.id) setActiveId(null);
                        queryClient.invalidateQueries({ queryKey: ["files", projectId] });
                      }}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-border p-3">
              <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                ▸ marks the file that Run executes.
              </p>
            </div>
          </aside>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="w-8 shrink-0 border-r border-border bg-sidebar font-mono text-xs text-muted-foreground hover:text-foreground"
            aria-label="Show files"
          >
            ›
          </button>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-chrome">
            {openFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => setActiveId(file.id)}
                className={`flex items-center border-r border-border px-3 font-mono text-xs ${
                  file.id === activeId
                    ? "bg-editor text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {file.path}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 bg-editor">
            {activeFile ? (
              <ClientOnly fallback={<div className="p-4 text-sm text-muted-foreground">Loading editor…</div>}>
                <Suspense
                  fallback={<div className="p-4 text-sm text-muted-foreground">Loading editor…</div>}
                >
                  <CodeEditor
                    key={activeFile.id}
                    value={contentOf(activeFile)}
                    language={editorLanguageFor(activeFile.path)}
                    onChange={(next) => handleChange(activeFile.id, next)}
                  />
                </Suspense>
              </ClientOnly>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Select a file to start editing.</p>
            )}
          </div>
        </section>

        <section className="flex w-[38%] min-w-72 shrink-0 flex-col border-l border-border">
          <div className="flex h-9 shrink-0 items-stretch border-b border-border bg-chrome">
            <button
              type="button"
              onClick={() => setPanel("console")}
              className={`flex items-center gap-1.5 border-r border-border px-3 font-mono text-xs ${
                panel === "console" ? "bg-editor text-foreground" : "text-muted-foreground"
              }`}
            >
              <Terminal className="size-3" /> Console
            </button>
            {isWeb ? (
              <button
                type="button"
                onClick={() => setPanel("preview")}
                className={`flex items-center gap-1.5 border-r border-border px-3 font-mono text-xs ${
                  panel === "preview" ? "bg-editor text-foreground" : "text-muted-foreground"
                }`}
              >
                <Monitor className="size-3" /> Preview
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1">
            {panel === "preview" && isWeb ? (
              <WebPreview
                refreshKey={previewKey}
                files={files.map((file) => ({ path: file.path, content: contentOf(file) }))}
              />
            ) : (
              <OutputConsole result={result} running={running} />
            )}
          </div>

          {!isWeb ? (
            <div className="shrink-0 border-t border-border bg-chrome p-3">
              <label
                htmlFor="stdin"
                className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
              >
                Program input (stdin)
              </label>
              <Textarea
                id="stdin"
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                rows={2}
                placeholder="Typed here, read by input() / stdin"
                className="mt-1.5 resize-none bg-editor font-mono text-xs"
              />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
