import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { checkEmailDomain } from "@/lib/domain-email.functions";

type Dns = { status: string; records: Array<{ type: string; name: string; value: string; status: string }> };

/** Contact-form email for a project's verified domains, sent through Forge's Resend account. */
export default function DomainEmailSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [to, setTo] = useState<Record<string, string>>({});
  const [dns, setDns] = useState<Record<string, Dns>>({});
  const check = useServerFn(checkEmailDomain);
  const checkMutation = useMutation({
    mutationFn: (domainId: string) => check({ data: { domainId } }).then((r) => ({ domainId, r })),
    onSuccess: ({ domainId, r }) => setDns((d) => ({ ...d, [domainId]: r })),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useQuery({
    queryKey: ["domain-email", projectId],
    queryFn: async () => {
      const [{ data: domains }, { data: email }] = await Promise.all([
        supabase.from("project_domains").select("id, hostname, status").eq("project_id", projectId),
        supabase.from("domain_email").select("domain_id, enabled, to_address").eq("project_id", projectId),
      ]);
      const byDomain = new Map((email ?? []).map((e) => [e.domain_id, e]));
      return (domains ?? []).map((d) => ({ ...d, email: byDomain.get(d.id) ?? null }));
    },
  });

  const save = useMutation({
    mutationFn: async (input: { domainId: string; enabled: boolean; toAddress: string }) => {
      if (input.enabled && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.toAddress)) {
        throw new Error("Enter the address that should receive form messages.");
      }
      const { error } = await supabase.from("domain_email").upsert(
        { domain_id: input.domainId, project_id: projectId, enabled: input.enabled, to_address: input.toAddress || null },
        { onConflict: "domain_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email settings saved.");
      void qc.invalidateQueries({ queryKey: ["domain-email", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="p-3">
      <div className="flex items-center gap-2">
        <Mail className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Form email</span>
      </div>
      {(rows.data ?? []).length === 0 ? (
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">Add a domain above first.</p>
      ) : null}
      <ul className="mt-2 space-y-3">
        {(rows.data ?? []).map((d) => {
          const address = to[d.id] ?? d.email?.to_address ?? "";
          return (
            <li key={d.id} className="rounded-md border border-border p-2 font-mono text-[11px]">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-foreground">{d.hostname}</span>
                <Switch
                  checked={Boolean(d.email?.enabled)}
                  disabled={d.status !== "verified"}
                  aria-label={`Email for ${d.hostname}`}
                  onCheckedChange={(enabled) => save.mutate({ domainId: d.id, enabled, toAddress: address })}
                />
              </div>
              {d.status !== "verified" ? (
                <p className="mt-1 text-muted-foreground">Verify the domain to turn on form email.</p>
              ) : (
                <>
                  <div className="mt-2 flex gap-2">
                    <Input value={address} onChange={(e) => setTo({ ...to, [d.id]: e.target.value })}
                      placeholder="you@example.com" className="h-7 text-xs" aria-label="Send form messages to" />
                    <Button size="sm" className="h-7" onClick={() => save.mutate({ domainId: d.id, enabled: Boolean(d.email?.enabled), toAddress: address })}>
                      Save
                    </Button>
                  </div>
                  <Button size="sm" variant="secondary" className="mt-2 h-7" disabled={checkMutation.isPending}
                    onClick={() => checkMutation.mutate(d.id)}>
                    Check sending records
                  </Button>
                  {dns[d.id] ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-foreground">Sending status: {dns[d.id]!.status}</p>
                      {dns[d.id]!.records.map((r) => (
                        <p key={r.type + r.name} className="break-all text-muted-foreground">
                          {r.type} {r.name} → {r.value} <span className={r.status === "verified" ? "text-primary" : ""}>({r.status})</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 break-all text-muted-foreground">
                    In your site: {`<form method="post" action="/api/public/forms/${d.hostname}">`} with fields name, email, message. Up to 30 messages an hour.
                  </p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
