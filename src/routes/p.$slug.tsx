import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2, Play } from "lucide-react";
import { Suspense, lazy, useState } from "react";

import OutputConsole from "@/components/OutputConsole";
import WebPreview from "@/components/WebPreview";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { editorLanguageFor, languageById } from "@/lib/languages";
import { getProjectBySlug, listFiles, type FileRow } from "@/lib/projects";
import { runCode, type RunResult } from "@/lib/run.functions";

const CodeEditor = lazy(() => import("@/components/CodeEditor"));

export const Route = createFileRoute("/p/$slug")({
  head: () => ({
    meta: [
      { title: "Shared project — Forge" },
      { name: "description", content: "A project shared on Forge. Read the code and run it." },
      { property: "og:title", content: "Shared project — Forge" },
      {
        property: "og:description",
        content: "A project shared on Forge. Read the code and run it.",
      },
    ],
  }),
  component: SharedProject,
});

function SharedProject() {
  const { slug } = Route.useParams();
  const run = useServerFn(runCode);

  const projectQuery = useQuery({
    queryKey: ["shared-project", slug],
    queryFn: () => getProjectBySlug(slug),
    retry: false,
  });
  const project = projectQuery.data;

  const filesQuery = useQuery({
    queryKey: ["shared-files", project?.id],
    queryFn: () => listFiles(project!.id),
    enabled: Boolean(project?.id),
  });

  const packagesQuery = useQuery({
    queryKey: ["shared-packages", project?.id],
    queryFn: () => listPackages(project!.id),
    enabled: Boolean(project?.id),
  });

  const files: FileRow[] = filesQuery.data ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  const spec = project ? languageById(project.language) : null;
  const active = files.find((f) => f.id === activeId) ?? files[0] ?? null;

  async function doRun() {
    if (!project || !spec?.runner || !files.length) return;
    setRunning(true);
    try {
      setResult(
        await run({
          data: {
            runner: spec.runner,
            language: project.language,
            entry: project.entry_file,
            files: files.map((f) => ({ path: f.path, content: f.content })),
            packages: (packagesQuery.data ?? []).map((p) => ({ name: p.name, version: p.version })),
          },
        }),
      );
    } finally {
      setRunning(false);
    }
  }

  if (projectQuery.isError) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl font-bold">This project isn't shared</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The link may be wrong, or the owner turned sharing off.
          </p>
          <Button asChild className="mt-6" variant="secondary">
            <Link to="/">Go home</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {!project ? (
        <div className="grid flex-1 place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-bold">{project.name}</h1>
            <span className="rounded-md border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {spec?.label}
            </span>
            <span className="text-xs text-muted-foreground">read-only</span>
            {spec?.runner ? (
              <Button size="sm" className="ml-auto" onClick={() => void doRun()} disabled={running}>
                {running ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Run
              </Button>
            ) : null}
          </div>

          <div className="mt-6 grid min-h-[28rem] flex-1 gap-4 lg:grid-cols-2">
            <div className="flex min-h-96 flex-col overflow-hidden rounded-xl border border-border">
              <div className="flex shrink-0 items-stretch overflow-x-auto border-b border-border bg-chrome">
                {files.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setActiveId(file.id)}
                    className={`border-r border-border px-3 py-2 font-mono text-xs ${
                      file.id === active?.id
                        ? "bg-editor text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {file.path}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 bg-editor">
                {active ? (
                  <ClientOnly fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
                    <Suspense
                      fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}
                    >
                      <CodeEditor
                        key={active.id}
                        value={active.content}
                        language={editorLanguageFor(active.path)}
                        readOnly
                      />
                    </Suspense>
                  </ClientOnly>
                ) : null}
              </div>
            </div>

            <div className="min-h-96 overflow-hidden rounded-xl border border-border">
              {spec?.runner ? (
                <OutputConsole result={result} running={running} />
              ) : (
                <WebPreview files={files.map((f) => ({ path: f.path, content: f.content }))} />
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
