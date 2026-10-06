import { useQueryClient } from "@tanstack/react-query";
import { Copy, Globe } from "lucide-react";
import { toast } from "sonner";

import DomainEmailSection from "@/components/DomainEmailSection";
import DomainsPanel from "@/components/DomainsPanel";
import { Switch } from "@/components/ui/switch";
import { setProjectVisibility, type ProjectRow } from "@/lib/projects";

export default function CloudPanel({
  project,
  isOwner,
  isWeb,
}: {
  project: ProjectRow;
  isOwner: boolean;
  isWeb: boolean;
}) {
  const qc = useQueryClient();
  const url = typeof window !== "undefined" ? `${window.location.origin}/p/${project.share_slug}` : "";

  return (
    <div className="h-full overflow-auto bg-editor">
      <section className="border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Globe className="size-3.5 text-muted-foreground" />
          <span className="flex-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sharing</span>
          <Switch
            checked={project.is_public}
            disabled={!isOwner}
            aria-label="Public"
            onCheckedChange={async (checked) => {
              await setProjectVisibility(project.id, checked);
              void qc.invalidateQueries({ queryKey: ["project", project.id] });
            }}
          />
        </div>
        {project.is_public ? (
          <button type="button" className="mt-2 flex items-center gap-1 break-all font-mono text-[11px] text-foreground hover:underline"
            onClick={async () => {
              await navigator.clipboard.writeText(url).catch(() => undefined);
              toast.success("Link copied.");
            }}>
            <Copy className="size-3 shrink-0" />{url}
          </button>
        ) : (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Private. Turn on to get a share link.</p>
        )}
      </section>
      <section className="border-b border-border">
        <p className="px-3 pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Custom domains</p>
        <DomainsPanel projectId={project.id} isOwner={isOwner} isWeb={isWeb} isPublic={project.is_public} />
      </section>
      {isOwner && isWeb ? <DomainEmailSection projectId={project.id} /> : null}
    </div>
  );
}
