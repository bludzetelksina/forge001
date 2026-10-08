import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

async function resend(path: string, init?: RequestInit) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey || !resendKey) throw new Error("Email sending is not connected yet.");
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Email provider error (${res.status}): ${text.slice(0, 200)}`);
  return text ? (JSON.parse(text) as any) : null;
}

/** Registers the domain for sending (if needed) and returns the DNS records it requires and their status. */
export const checkEmailDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { domainId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: domain } = await context.supabase
      .from("project_domains")
      .select("hostname, project_id")
      .eq("id", data.domainId)
      .maybeSingle();
    if (!domain) throw new Error("Domain not found.");
    const { data: role } = await context.supabase.rpc("project_role", {
      _project_id: domain.project_id,
      _user_id: context.userId,
    });
    if (role !== "owner") throw new Error("Only the owner can set up email.");

    const list = await resend("/domains");
    let found = ((list?.data ?? []) as any[]).find((d) => d.name === domain.hostname);
    if (!found) found = await resend("/domains", { method: "POST", body: JSON.stringify({ name: domain.hostname }) });
    else await resend(`/domains/${found.id}/verify`, { method: "POST" }).catch(() => undefined);
    const detail = await resend(`/domains/${found.id}`);
    return {
      status: String(detail?.status ?? "pending"),
      records: ((detail?.records ?? []) as any[]).map((r) => ({
        type: String(r.type),
        name: String(r.name),
        value: String(r.value),
        status: String(r.status ?? "pending"),
      })),
    };
  });
