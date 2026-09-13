import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Play, Share2, Zap } from "lucide-react";

import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LANGUAGES } from "@/lib/languages";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge — write and run code in your browser" },
      {
        name: "description",
        content:
          "A browser workspace for Python, Go, Rust, TypeScript, Java, C++ and more. Write code, hit Run, share a link.",
      },
      { property: "og:title", content: "Forge — write and run code in your browser" },
      {
        property: "og:description",
        content: "Write code, hit Run, share a link. Ten languages, nothing to install.",
      },
    ],
  }),
  component: Landing,
});

const SAMPLE = `def fib(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b


print(list(fib(10)))
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]`;

function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden border-b border-border grid-noise">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
                <Zap className="size-3 text-primary" /> ten languages · zero setup
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] sm:text-5xl">
                Write code. Hit run.
                <br />
                <span className="text-gradient-lime">Nothing to install.</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                Forge is a coding workspace that lives in your browser. Real runtimes, real output,
                real errors — and a link you can send to anyone.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to={user ? "/app" : "/auth"}>
                    <Play className="size-4" /> {user ? "Open workspace" : "Start coding free"}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link to="/templates">
                    <Boxes className="size-4" /> Browse templates
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-panel">
              <div className="flex items-center gap-2 border-b border-border bg-chrome px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-destructive/70" />
                <span className="size-2.5 rounded-full bg-warning/70" />
                <span className="size-2.5 rounded-full bg-success/70" />
                <span className="ml-3 font-mono text-xs text-muted-foreground">main.py</span>
              </div>
              <pre className="overflow-x-auto bg-editor p-5 font-mono text-[13px] leading-relaxed text-foreground">
                {SAMPLE}
              </pre>
              <div className="border-t border-border bg-chrome px-4 py-2.5 font-mono text-xs text-muted-foreground">
                <span className="text-success">exit 0</span> · 41 ms
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Languages you can run today
            </h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <li
                  key={lang.id}
                  className="rounded-md border border-border bg-card px-3 py-1.5 font-mono text-sm"
                >
                  {lang.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
            {[
              {
                icon: Boxes,
                title: "Start from a template",
                body: "Pick a language and get a working program, not an empty file.",
              },
              {
                icon: Play,
                title: "Run it for real",
                body: "Your code executes on a sandboxed runtime and streams back output, errors and exit codes.",
              },
              {
                icon: Share2,
                title: "Share a link",
                body: "Flip a project to public and anyone can read it and run it — no account needed.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <Icon className="size-5 text-primary" />
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold">Open an editor in five seconds</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            No downloads, no toolchains, no version managers. Just a tab.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to={user ? "/app" : "/auth"}>{user ? "Open workspace" : "Create free account"}</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <span className="font-mono">forge</span>
          <span className="sm:ml-auto">
            Programs run in a sandbox with a few seconds of CPU each — great for scripts and
            exercises, not for long-running servers.
          </span>
        </div>
      </footer>
    </div>
  );
}
