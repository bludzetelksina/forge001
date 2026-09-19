import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FORGE_IP = "185.158.133.1";

type DnsAnswer = { name: string; type: number; data: string };

async function resolve(name: string, type: "A" | "TXT"): Promise<string[]> {
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { Answer?: DnsAnswer[] };
  return (body.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ""));
}

/** Checks live DNS for one domain and stores the resulting status. */
export const verifyDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { domainId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("project_domains")
      .select("id, hostname, verify_token")
      .eq("id", data.domainId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("That domain is no longer set up here.");

    const [aRecords, txtRecords] = await Promise.all([
      resolve(row.hostname, "A"),
      resolve(`_forge.${row.hostname}`, "TXT"),
    ]);

    const pointsHere = aRecords.includes(FORGE_IP);
    const proven = txtRecords.some((value) => value.includes(`forge-verify=${row.verify_token}`));
    const status = pointsHere && proven ? "verified" : aRecords.length || txtRecords.length ? "misconfigured" : "pending";

    const now = new Date().toISOString();
    await context.supabase
      .from("project_domains")
      .update({
        status,
        last_checked_at: now,
        verified_at: status === "verified" ? now : null,
      })
      .eq("id", row.id);

    return { status, pointsHere, proven, aRecords, txtFound: txtRecords.length > 0 };
  });
