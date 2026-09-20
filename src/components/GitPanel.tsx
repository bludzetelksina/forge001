import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Github, Loader2, Download, Upload, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  completeGithubConnection,
  createRepo,
  disconnectGithub,
  githubStatus,
  importRepo,
  listBranches,
  listRepos,
  previewPush,
  pushProject,
  startGithubConnect,
} from "@/lib/git.functions";

function waitForOAuth(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = (event.data as { type?: string } | null)?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        (event.data as { connectorId?: string } | null)?.connectorId !== "github" ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        const code = (event.data as { code?: string | null }).code;
        resolve(typeof code === "string" ? code : null);
        return;
      }
      popup.close();
      reject(new Error("The GitHub connection did not finish."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The GitHub window closed before finishing."));
    }, 500);
  });
}

export default function GitPanel({
  projectId,
  projectName,
  canEdit,
}: {
  projectId: string;
  projectName: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const status = useServerFn(githubStatus);
  const start = useServerFn(startGithubConnect);
  const complete = useServerFn(completeGithubConnection);
  const disconnect = useServerFn(disconnectGithub);
  const repos = useServerFn(listRepos);
  const branches = useServerFn(listBranches);
  const doImport = useServerFn(importRepo);
  const doPreview = useServerFn(previewPush);
  const doPush = useServerFn(pushProject);
  const doCreate = useServerFn(createRepo);

  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [message, setMessage] = useState("Update from Forge");
  const [diff, setDiff] = useState<{ added: string[]; changed: string[]; unchanged: number } | null>(null);

  const statusQuery = useQuery({ queryKey: ["github-status"], queryFn: () => status({}) });
  const connected = statusQuery.data?.connected === true;

  const linkQuery = useQuery({
    queryKey: ["git-link", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_git_links")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (data) {
        setRepo((current) => current || data.repo_full_name);
        setBranch((current) => current || data.branch);
      }
      return data;
    },
  });

  const repoQuery = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => repos({}),
    enabled: connected,
  });

  const branchQuery = useQuery({
    queryKey: ["github-branches", repo],
    queryFn: () => branches({ data: { repo } }),
    enabled: connected && Boolean(repo),
  });

  const connect = useMutation({
    mutationFn: async () => {
      const popup = window.open("", "forge-github-oauth", "width=620,height=740");
      if (!popup) throw new Error("Allow pop-ups to connect GitHub, then try again.");
      let code: string | null;
      try {
        const { authorizationUrl } = await start({});
        const completion = waitForOAuth(popup);
        popup.location.href = authorizationUrl;
        code = await completion;
      } catch (error) {
        popup.close();
        throw error;
      }
      if (code) await complete({ data: { code } });
    },
    onSuccess: async () => {
      toast.success("GitHub connected.");
      await queryClient.invalidateQueries({ queryKey: ["github-status"] });
      await queryClient.invalidateQueries({ queryKey: ["github-repos"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importMutation = useMutation({
    mutationFn: () => doImport({ data: { projectId, repo, branch } }),
    onSuccess: async (result) => {
      toast.success(
        `Imported ${result.importedCount} file${result.importedCount === 1 ? "" : "s"}${
          result.skippedCount ? `, skipped ${result.skippedCount}` : ""
        }.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["git-link", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const previewMutation = useMutation({
    mutationFn: () => doPreview({ data: { projectId, repo, branch } }),
    onSuccess: setDiff,
    onError: (error: Error) => toast.error(error.message),
  });

  const pushMutation = useMutation({
    mutationFn: () => doPush({ data: { projectId, repo, branch, message } }),
    onSuccess: async (result) => {
      setDiff(null);
      toast.success(`Pushed ${result.fileCount} files to ${repo}.`);
      await queryClient.invalidateQueries({ queryKey: ["git-link", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createMutation = useMutation({
    mutationFn: () => doCreate({ data: { name: projectName || "forge-project", isPrivate: true } }),
    onSuccess: async (result) => {
      setRepo(result.fullName);
      setBranch(result.defaultBranch);
      toast.success(`Created ${result.fullName}.`);
      await queryClient.invalidateQueries({ queryKey: ["github-repos"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (statusQuery.isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="space-y-3 p-3">
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          Connect your own GitHub account to bring a repository into this project, or push what you have
          here back to GitHub.
        </p>
        <Button size="sm" className="w-full" disabled={connect.isPending} onClick={() => connect.mutate()}>
          {connect.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Github className="size-3.5" />}
          {statusQuery.data?.reconnectRequired ? "Reconnect GitHub" : "Connect GitHub"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-3">
      <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
        <Github className="size-3.5" />
        <span className="flex-1 truncate text-foreground">{statusQuery.data?.login}</span>
        <button
          type="button"
          className="underline-offset-2 hover:underline"
          onClick={async () => {
            await disconnect({});
            await queryClient.invalidateQueries({ queryKey: ["github-status"] });
            toast.message("GitHub disconnected.");
          }}
        >
          Disconnect
        </button>
      </div>

      <label className="mt-3 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Repository
      </label>
      <select
        value={repo}
        onChange={(e) => {
          setRepo(e.target.value);
          setBranch("");
          setDiff(null);
        }}
        className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 font-mono text-xs"
        aria-label="Repository"
      >
        <option value="">Choose a repository…</option>
        {(repoQuery.data ?? []).map((item) => (
          <option key={item.fullName} value={item.fullName}>
            {item.fullName}
            {item.isPrivate ? " (private)" : ""}
          </option>
        ))}
      </select>

      <label className="mt-3 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Branch
      </label>
      <select
        value={branch}
        onChange={(e) => {
          setBranch(e.target.value);
          setDiff(null);
        }}
        disabled={!repo}
        className="mt-1 h-8 w-full rounded-md border border-input bg-transparent px-2 font-mono text-xs"
        aria-label="Branch"
      >
        <option value="">Choose a branch…</option>
        {(branchQuery.data ?? []).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      {canEdit ? (
        <>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 flex-1"
              disabled={!repo || !branch || importMutation.isPending}
              onClick={() => {
                if (!confirm("Importing replaces every file in this project. Continue?")) return;
                importMutation.mutate();
              }}
            >
              {importMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Import
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 flex-1"
              disabled={!repo || !branch || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              {previewMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              Review push
            </Button>
          </div>

          {diff ? (
            <div className="mt-3 rounded-md border border-border p-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {diff.added.length} new · {diff.changed.length} changed · {diff.unchanged} unchanged
              </p>
              <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto font-mono text-[11px] text-foreground">
                {[...diff.added.map((p) => `+ ${p}`), ...diff.changed.map((p) => `~ ${p}`)].map((line) => (
                  <li key={line} className="truncate">
                    {line}
                  </li>
                ))}
              </ul>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Commit message"
                className="mt-2 h-8 font-mono text-xs"
                aria-label="Commit message"
              />
              <Button
                size="sm"
                className="mt-2 h-8 w-full"
                disabled={pushMutation.isPending}
                onClick={() => pushMutation.mutate()}
              >
                {pushMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Push to {branch}
              </Button>
            </div>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            className="mt-3 h-8 justify-start px-0 font-mono text-[11px]"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Plus className="size-3.5" />
            Create a new private repository
          </Button>
        </>
      ) : (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          You can look, but only owners and editors can import or push.
        </p>
      )}

      {linkQuery.data?.last_synced_at ? (
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">
          Last synced {new Date(linkQuery.data.last_synced_at).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
