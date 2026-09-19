import { supabase } from "@/integrations/supabase/client";

export type DomainRow = {
  id: string;
  project_id: string;
  hostname: string;
  verify_token: string;
  status: "pending" | "verified" | "misconfigured";
  last_checked_at: string | null;
  verified_at: string | null;
};

/** The address a custom domain must point at to reach Forge. */
export const FORGE_IP = "185.158.133.1";

export function normaliseHostname(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

export function isValidHostname(host: string) {
  return /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/.test(host);
}

export async function listDomains(projectId: string): Promise<DomainRow[]> {
  const { data, error } = await supabase
    .from("project_domains")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DomainRow[];
}

export async function addDomain(projectId: string, hostname: string) {
  const host = normaliseHostname(hostname);
  if (!isValidHostname(host)) throw new Error("That does not look like a domain name.");
  const { error } = await supabase.from("project_domains").insert({ project_id: projectId, hostname: host });
  if (error) {
    throw new Error(
      error.code === "23505" ? "That domain is already used by a project." : error.message,
    );
  }
}

export async function removeDomain(id: string) {
  const { error } = await supabase.from("project_domains").delete().eq("id", id);
  if (error) throw error;
}
