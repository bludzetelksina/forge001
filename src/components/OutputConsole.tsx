import { Loader2, Terminal } from "lucide-react";

import type { RunResult } from "@/lib/run.functions";

export default function OutputConsole({
  result,
  running,
}: {
  result: RunResult | null;
  running: boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-editor">
      <div className="flex items-center gap-2 border-b border-border bg-chrome px-3 py-2">
        <Terminal className="size-3.5 text-primary" aria-hidden />
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Console
        </span>
        {running ? (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden /> running
          </span>
        ) : result ? (
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            exit {result.exitCode ?? "-"} · {result.durationMs} ms
          </span>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto p-3 font-mono text-[13px] leading-relaxed">
        {!result && !running ? (
          <p className="text-muted-foreground">Press Run to execute your program.</p>
        ) : null}
        {result?.stdout ? (
          <pre className="whitespace-pre-wrap text-foreground">{result.stdout}</pre>
        ) : null}
        {result?.stderr ? (
          <pre className="whitespace-pre-wrap text-destructive">{result.stderr}</pre>
        ) : null}
        {result && !result.stdout && !result.stderr && !running ? (
          <p className="text-muted-foreground">No output.</p>
        ) : null}
      </div>
    </div>
  );
}
