import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const HOURLY_CAP = 30;

const formSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(1).max(5000),
});

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Receives contact forms from sites served on a verified custom domain and emails the owner. */
export const Route = createFileRoute("/api/public/forms/$domain")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const hostname = params.domain.toLowerCase();
        const type = request.headers.get("content-type") ?? "";
        const raw = type.includes("application/json")
          ? await request.json().catch(() => ({}))
          : Object.fromEntries((await request.formData().catch(() => new FormData())).entries());
        const parsed = formSchema.safeParse(raw);
        if (!parsed.success) return new Response("Please fill in your email and a message.", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: domain } = await supabaseAdmin
          .from("project_domains")
          .select("id, status")
          .eq("hostname", hostname)
          .maybeSingle();
        if (!domain || domain.status !== "verified") return new Response("Unknown site.", { status: 404 });

        const { data: settings } = await supabaseAdmin
          .from("domain_email")
          .select("id, enabled, to_address, sent_this_hour, hour_start")
          .eq("domain_id", domain.id)
          .maybeSingle();
        if (!settings?.enabled || !settings.to_address) return new Response("Email is off for this site.", { status: 403 });

        const fresh = Date.now() - new Date(settings.hour_start).getTime() > 3_600_000;
        const sent = fresh ? 0 : settings.sent_this_hour;
        if (sent >= HOURLY_CAP) return new Response("Too many messages this hour. Try later.", { status: 429 });

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const resendKey = process.env["RESEND_API_KEY"];
        if (!lovableKey || !resendKey) return new Response("Email is not set up yet.", { status: 503 });

        const { name, email, message } = parsed.data;
        const res = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
          },
          body: JSON.stringify({
            from: `${hostname} <forms@${hostname}>`,
            to: [settings.to_address],
            reply_to: email,
            subject: `New message from ${name || email} via ${hostname}`,
            html: `<p><b>${escape(name || "Someone")}</b> (${escape(email)}) wrote:</p><p style="white-space:pre-wrap">${escape(message)}</p>`,
          }),
        });
        if (!res.ok) {
          console.error(`Resend failed [${res.status}]: ${await res.text()}`);
          return new Response("The message could not be sent.", { status: 502 });
        }

        await supabaseAdmin
          .from("domain_email")
          .update({ sent_this_hour: sent + 1, ...(fresh ? { hour_start: new Date().toISOString() } : {}) })
          .eq("id", settings.id);

        const back = request.headers.get("referer");
        return back && !type.includes("application/json")
          ? Response.redirect(back, 303)
          : Response.json({ ok: true });
      },
    },
  },
});
