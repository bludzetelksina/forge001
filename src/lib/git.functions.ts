import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "github";
export const GITHUB_SCOPES = ["read:user", "repo"];

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "json", "js", "jsx", "ts", "tsx", "html", "htm", "css", "scss",
  "py", "rb", "php", "go", "rs", "java", "c", "h", "cpp", "hpp", "cc", "sh", "bash", "yml",
  "yaml", "toml", "ini", "env", "xml", "svg", "sql", "csv", "gitignore", "lock", "cfg",
]);

const MAX_FILES = 60;
const MAX_FILE_BYTES = 100_000;

function looksTextual(path: string) {
  const ext = path.includes(".") ? path.split(".").pop()!.toLowerCase() : "";
  return TEXT_EXTENSIONS.has(ext) || !path.includes(".");
}

async function gh(
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown; text: string }> {
  const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/vnd.github+json");
  if (init?.body) headers.set("Content-Type", "application/json");
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path,
    init: { ...init, headers },
    requiredScopes: GITHUB_SCOPES,
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body, text };
}

async function requireKey(userId: string) {
  const { getConnectionKeyForUser } = await import("./appUserConnections.server");
  const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
  if (!key) throw new Error("Connect your GitHub account first.");
  return key;
}

function fail(step: string, res: { status: number; text: string }): never {
  throw new Error(`GitHub ${step} failed (${res.status}): ${res.text.slice(0, 300)}`);
}

/* ---------------------------------------------------------------- connect */

export const startGithubConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientKey = process.env['GITHUB_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientKey) throw new Error("GitHub connector is not configured for this app.");

    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/github/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const { getConnectionKeyForUser } = await import("./appUserConnections.server");
    const existing = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);

    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: GITHUB_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeGithubConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CONNECTOR_ID) throw new Error("OAuth returned the wrong service.");
    const { saveConnectionKeyForUser } = await import("./appUserConnections.server");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export const disconnectGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser, deleteConnectionForUser } = await import(
      "./appUserConnections.server"
    );
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
      }).catch(() => undefined);
    }
    await deleteConnectionForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

/* ----------------------------------------------------------------- status */

export const githubStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser } = await import("./appUserConnections.server");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) return { connected: false as const };

    const res = await gh(key, "/user");
    const { appUserReconnectRequired } = await import("@/integrations/lovable/appUserConnector");
    if (!res.ok) {
      const raw = new Response(res.text, { status: res.status });
      if (await appUserReconnectRequired(raw)) {
        return { connected: false as const, reconnectRequired: true as const };
      }
      fail("account lookup", res);
    }
    const user = res.body as { login?: string; avatar_url?: string };
    return { connected: true as const, login: user.login ?? "", avatarUrl: user.avatar_url ?? "" };
  });

export const listRepos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await requireKey(context.userId);
    const res = await gh(key, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator");
    if (!res.ok) fail("repository list", res);
    const repos = (res.body as Array<{ full_name: string; default_branch: string; private: boolean }>) ?? [];
    return repos.map((r) => ({
      fullName: r.full_name,
      defaultBranch: r.default_branch,
      isPrivate: r.private,
    }));
  });

export const listBranches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { repo: string }) => input)
  .handler(async ({ data, context }) => {
    const key = await requireKey(context.userId);
    const res = await gh(key, `/repos/${data.repo}/branches?per_page=100`);
    if (!res.ok) fail("branch list", res);
    return ((res.body as Array<{ name: string }>) ?? []).map((b) => b.name);
  });

/* ----------------------------------------------------------------- import */

export const importRepo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; repo: string; branch: string }) => input)
  .handler(async ({ data, context }) => {
    const key = await requireKey(context.userId);
    const supabase = context.supabase;

    const tree = await gh(key, `/repos/${data.repo}/git/trees/${encodeURIComponent(data.branch)}?recursive=1`);
    if (!tree.ok) fail("file listing", tree);

    const entries = ((tree.body as { tree?: Array<{ path: string; type: string; size?: number; sha: string }> })
      .tree ?? []).filter((e) => e.type === "blob");

    const skipped: string[] = [];
    const wanted: Array<{ path: string; sha: string }> = [];
    for (const entry of entries) {
      if (entry.path.startsWith(".git/")) continue;
      if (!looksTextual(entry.path) || (entry.size ?? 0) > MAX_FILE_BYTES) {
        skipped.push(entry.path);
        continue;
      }
      if (wanted.length >= MAX_FILES) {
        skipped.push(entry.path);
        continue;
      }
      wanted.push({ path: entry.path, sha: entry.sha });
    }

    const imported: Array<{ path: string; content: string }> = [];
    for (const item of wanted) {
      const blob = await gh(key, `/repos/${data.repo}/git/blobs/${item.sha}`);
      if (!blob.ok) {
        skipped.push(item.path);
        continue;
      }
      const payload = blob.body as { content?: string; encoding?: string };
      if (payload.encoding !== "base64" || !payload.content) {
        skipped.push(item.path);
        continue;
      }
      const buf = Buffer.from(payload.content, "base64");
      if (buf.includes(0)) {
        skipped.push(item.path);
        continue;
      }
      imported.push({ path: item.path, content: buf.toString("utf8") });
    }

    if (!imported.length) throw new Error("No text files could be imported from that branch.");

    const { error: delError } = await supabase.from("project_files").delete().eq("project_id", data.projectId);
    if (delError) throw delError;

    const { error: insError } = await supabase.from("project_files").insert(
      imported.map((file, index) => ({
        project_id: data.projectId,
        path: file.path,
        content: file.content,
        sort_order: index,
      })),
    );
    if (insError) throw insError;

    const entry =
      imported.find((f) => f.path === "index.html")?.path ??
      imported.find((f) => f.path.endsWith("index.html"))?.path ??
      imported[0]!.path;
    await supabase.from("projects").update({ entry_file: entry }).eq("id", data.projectId);

    await supabase.from("project_git_links").upsert(
      {
        project_id: data.projectId,
        repo_full_name: data.repo,
        branch: data.branch,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    );

    return { importedCount: imported.length, skipped: skipped.slice(0, 20), skippedCount: skipped.length };
  });

/* ------------------------------------------------------------------- push */

async function localFiles(
  supabase: { from: (t: string) => any },
  projectId: string,
): Promise<Array<{ path: string; content: string }>> {
  const { data, error } = await supabase
    .from("project_files")
    .select("path, content")
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []) as Array<{ path: string; content: string }>;
}

