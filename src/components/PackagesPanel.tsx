import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Package, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addPackage, listPackages, removePackage } from "@/lib/collab";
import { getRegistry, removeRegistry, saveRegistry } from "@/lib/registry.functions";

const CDN_LANGUAGES = new Set(["web"]);


const SANDBOX_NOTE: Record<string, string> = {
  python: "Forge tries pip install at run time; the sandbox usually blocks it, and the console will say so.",
  ruby: "Forge tries gem install at run time; the sandbox usually blocks it, and the console will say so.",
  php: "Composer packages can't be installed in the run sandbox.",
  javascript: "npm packages can't be downloaded in the run sandbox.",
  typescript: "npm packages can't be downloaded in the run sandbox.",
  go: "Only the Go standard library is available in the run sandbox.",
  rust: "Only the Rust standard library is available in the run sandbox.",
  java: "Only the JDK standard library is available in the run sandbox.",
  c: "Only the standard C library is available in the run sandbox.",
  cpp: "Only the standard C++ library is available in the run sandbox.",
  bash: "Packages can't be installed in the run sandbox.",
};

export default function PackagesPanel({
  projectId,
  language,
  canEdit,
}: {
  projectId: string;
  language: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");

  const packages = useQuery({
    queryKey: ["packages", projectId],
    queryFn: () => listPackages(projectId),
  });

  const add = useMutation({
    mutationFn: () => addPackage(projectId, name, version || null),
    onSuccess: () => {
      setName("");
      setVersion("");
      queryClient.invalidateQueries({ queryKey: ["packages", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: removePackage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packages", projectId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const cdn = CDN_LANGUAGES.has(language);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-3">
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          {cdn
            ? "Packages are loaded from the esm.sh CDN, so you can import them straight away in the preview."
            : (SANDBOX_NOTE[language] ?? "Package support depends on the run sandbox.")}
        </p>

        {canEdit ? (
          <div className="mt-3 space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Package name"
              className="h-8 font-mono text-xs"
              aria-label="Package name"
            />
            <div className="flex gap-2">
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Version (optional)"
                className="h-8 font-mono text-xs"
                aria-label="Package version"
              />
              <Button
                size="sm"
                className="h-8 shrink-0"
                disabled={!name.trim() || add.isPending}
                onClick={() => add.mutate()}
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
          </div>
        ) : null}

        <ul className="mt-4 space-y-1">
          {(packages.data ?? []).map((pkg) => (
            <li
              key={pkg.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-xs text-muted-foreground hover:bg-secondary/60"
            >
              <Package className="size-3 shrink-0" />
              <span className="flex-1 truncate text-foreground">{pkg.name}</span>
              {pkg.version ? <span>{pkg.version}</span> : null}
              {canEdit ? (
                <button
                  type="button"
                  aria-label={`Remove ${pkg.name}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => remove.mutate(pkg.id)}
                >
                  <Trash2 className="size-3" />
                </button>
              ) : null}
            </li>
          ))}
          {packages.data && packages.data.length === 0 ? (
            <li className="px-2 py-3 font-mono text-[11px] text-muted-foreground">
              No packages declared.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
