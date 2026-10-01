import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RoleClient = {
  rpc: (name: "project_role", args: { _project_id: string; _user_id: string }) => PromiseLike<{
    data: unknown;
  }>;
};

async function assertRole(
  supabase: RoleClient,
  projectId: string,
  userId: string,
  allowed: string[],
) {
  const { data } = await supabase.rpc("project_role", { _project_id: projectId, _user_id: userId });
  const role = typeof data === "string" ? data : "none";
  if (!allowed.includes(role)) throw new Error("You do not have permission to do that.");
  return role;
}


/** Registry details safe to show in the browser — never the token itself. */
export const getRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.projectId, context.userId, ["owner", "editor", "viewer"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("project_registries")
      .select("id, registry_url, scope, token_ciphertext")
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (!row) return { configured: false as const };
    return {
      configured: true as const,
      registryUrl: row.registry_url,
      scope: row.scope,
      hasToken: Boolean(row.token_ciphertext),
    };
  });

export const saveRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; registryUrl: string; scope: string; token: string }) => input)
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.projectId, context.userId, ["owner"]);

    const url = data.registryUrl.trim().replace(/\/$/, "");
    if (!/^https:\/\/[^\s]+$/.test(url)) throw new Error("The registry address must start with https://");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("./connectionKeyCrypto.server");

    const token = data.token.trim();
    const patch = {
      project_id: data.projectId,
      registry_url: url,
      scope: data.scope.trim() || null,
      created_by: context.userId,
      ...(token ? { token_ciphertext: encryptSecret(token) } : {}),
    };

    const { error } = await supabaseAdmin
      .from("project_registries")
      .upsert(patch, { onConflict: "project_id" });
    if (error) throw error;
    return { ok: true };
  });

export const removeRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertRole(context.supabase, data.projectId, context.userId, ["owner"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("project_registries").delete().eq("project_id", data.projectId);
    return { ok: true };
  });
