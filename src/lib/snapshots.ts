import { supabase } from "@/integrations/supabase/client";
import { snapshotsToPrune } from "./changelog";
import type { FileRow } from "./projects";

export type SnapshotFile = { path: string; content: string };
export type SnapshotRow = { id: string; label: string; created_at: string; files: SnapshotFile[] };

export async function listSnapshots(projectId: string): Promise<SnapshotRow[]> {
  const { data, error } = await supabase
    .from("project_snapshots")
    .select("id,label,created_at,files")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as unknown as SnapshotRow[];
}

export async function createSnapshot(projectId: string, files: SnapshotFile[], label: string) {
  const { error } = await supabase
    .from("project_snapshots")
    .insert({ project_id: projectId, files: files as never, label });
  if (error) throw error;
  const all = await listSnapshots(projectId);
  const old = snapshotsToPrune(all, 30).map((s) => s.id);
  if (old.length) await supabase.from("project_snapshots").delete().in("id", old);
}

/** Overwrite matching files and recreate missing ones. */
export async function restoreSnapshot(projectId: string, snap: SnapshotRow, current: FileRow[]) {
  for (const [i, f] of snap.files.entries()) {
    const existing = current.find((c) => c.path === f.path);
    if (existing) {
      const { error } = await supabase.from("project_files").update({ content: f.content }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("project_files")
        .insert({ project_id: projectId, path: f.path, content: f.content, sort_order: current.length + i });
      if (error) throw error;
    }
  }
}