async function blobSha(content: string) {
  const { createHash } = await import("node:crypto");
  const body = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${body.length}\0`, "utf8"), body]))
    .digest("hex");
}

export const previewPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; repo: string; branch: string }) => input)
  .handler(async ({ data, context }) => {
    const key = await requireKey(context.userId);
    const files = await localFiles(context.supabase, data.projectId);

    const tree = await gh(key, `/repos/${data.repo}/git/trees/${encodeURIComponent(data.branch)}?recursive=1`);
    const remote = new Map<string, string>();
    if (tree.ok) {
      for (const entry of ((tree.body as { tree?: Array<{ path: string; type: string; sha: string }> }).tree ?? [])) {
        if (entry.type === "blob") remote.set(entry.path, entry.sha);
      }
    }

    const added: string[] = [];
    const changed: string[] = [];
    for (const file of files) {
      const sha = await blobSha(file.content);
      const existing = remote.get(file.path);
      if (!existing) added.push(file.path);
      else if (existing !== sha) changed.push(file.path);
    }
    return { added, changed, unchanged: files.length - added.length - changed.length };
  });

export const pushProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; repo: string; branch: string; message: string }) => input)
  .handler(async ({ data, context }) => {
    const key = await requireKey(context.userId);
    const files = await localFiles(context.supabase, data.projectId);
    if (!files.length) throw new Error("This project has no files to push.");

    const ref = await gh(key, `/repos/${data.repo}/git/ref/heads/${encodeURIComponent(data.branch)}`);
    const parentSha = ref.ok ? (ref.body as { object?: { sha?: string } }).object?.sha ?? null : null;

    let baseTree: string | undefined;
    if (parentSha) {
      const commit = await gh(key, `/repos/${data.repo}/git/commits/${parentSha}`);
      if (commit.ok) baseTree = (commit.body as { tree?: { sha?: string } }).tree?.sha;
    }

    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    for (const file of files) {
      const blob = await gh(key, `/repos/${data.repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: Buffer.from(file.content, "utf8").toString("base64"), encoding: "base64" }),
      });
      if (!blob.ok) fail("upload", blob);
      treeItems.push({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: (blob.body as { sha: string }).sha,
      });
    }

    const newTree = await gh(key, `/repos/${data.repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify(baseTree ? { base_tree: baseTree, tree: treeItems } : { tree: treeItems }),
    });
    if (!newTree.ok) fail("tree creation", newTree);

    const commit = await gh(key, `/repos/${data.repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: data.message.trim() || "Update from Forge",
        tree: (newTree.body as { sha: string }).sha,
        parents: parentSha ? [parentSha] : [],
      }),
    });
    if (!commit.ok) fail("commit", commit);
    const commitSha = (commit.body as { sha: string }).sha;

    const update = parentSha
      ? await gh(key, `/repos/${data.repo}/git/refs/heads/${encodeURIComponent(data.branch)}`, {
          method: "PATCH",
          body: JSON.stringify({ sha: commitSha }),
        })
      : await gh(key, `/repos/${data.repo}/git/refs`, {
          method: "POST",
          body: JSON.stringify({ ref: `refs/heads/${data.branch}`, sha: commitSha }),
        });
    if (!update.ok) fail("branch update", update);

    await context.supabase.from("project_git_links").upsert(
      {
        project_id: data.projectId,
        repo_full_name: data.repo,
        branch: data.branch,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    );

    return { commitSha, fileCount: files.length };
  });

export const createRepo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; isPrivate: boolean }) => input)
  .handler(async ({ data, context }) => {
    const key = await requireKey(context.userId);
    const res = await gh(key, "/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: data.name.trim().replace(/\s+/g, "-").toLowerCase(),
        private: data.isPrivate,
        auto_init: true,
      }),
    });
    if (!res.ok) fail("repository creation", res);
    const repo = res.body as { full_name: string; default_branch: string };
    return { fullName: repo.full_name, defaultBranch: repo.default_branch || "main" };
  });
