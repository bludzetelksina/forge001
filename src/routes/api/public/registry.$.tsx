import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
};

/**
 * Fetches one file from a project's private package registry using the token
 * stored server-side. The token never reaches the browser.
 */
export const Route = createFileRoute("/api/public/registry/$")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params, request }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        const [projectId, ...rest] = splat.split("/");
        const target = rest.join("/");
        if (!projectId || !target) {
          return new Response("Not found", { status: 404, headers: CORS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: registry } = await supabaseAdmin
          .from("project_registries")
          .select("registry_url, scope, token_ciphertext")
          .eq("project_id", projectId)
          .maybeSingle();
        if (!registry) {
          return new Response("No registry configured for this project.", { status: 404, headers: CORS });
        }
        if (registry.scope && !target.startsWith(registry.scope)) {
          return new Response("Only packages in this project's registry scope can be loaded.", {
            status: 403,
            headers: CORS,
          });
        }

        const headers = new Headers({ accept: request.headers.get("accept") ?? "*/*" });
        if (registry.token_ciphertext) {
          const { decryptSecret } = await import("@/lib/connectionKeyCrypto.server");
          headers.set("Authorization", `Bearer ${decryptSecret(registry.token_ciphertext)}`);
        }

        const upstream = await fetch(`${registry.registry_url}/${target}`, { headers });
        const body = await upstream.arrayBuffer();
        return new Response(body, {
          status: upstream.status,
          headers: {
            ...CORS,
            "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
