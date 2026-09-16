import { supabase } from "@/integrations/supabase/client";

export type MemberRole = "owner" | "editor" | "viewer";

export type MemberRow = {
  id: string;
  project_id: string;
  user_id: string | null;
  invited_email: string;
  role: "editor" | "viewer";
  status: "pending" | "accepted";
  created_at: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

export type PackageRow = {
  id: string;
  project_id: string;
  name: string;
  version: string | null;
};

export async function listMembers(projectId: string): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as MemberRow[];
  const ids = rows.map((row) => row.user_id).filter((id): id is string => Boolean(id));
  if (!ids.length) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((row) => {
    const profile = row.user_id ? byId.get(row.user_id) : undefined;
    return { ...row, display_name: profile?.display_name ?? null, avatar_url: profile?.avatar_url ?? null };
  });
}

export async function inviteMember(projectId: string, email: string, role: "editor" | "viewer") {
  const { error } = await supabase.rpc("invite_project_member", {
    _project_id: projectId,
    _email: email.trim().toLowerCase(),
    _role: role,
  });
  if (error) throw error;
}

export async function updateMemberRole(memberId: string, role: "editor" | "viewer") {
  const { error } = await supabase.from("project_members").update({ role }).eq("id", memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string) {
  const { error } = await supabase.from("project_members").delete().eq("id", memberId);
  if (error) throw error;
}

export async function listPackages(projectId: string): Promise<PackageRow[]> {
  const { data, error } = await supabase
    .from("project_packages")
    .select("*")
    .eq("project_id", projectId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PackageRow[];
}

export async function addPackage(projectId: string, name: string, version: string | null) {
  const { error } = await supabase
    .from("project_packages")
    .upsert(
      { project_id: projectId, name: name.trim(), version: version?.trim() || null },
      { onConflict: "project_id,name" },
    );
  if (error) throw error;
}

export async function removePackage(packageId: string) {
  const { error } = await supabase.from("project_packages").delete().eq("id", packageId);
  if (error) throw error;
}

/** CDN url used to make a declared package importable inside web previews. */
export function cdnUrlFor(pkg: PackageRow) {
  return `https://esm.sh/${pkg.name}${pkg.version ? `@${pkg.version}` : ""}`;
}
