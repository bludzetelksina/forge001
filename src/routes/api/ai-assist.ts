import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

type Body = {
  messages: { role: "user" | "assistant"; content: string }[];
  files: { path: string; content: string }[];
  language: string;
};

const SYSTEM = `You are Forge's coding assistant inside a browser IDE. Be concise.
When you change code, output the COMPLETE new file content in a fenced block whose info string is "file:<path>", e.g.
\`\`\`file:main.py
print("hi")
\`\`\`
Only use paths of existing files unless creating a new one is necessary.`;

async function verify(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const sb = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb.auth.getUser(token);
  return data.user?.id ?? null;
}

export const Route = createFileRoute("/api/ai-assist")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verify(request))) return new Response("Please sign in.", { status: 401 });
        const body = (await request.json()) as Body;
        let budget = 40_000;
        const context = (body.files ?? [])
          .map((f) => {
            const chunk = `--- ${f.path} ---\n${f.content}`.slice(0, Math.max(0, budget));
            budget -= chunk.length;
            return chunk;
          })
          .filter(Boolean)
          .join("\n\n");
        const openai = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: process.env["LOVABLE_API_KEY"]!,
          headers: { "Lovable-API-Key": process.env["LOVABLE_API_KEY"]!, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });
        try {
          const result = streamText({
            model: openai.responses("openai/gpt-6-astra"),
            system: `${SYSTEM}\nProject language: ${body.language}\n\nProject files:\n${context}`,
            messages: (body.messages ?? []).slice(-12),
            maxRetries: 0,
            abortSignal: request.signal,
            providerOptions: {
              openai: { forceReasoning: true, reasoningEffort: "low", store: false },
            },
          });
          return result.toTextStreamResponse();
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "AI request failed.", { status: 500 });
        }
      },
    },
  },
});
