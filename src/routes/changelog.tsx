import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import SiteHeader from "@/components/SiteHeader";
import { markSeen } from "@/components/WhatsNew";
import { RELEASES } from "@/lib/changelog";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "What's new in Forge — changelog" },
      { name: "description", content: "Every Forge release: new tools, languages and workspace features." },
      { property: "og:title", content: "What's new in Forge" },
      { property: "og:description", content: "Every Forge release: new tools, languages and workspace features." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChangelogPage,
});

function ChangelogPage() {
  useEffect(() => { markSeen(); }, []);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">Changelog</p>
        <h1 className="mt-2 font-mono text-3xl font-bold">What's new</h1>
        <ol className="mt-10 space-y-10 border-l border-border pl-6">
          {RELEASES.map((r, i) => (
            <li key={r.id} className="relative">
              <span className={`absolute -left-[29px] top-1.5 size-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground"}`} />
              <p className="font-mono text-xs text-muted-foreground">{r.date}{i === 0 ? " · latest" : ""}</p>
              <h2 className="mt-1 text-lg font-semibold">{r.title}</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {r.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
