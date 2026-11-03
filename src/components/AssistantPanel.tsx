import { Bot, Check, Loader2, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

export function parseFileBlocks(text: string) {
  const out: { path: string; content: string }[] = [];
  const re = /```file:([^\n`]+)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ path: m[1]!.trim(), content: m[2]!.replace(/\n$/, "") });
  return out;
}

export default function AssistantPanel({
  files,
  language,
  canEdit,
  prompt,
  onApply,
}: {
  files: { path: string; content: string }[];
  language: string;
  canEdit: boolean;
  prompt: { text: string; id: number } | null;
  onApply: (path: string, content: string) => Promise<void>;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  useEffect(() => {
    if (prompt) void ask(prompt.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt?.id]);

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/ai-assist", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ messages: next, files, language }),
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || "The assistant is unavailable, try again later.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
      if (!acc) setMessages([...next, { role: "assistant", content: "(No reply — try again later.)" }]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages([...next, { role: "assistant", content: `⚠ ${(e as Error).message}` }]);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-full flex-col bg-editor">
      <div className="flex-1 space-y-3 overflow-auto p-3 text-sm" data-testid="ai-transcript">
        {messages.length === 0 ? (
          <div className="flex items-start gap-2 text-muted-foreground">
            <Bot className="mt-0.5 size-4 text-primary" />
            <p>Ask about your code, or ask me to change it. I can see this project's files.</p>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-8 rounded-lg bg-primary px-3 py-2 text-primary-foreground" : ""}>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed">
              {m.content || (busy && i === messages.length - 1 ? "Thinking…" : "")}
            </pre>
            {m.role === "assistant" && canEdit && !(busy && i === messages.length - 1)
              ? parseFileBlocks(m.content).map((b) => (
                  <Button key={b.path} size="sm" variant="secondary" className="mr-2 mt-2 h-7"
                    onClick={async () => {
                      try {
                        await onApply(b.path, b.content);
                        toast.success(`Applied to ${b.path}`);
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}>
                    <Check className="size-3" /> Apply to {b.path}
                  </Button>
                ))
              : null}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="flex shrink-0 gap-2 border-t border-border p-2"
        onSubmit={(e) => { e.preventDefault(); void ask(input); }}>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} aria-label="Ask the assistant"
          placeholder="e.g. Add input validation"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(input); } }}
          className="min-h-0 flex-1 resize-none font-mono text-xs" />
        {busy ? (
          <Button type="button" size="icon" variant="secondary" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
            <Square className="size-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        )}
      </form>
    </div>
  );
}
