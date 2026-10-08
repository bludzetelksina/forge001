import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronLeft,
  Globe,
  Loader2,
  Monitor,
  Play,
  Terminal,
  Users,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { toast } from "sonner";

import CloudPanel from "@/components/CloudPanel";
import DeveloperPanel, { listEnv } from "@/components/DeveloperPanel";
import SettingsPanel, { vmMemoryFor } from "@/components/SettingsPanel";
import FileTree from "@/components/FileTree";
import GitPanel from "@/components/GitPanel";
import MembersPanel from "@/components/MembersPanel";
import OutputConsole from "@/components/OutputConsole";
import PackagesPanel from "@/components/PackagesPanel";
import PresenceBar from "@/components/PresenceBar";
import WebPreview from "@/components/WebPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listMembers, listPackages, packageUrlFor } from "@/lib/collab";
import { useProjectPresence } from "@/lib/presence";
import { getRegistry } from "@/lib/registry.functions";
import { editorLanguageFor, languageById } from "@/lib/languages";
import {
  createFile,
  deleteFile,
  duplicateFile,
  getMyRole,
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
const ShellPanel = lazy(() => import("@/components/ShellPanel"));

type Tool = "console" | "preview" | "shell" | "developer" | "cloud" | "settings";
const TOOLS: Tool[] = ["console", "preview", "shell", "developer", "cloud", "settings"];

export const Route = createFileRoute("/_authenticated/app/$projectId")({
  head: () => ({
    meta: [
      { title: "Workspace — Forge" },
      { name: "description", content: "Edit, run and share your Forge project." },
      { property: "og:title", content: "Workspace — Forge" },
      { property: "og:description", content: "Edit, run and share your Forge project." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { tool?: Tool } =>
    TOOLS.includes(search["tool"] as Tool) ? { tool: search["tool"] as Tool } : {},
  component: Workspace,
});

type SidePanel = "files" | "packages" | "members" | "git";


function Workspace() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
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

  const roleQuery = useQuery({
    queryKey: ["role", projectId],
    queryFn: () => getMyRole(project!),
    enabled: Boolean(project),
  });
  const role = roleQuery.data ?? "viewer";
  const canEdit = role === "owner" || role === "editor";
  const isOwner = role === "owner";

  const packagesQuery = useQuery({
    queryKey: ["packages", projectId],
    queryFn: () => listPackages(projectId),
  });
  const membersQuery = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => listMembers(projectId),
  });

  const readRegistry = useServerFn(getRegistry);
  const registryQuery = useQuery({
    queryKey: ["registry", projectId],
    queryFn: () => readRegistry({ data: { projectId } }),
  });
  const registry = registryQuery.data?.configured
    ? { scope: registryQuery.data.scope ?? null }
    : null;


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
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const panel: Tool = search.tool ?? "console";
  const setPanel = useCallback(
    (tool: Tool) => void navigate({ search: { tool }, replace: true }),
    [navigate],
  );
  const [shellStarted, setShellStarted] = useState(false);
  useEffect(() => {
    if (panel === "shell") setShellStarted(true);
  }, [panel]);
  const [side, setSide] = useState<SidePanel>("files");
  const [previewKey, setPreviewKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [cursor, setCursor] = useState({ anchor: 0, head: 0 });

  const spec = project ? languageById(project.language) : null;
  const isWeb = spec?.id === "web";

  /* Who else is in this project, and where their cursor sits. */
  const { user } = useAuth();
  const activePath = useMemo(
    () => files.find((file) => file.id === activeId)?.path ?? null,
    [files, activeId],
  );
  const { peers } = useProjectPresence(
    projectId,
    {
      userId: user?.id ?? null,
      name:
        (user?.user_metadata?.['display_name'] as string | undefined) ??
        user?.email?.split("@")[0] ??
        "Someone",
    },
    { filePath: activePath, anchor: cursor.anchor, head: cursor.head },
  );
  const remoteCursors = useMemo(
    () =>
      peers
        .filter((peer) => peer.filePath && peer.filePath === activePath)
        .map((peer) => ({
          userId: peer.userId,
          name: peer.name,
          colour: peer.colour,
          anchor: peer.anchor ?? 0,
          head: peer.head ?? 0,
        })),
    [peers, activePath],
  );


  useEffect(() => {
    if (project) setNameDraft(project.name);
  }, [project?.id, project?.name]);

  useEffect(() => {
    if (search.tool || !project) return;
    if (project.language === "vm") setPanel("shell");
    else if (isWeb) setPanel("preview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWeb, project?.language]);

  const envQuery = useQuery({
    queryKey: ["env", projectId],
    queryFn: () => listEnv(projectId),
    enabled: canEdit,
  });

  useEffect(() => {
    if (!files.length || activeId) return;
    const entry = files.find((f) => f.path === project?.entry_file) ?? files[0]!;
    setActiveId(entry.id);
    setOpenIds([entry.id]);
  }, [files, activeId, project?.entry_file]);

  /* Live refresh when a collaborator saves. */
  useEffect(() => {
    const channel = supabase
      .channel(`project-files-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_files", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const changed = (payload.new ?? payload.old) as { id?: string } | null;
          if (changed?.id && dirtyRef.current.has(changed.id)) return;
          queryClient.invalidateQueries({ queryKey: ["files", projectId] });
          if (changed?.id && draftsRef.current[changed.id] !== undefined) {
            const next = { ...draftsRef.current };
            delete next[changed.id];
            draftsRef.current = next;
            setDrafts(next);
          }
          toast.message("This project was updated by someone else.");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);

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
      if (!canEdit) return;
      draftsRef.current = { ...draftsRef.current, [fileId]: next };
      setDrafts((current) => ({ ...current, [fileId]: next }));
      dirtyRef.current.add(fileId);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flushSaves(), 900);
    },
    [flushSaves, canEdit],
  );

  useEffect(() => () => void flushSaves(), [flushSaves]);

  const doRun = useCallback(async () => {
    if (!project || !spec) return;
    await flushSaves();

    if (spec.id === "vm") {
      setPanel("shell");
      return;
    }
    if (!spec.runner) {
      setPreviewKey((key) => key + 1);
      setPanel("preview");
      return;
    }

    if (!files.length) {
      toast.error("Add a file to run.");
      return;
    }

    setRunning(true);
    setPanel("console");
    try {
      const output = await run({
        data: {
          runner: spec.runner,
          language: project.language,
          entry: project.entry_file,
          files: files.map((file) => ({ path: file.path, content: contentOf(file) })),
          packages: (packagesQuery.data ?? []).map((pkg) => ({ name: pkg.name, version: pkg.version })),
          stdin,
          projectId,
          env: Object.fromEntries((envQuery.data ?? []).map((row) => [row.key, row.value])),
        },
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
  }, [
    project,
    spec,
    files,
    stdin,
    run,
    contentOf,
    flushSaves,
    queryClient,
    projectId,
    packagesQuery.data,
    envQuery.data,
    setPanel,
  ]);

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

  async function withRefresh(action: () => Promise<unknown>) {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That change could not be saved.");
    }
  }

  const memberCount = membersQuery.data?.length ?? 0;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-chrome px-3 sm:gap-3">
        <Button asChild size="icon" variant="ghost" aria-label="Back to projects">
          <Link to="/app">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <Input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          readOnly={!canEdit}
          onBlur={async () => {
            const next = nameDraft.trim();
            if (!canEdit || !next || next === project.name) return;
            await renameProject(projectId, next);
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
          }}
          className="h-8 w-36 border-transparent bg-transparent font-mono text-sm focus-visible:border-input sm:w-48"
          aria-label="Project name"
        />

        <span className="hidden rounded-md border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground sm:inline">
          {spec?.label}
        </span>

        <span className="font-mono text-xs text-muted-foreground">
          {!canEdit ? "read-only" : saving ? "saving…" : "saved"}
        </span>

        <div className="ml-auto flex items-center gap-3">
          {memberCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(true);
                setSide("members");
              }}
              className="hidden items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground md:flex"
            >
              <Users className="size-3.5" />
              {memberCount}
            </button>
          ) : null}

          {isOwner ? (
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
          ) : null}

          <Button onClick={() => void doRun()} disabled={running} size="sm">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Run
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {sidebarOpen ? (
          <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
            <div className="flex items-stretch overflow-x-auto border-b border-border">
              {(["files", "packages", "members", "git"] as SidePanel[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSide(tab)}
                  className={`flex-1 px-2 py-2 font-mono text-[11px] uppercase tracking-widest ${
                    side === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Hide sidebar"
                className="px-2 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-3.5" />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              {side === "files" ? (
                <FileTree
                  files={files}
                  activeId={activeId}
                  entryPath={project.entry_file}
                  canEdit={canEdit}
                  onOpen={openFile}
                  onCreate={(path) =>
                    void withRefresh(async () => {
                      const file = await createFile(projectId, path, files.length);
                      openFile(file);
                    })
                  }
                  onRename={(file, path) =>
                    void withRefresh(async () => {
                      await renameFile(file.id, path);
                      if (file.path === project.entry_file) await setEntryFile(projectId, path);
                    })
                  }
                  onDuplicate={(file) =>
                    void withRefresh(() =>
                      duplicateFile(file, `${file.path.replace(/(\.[^./]+)?$/, "")}-copy${file.path.match(/\.[^./]+$/)?.[0] ?? ""}`, files.length),
                    )
                  }
                  onDelete={(file) =>
                    void withRefresh(async () => {
                      if (files.length === 1) throw new Error("A project needs at least one file.");
                      if (!confirm(`Delete ${file.path}?`)) return;
                      await deleteFile(file.id);
                      setOpenIds((ids) => ids.filter((id) => id !== file.id));
                      if (activeId === file.id) setActiveId(null);
                    })
                  }
                  onSetEntry={(file) => void withRefresh(() => setEntryFile(projectId, file.path))}
                />
              ) : side === "packages" ? (
                <PackagesPanel
                  projectId={projectId}
                  language={project.language}
                  canEdit={canEdit}
                  isOwner={isOwner}
                />
              ) : side === "members" ? (
                <MembersPanel projectId={projectId} isOwner={isOwner} />
              ) : (
                <GitPanel projectId={projectId} projectName={project.name} canEdit={canEdit} language={project.language} />
              )}
            </div>
          </aside>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="w-8 shrink-0 border-r border-border bg-sidebar font-mono text-xs text-muted-foreground hover:text-foreground"
            aria-label="Show sidebar"
          >
            ›
          </button>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <PresenceBar peers={peers} />
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
                    readOnly={!canEdit}
                    onChange={(next) => handleChange(activeFile.id, next)}
                    remoteCursors={remoteCursors}
                    onCursor={(range) => setCursor(range)}
                  />
                </Suspense>
              </ClientOnly>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Select a file to start editing.</p>
            )}
          </div>
        </section>

        <section className="flex w-[38%] min-w-72 shrink-0 flex-col border-l border-border">
          <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-chrome" role="tablist" aria-label="Tools">
            {TOOLS.filter((tool) => tool !== "preview" || isWeb).map((tool) => (
              <button
                key={tool}
                type="button"
                role="tab"
                aria-selected={panel === tool}
                onClick={() => setPanel(tool)}
                className={`flex items-center gap-1.5 border-r border-border px-3 font-mono text-xs capitalize ${
                  panel === tool ? "bg-editor text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tool === "console" ? <Terminal className="size-3" /> : tool === "preview" ? <Monitor className="size-3" /> : null}
                {tool}
              </button>
            ))}
          </div>

          <div className="relative min-h-0 flex-1">
            {shellStarted ? (
              <div className={panel === "shell" ? "absolute inset-0" : "hidden"}>
                <ClientOnly fallback={null}>
                  <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading shell…</div>}>
                    <ShellPanel projectId={projectId} memoryMb={vmMemoryFor(projectId)} />
                  </Suspense>
                </ClientOnly>
              </div>
            ) : null}
            {panel === "preview" && isWeb ? (
              <WebPreview
                refreshKey={previewKey}
                files={files.map((file) => ({ path: file.path, content: contentOf(file) }))}
                packages={(packagesQuery.data ?? []).map((pkg) => ({
                  name: pkg.name,
                  url: packageUrlFor(pkg, registry, projectId),
                }))}
              />
            ) : panel === "console" ? (
              <OutputConsole result={result} running={running} />
            ) : panel === "developer" ? (
              <DeveloperPanel projectId={projectId} canEdit={canEdit} result={result} running={running} />
            ) : panel === "cloud" ? (
              <CloudPanel project={project} isOwner={isOwner} isWeb={Boolean(isWeb)} />
            ) : panel === "settings" ? (
              <SettingsPanel project={project} files={files} canEdit={canEdit} isOwner={isOwner} />
            ) : null}
          </div>

          {!isWeb && panel === "console" ? (
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
