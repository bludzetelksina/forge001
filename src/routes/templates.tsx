import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LANGUAGES, type LanguageId } from "@/lib/languages";
import { createProjectFromTemplate } from "@/lib/projects";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Starter templates — Forge" },
      {
        name: "description",
        content:
          "Start a Python, Go, Rust, TypeScript, Java, C++ or web project with one click and run it instantly.",
      },
      { property: "og:title", content: "Starter templates — Forge" },
      {
        property: "og:description",
        content: "One-click starters for ten languages, runnable straight from the browser.",
      },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const create = useMutation({
    mutationFn: (id: LanguageId) => createProjectFromTemplate(id),
    onSuccess: (project) => navigate({ to: "/app/$projectId", params: { projectId: project.id } }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-bold">Starter templates</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Every template opens in the workspace with runnable code already written. Change it, hit
          Run, see real output.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANGUAGES.map((lang) => (
            <li
              key={lang.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
            >
              <span className="font-mono text-xs uppercase tracking-widest text-primary">
                {lang.runner ? "runs on a server" : "runs in your browser"}
              </span>
              <h2 className="mt-3 text-lg font-bold">{lang.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{lang.blurb}</p>
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                {lang.files.map((f) => f.path).join("  ·  ")}
              </p>
              <Button
                className="mt-5"
                variant="secondary"
                disabled={create.isPending}
                onClick={() => {
                  if (!user) {
                    navigate({ to: "/auth" });
                    return;
                  }
                  create.mutate(lang.id);
                }}
              >
                {create.isPending && create.variables === lang.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                Use this template
              </Button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
