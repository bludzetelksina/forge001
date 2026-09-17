import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES, languageById, type LanguageId } from "@/lib/languages";
import {
  createProjectFromTemplate,
  deleteProject,
  duplicateProject,
  listProjectsWithRole,
} from "@/lib/projects";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "My projects — Forge" },
      { name: "description", content: "Every project you have built and run on Forge." },
      { property: "og:title", content: "My projects — Forge" },
      { property: "og:description", content: "Every project you have built and run on Forge." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<LanguageId>("python");

  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const create = useMutation({
    mutationFn: () => createProjectFromTemplate(language, name),
    onSuccess: (project) => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/app/$projectId", params: { projectId: project.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      toast.success("Project deleted.");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copy = useMutation({
    mutationFn: duplicateProject,
    onSuccess: () => {
      toast.success("Project duplicated.");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">My projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up where you left off, or start something new.
        </p>

        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Project name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="sm:max-w-64"
          />
          <Select value={language} onValueChange={(value) => setLanguage(value as LanguageId)}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.id} value={lang.id}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="sm:ml-auto"
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            New project
          </Button>
        </div>

        <div className="mt-8">
          {projects.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading your projects…</p>
          ) : projects.data && projects.data.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.data.map((project) => (
                <li
                  key={project.id}
                  className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
                >
                  <Link
                    to="/app/$projectId"
                    params={{ projectId: project.id }}
                    className="block"
                  >
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-mono text-sm font-semibold">{project.name}</h2>
                      {project.is_public ? (
                        <Globe className="size-3.5 shrink-0 text-primary" aria-label="Public" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {languageById(project.language).label} ·{" "}
                      {new Date(project.updated_at).toLocaleDateString()} · {project.run_count} runs
                    </p>
                  </Link>
                  <div className="mt-4 flex gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copy.mutate(project.id)}
                      aria-label="Duplicate project"
                    >
                      <Copy className="size-3.5" /> Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                          remove.mutate(project.id);
                        }
                      }}
                      aria-label="Delete project"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No projects yet. Create one above or start from a{" "}
                <Link to="/templates" className="text-primary hover:underline">
                  template
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
