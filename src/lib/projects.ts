import { supabase } from "@/integrations/supabase/client";
import { languageById, type LanguageId } from "./languages";

export type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  language: string;
  template: string | null;
  entry_file: string;
  is_public: boolean;
  share_slug: string;
  run_count: number;
  created_at: string;
  updated_at: string;
};

export type FileRow = {
  id: string;
  project_id: string;
  path: string;
  content: string;
  sort_order: number;
};

async function requireUserId() {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("You need to be signed in.");
  return id;
}

export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectRow[];
}

export type ProjectWithRole = ProjectRow & { role: "owner" | "editor" | "viewer" };

/** Every project the signed-in person can open, tagged with what they may do. */
export async function listProjectsWithRole(): Promise<ProjectWithRole[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  const [projects, memberships] = await Promise.all([
    listProjects(),
    supabase.from("project_members").select("project_id, role").eq("status", "accepted"),
  ]);

  const roleByProject = new Map(
    (memberships.data ?? []).map((row) => [row.project_id as string, row.role as "editor" | "viewer"]),
  );

  return projects.map((project) => ({
    ...project,
    role:
      project.owner_id === userId
        ? ("owner" as const)
        : (roleByProject.get(project.id) ?? ("viewer" as const)),
  }));
}

/** What the signed-in person may do in one project. */
export async function getMyRole(project: ProjectRow): Promise<"owner" | "editor" | "viewer"> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  if (userId && project.owner_id === userId) return "owner";
  if (!userId) return "viewer";
  const { data } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", project.id)
    .eq("user_id", userId)
    .eq("status", "accepted")
    .maybeSingle();
  return (data?.role as "editor" | "viewer" | undefined) ?? "viewer";
}

export async function getProject(id: string): Promise<ProjectRow> {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function getProjectBySlug(slug: string): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("share_slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This project is private or does not exist.");
  return data as ProjectRow;
}

export async function listFiles(projectId: string): Promise<FileRow[]> {
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("path", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FileRow[];
}

export async function createProjectFromTemplate(
  languageId: LanguageId,
  name?: string,
): Promise<ProjectRow> {
  const spec = languageById(languageId);
  const ownerId = await requireUserId();

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: ownerId,
      name: name?.trim() || `${spec.label} project`,
      language: spec.id,
      template: spec.id,
      entry_file: spec.entry,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: filesError } = await supabase.from("project_files").insert(
    spec.files.map((file, index) => ({
      project_id: project.id,
      path: file.path,
      content: file.content,
      sort_order: index,
    })),
  );
  if (filesError) throw filesError;

  return project as ProjectRow;
}

export async function duplicateProject(projectId: string): Promise<ProjectRow> {
  const ownerId = await requireUserId();
  const source = await getProject(projectId);
  const files = await listFiles(projectId);

  const { data: copy, error } = await supabase
    .from("projects")
    .insert({
      owner_id: ownerId,
      name: `${source.name} copy`,
      language: source.language,
      template: source.template,
      entry_file: source.entry_file,
    })
    .select()
    .single();
  if (error) throw error;

  if (files.length) {
    const { error: filesError } = await supabase.from("project_files").insert(
      files.map((file) => ({
        project_id: copy.id,
        path: file.path,
        content: file.content,
        sort_order: file.sort_order,
      })),
    );
    if (filesError) throw filesError;
  }

  return copy as ProjectRow;
}

export async function renameProject(projectId: string, name: string) {
  const { error } = await supabase.from("projects").update({ name }).eq("id", projectId);
  if (error) throw error;
}

export async function setProjectVisibility(projectId: string, isPublic: boolean) {
  const { error } = await supabase
    .from("projects")
    .update({ is_public: isPublic })
    .eq("id", projectId);
  if (error) throw error;
}

export async function setEntryFile(projectId: string, entryFile: string) {
  const { error } = await supabase
    .from("projects")
    .update({ entry_file: entryFile })
    .eq("id", projectId);
  if (error) throw error;
}

export async function deleteProject(projectId: string) {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

export async function saveFile(fileId: string, content: string) {
  const { error } = await supabase.from("project_files").update({ content }).eq("id", fileId);
  if (error) throw error;
}

export async function createFile(projectId: string, path: string, sortOrder: number) {
  const { data, error } = await supabase
    .from("project_files")
    .insert({ project_id: projectId, path, content: "", sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data as FileRow;
}

export async function renameFile(fileId: string, path: string) {
  const { error } = await supabase.from("project_files").update({ path }).eq("id", fileId);
  if (error) throw error;
}

export async function deleteFile(fileId: string) {
  const { error } = await supabase.from("project_files").delete().eq("id", fileId);
  if (error) throw error;
}

export async function recordRun(input: {
  projectId: string;
  language: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  runCount: number;
}) {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;

  await supabase.from("runs").insert({
    project_id: input.projectId,
    user_id: userId,
    language: input.language,
    stdout: input.stdout.slice(0, 20_000),
    stderr: input.stderr.slice(0, 20_000),
    exit_code: input.exitCode,
    duration_ms: input.durationMs,
  });

  await supabase
    .from("projects")
    .update({ run_count: input.runCount + 1 })
    .eq("id", input.projectId);
}
