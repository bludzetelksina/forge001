import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Globe, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyDomain } from "@/lib/domains.functions";
import { FORGE_IP, addDomain, listDomains, removeDomain } from "@/lib/domains";

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for DNS",
  verified: "Live",
  misconfigured: "Not pointing here",
};

export default function DomainsPanel({
  projectId,
  isOwner,
  isWeb,
  isPublic,
}: {
  projectId: string;
  isOwner: boolean;
  isWeb: boolean;
  isPublic: boolean;
}) {
  const queryClient = useQueryClient();
  const verify = useServerFn(verifyDomain);
  const [host, setHost] = useState("");

  const domains = useQuery({ queryKey: ["domains", projectId], queryFn: () => listDomains(projectId) });

  const add = useMutation({
    mutationFn: () => addDomain(projectId, host),
    onSuccess: () => {
      setHost("");
      queryClient.invalidateQueries({ queryKey: ["domains", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const check = useMutation({
    mutationFn: (domainId: string) => verify({ data: { domainId } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["domains", projectId] });
      toast.message(
        result.status === "verified"
          ? "This domain is set up correctly."
          : result.pointsHere
            ? "The address is right, but the ownership record is missing."
            : "The domain does not point here yet. DNS can take a while.",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isWeb) {
    return (
      <p className="p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Custom domains work for web projects (HTML, CSS and JavaScript) — the kind that render a page.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-3">
      <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
        Serve this project on your own domain. Add it here, then point it at Forge with these records.
        {!isPublic ? " Turn the project public for the domain to serve anything." : ""}
      </p>

      {isOwner ? (
        <div className="mt-3 flex gap-2">
          <Input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="www.example.com"
            className="h-8 font-mono text-xs"
            aria-label="Domain name"
          />
          <Button
            size="sm"
            className="h-8 shrink-0"
            disabled={!host.trim() || add.isPending}
            onClick={() => add.mutate()}
          >
            Add
          </Button>
        </div>
      ) : null}

      <ul className="mt-4 space-y-3">
        {(domains.data ?? []).map((domain) => (
          <li key={domain.id} className="rounded-md border border-border p-2">
            <div className="flex items-center gap-2 font-mono text-xs">
              <Globe className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-foreground">{domain.hostname}</span>
              {domain.status === "verified" ? <Check className="size-3.5 text-primary" /> : null}
              {isOwner ? (
                <button
                  type="button"
                  aria-label={`Remove ${domain.hostname}`}
                  onClick={async () => {
                    await removeDomain(domain.id);
                    queryClient.invalidateQueries({ queryKey: ["domains", projectId] });
                  }}
                >
                  <Trash2 className="size-3 text-muted-foreground hover:text-foreground" />
                </button>
              ) : null}
            </div>

            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {STATUS_LABEL[domain.status] ?? domain.status}
            </p>

            {domain.status !== "verified" ? (
              <div className="mt-2 space-y-1 rounded bg-secondary/40 p-2 font-mono text-[10px] text-muted-foreground">
                <p>
                  A record · <span className="text-foreground">@ → {FORGE_IP}</span>
                </p>
                <p>
                  TXT record ·{" "}
                  <span className="text-foreground">
                    _forge → forge-verify={domain.verify_token}
                  </span>
                </p>
              </div>
            ) : null}

            {isOwner ? (
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 h-7 w-full font-mono text-[11px]"
                disabled={check.isPending}
                onClick={() => check.mutate(domain.id)}
              >
                {check.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Check now
              </Button>
            ) : null}
          </li>
        ))}
        {domains.data && domains.data.length === 0 ? (
          <li className="font-mono text-[11px] text-muted-foreground">No domains added yet.</li>
        ) : null}
      </ul>

      <p className="mt-4 font-mono text-[10px] leading-relaxed text-muted-foreground">
        The domain also has to be attached to Forge itself once, in the app's own domain settings, before
        traffic can reach it.
      </p>
    </div>
  );
}
