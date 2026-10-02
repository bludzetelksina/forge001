import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "github";
const SCOPES = ["read:user", "repo"];

async function gh(userId: string, path: string, init?: RequestInit) {
  const { getConnectionKeyForUser } = await import("./appUserConnections.server");
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!key) throw new Error("Connect your GitHub account first.");
  const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/vnd.github+json");
  if (init?.body) headers.set("Content-Type", "application/json");
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: CONNECTOR_ID,
    path,
    init: { ...init, headers },
    requiredScopes: SCOPES,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub request failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as unknown) : null;
}

async function assertEditor(supabase: any, projectId: string, userId: string) {
  const { data } = await supabase.rpc("project_role", { _project_id: projectId, _user_id: userId });
  if (data !== "owner" && data !== "editor") throw new Error("Only owners and editors can do that.");
}

type Repo = { repo: string };

/* ----------------------------------------------------------- pull requests */

export const listPulls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Repo) => input)
  .handler(async ({ data, context }) => {
    const rows = (await gh(context.userId, `/repos/${data.repo}/pulls?state=open&per_page=30`)) as Array<any>;
    return rows.map((p) => ({
      number: p.number as number,
      title: p.title as string,
      author: (p.user?.login ?? "") as string,
      head: p.head?.ref as string,
      base: p.base?.ref as string,
      url: p.html_url as string,
    }));
  });

export const openPull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { projectId: string; repo: string; head: string; base: string; title: string; body: string }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, data.projectId, context.userId);
    const pr = (await gh(context.userId, `/repos/${data.repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({ title: data.title, body: data.body, head: data.head, base: data.base }),
    })) as any;
    return { number: pr.number as number, url: pr.html_url as string };
  });

export const pullFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Repo & { number: number }) => input)
  .handler(async ({ data, context }) => {
    const files = (await gh(context.userId, `/repos/${data.repo}/pulls/${data.number}/files?per_page=100`)) as any[];
    return files.map((f) => ({
      filename: f.filename as string,
      status: f.status as string,
      additions: f.additions as number,
      deletions: f.deletions as number,
      patch: (f.patch ?? "") as string,
    }));
  });

export const reviewPull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      projectId: string;
      repo: string;
      number: number;
      event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
      body: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, data.projectId, context.userId);
    await gh(context.userId, `/repos/${data.repo}/pulls/${data.number}/reviews`, {
      method: "POST",
      body: JSON.stringify({ event: data.event, body: data.body || undefined }),
    });
    return { ok: true };
  });

export const mergePull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; repo: string; number: number }) => input)
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, data.projectId, context.userId);
    await gh(context.userId, `/repos/${data.repo}/pulls/${data.number}/merge`, {
      method: "PUT",
      body: JSON.stringify({ merge_method: "squash" }),
    });
    return { ok: true };
  });

/* ----------------------------------------------------------------- actions */

export const listRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Repo) => input)
  .handler(async ({ data, context }) => {
    const body = (await gh(context.userId, `/repos/${data.repo}/actions/runs?per_page=15`)) as any;
    return ((body?.workflow_runs ?? []) as any[]).map((r) => ({
      id: r.id as number,
      name: (r.name ?? r.display_title) as string,
      branch: r.head_branch as string,
      status: r.status as string,
      conclusion: (r.conclusion ?? null) as string | null,
      createdAt: r.created_at as string,
      url: r.html_url as string,
    }));
  });

export const runJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Repo & { runId: number }) => input)
  .handler(async ({ data, context }) => {
    const body = (await gh(context.userId, `/repos/${data.repo}/actions/runs/${data.runId}/jobs`)) as any;
    return ((body?.jobs ?? []) as any[]).map((j) => ({
      id: j.id as number,
      name: j.name as string,
      conclusion: (j.conclusion ?? j.status) as string,
      steps: ((j.steps ?? []) as any[]).map((s) => ({ name: s.name as string, conclusion: (s.conclusion ?? s.status) as string })),
    }));
  });

export const rerunRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; repo: string; runId: number }) => input)
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, data.projectId, context.userId);
    await gh(context.userId, `/repos/${data.repo}/actions/runs/${data.runId}/rerun`, { method: "POST" });
    return { ok: true };
  });

export const listWorkflows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Repo) => input)
  .handler(async ({ data, context }) => {
    const body = (await gh(context.userId, `/repos/${data.repo}/actions/workflows`)) as any;
    return ((body?.workflows ?? []) as any[]).map((w) => ({ id: w.id as number, name: w.name as string, path: w.path as string }));
  });

export const dispatchWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; repo: string; workflowId: number; ref: string }) => input)
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, data.projectId, context.userId);
    await gh(context.userId, `/repos/${data.repo}/actions/workflows/${data.workflowId}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: data.ref }),
    });
    return { ok: true };
  });

const STARTER_STEPS: Record<string, string> = {
  python: "      - uses: actions/setup-python@v5\n        with: { python-version: '3.12' }\n      - run: python main.py",
  javascript: "      - uses: actions/setup-node@v4\n        with: { node-version: 20 }\n      - run: node main.js",
  typescript: "      - uses: actions/setup-node@v4\n        with: { node-version: 20 }\n      - run: npx --yes tsx main.ts",
  go: "      - uses: actions/setup-go@v5\n        with: { go-version: stable }\n      - run: go run .",
  bash: "      - run: bash main.sh",
};

export const addStarterWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; repo: string; branch: string; language: string }) => input)
  .handler(async ({ data, context }) => {
    await assertEditor(context.supabase, data.projectId, context.userId);
    const steps = STARTER_STEPS[data.language] ?? "      - run: ls -la";
    const yaml = `name: Forge CI\non:\n  push:\n  workflow_dispatch:\njobs:\n  run:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n${steps}\n`;
    await gh(context.userId, `/repos/${data.repo}/contents/.github/workflows/forge-ci.yml`, {
      method: "PUT",
      body: JSON.stringify({
        message: "Add Forge CI workflow",
        content: Buffer.from(yaml, "utf8").toString("base64"),
        branch: data.branch,
      }),
    });
    return { ok: true };
  });
