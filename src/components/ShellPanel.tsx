import { Loader2, Power, RotateCcw, Save, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export const VM_USER = "forge";
export const VM_PASSWORD = "server123";

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const open = indexedDB.open("forge-vm", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("states");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = run(open.result.transaction("states", mode).objectStore("states"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}

/**
 * A small Linux machine (v86) running in an isolated page inside the tab.
 * Its serial console is shown here as a text terminal.
 */
export default function ShellPanel({ projectId, memoryMb = 256 }: { projectId: string; memoryMb?: number }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const outRef = useRef<HTMLPreElement>(null);
  const [ready, setReady] = useState(false);
  const [output, setOutput] = useState("");
  const [line, setLine] = useState("");

  const send = (msg: Record<string, unknown>) =>
    frameRef.current?.contentWindow?.postMessage({ forgeVmCmd: true, ...msg }, window.location.origin);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { forgeVm?: boolean; type?: string; text?: string; state?: ArrayBuffer };
      if (!data?.forgeVm) return;
      if (data.type === "serial" && data.text) {
        const clean = data.text.replace(/\r/g, "").replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
        setOutput((o) => (o + clean).slice(-60_000));
      }
      if (data.type === "ready") setReady(true);
      if (data.type === "state" && data.state) {
        void idb("readwrite", (s) => s.put(data.state, projectId)).then(() =>
          toast.success("Machine state saved in this browser."),
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [projectId]);

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [output]);

  return (
    <div className="flex h-full flex-col bg-editor">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-chrome px-2 py-1 font-mono text-[11px] text-muted-foreground">
        {ready ? <Power className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
        <span className="flex-1" data-testid="vm-status">
          {ready ? `Linux · ${VM_USER} / ${VM_PASSWORD} · ${memoryMb} MB · 1 CPU` : "Booting Linux in your browser…"}
        </span>
        <Button size="sm" variant="ghost" className="h-6 px-2" aria-label="Restart VM"
          onClick={() => {
            setOutput("");
            setReady(false);
            if (frameRef.current) frameRef.current.src = frameRef.current.src;
          }}>
          <RotateCcw className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-2" aria-label="Save VM state" onClick={() => send({ type: "save" })}>
          <Save className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-2" aria-label="Restore VM state"
          onClick={async () => {
            const state = await idb<ArrayBuffer | undefined>("readonly", (s) => s.get(projectId));
            if (!state) {
              toast.message("No saved state for this project yet.");
              return;
            }
            send({ type: "restore", state });
            toast.success("Machine state restored.");
          }}>
          <Upload className="size-3" />
        </Button>
      </div>
      <pre ref={outRef} data-testid="vm-terminal"
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-2 font-mono text-[12px] leading-snug text-foreground">
        {output || "Starting the machine… this can take a minute."}
      </pre>
      <iframe ref={frameRef} title="Linux machine" src={`/v86/vm.html?mem=${memoryMb}`} className="hidden" />
      <form className="flex shrink-0 gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send({ type: "send", text: `${line}\n` });
          setLine("");
        }}>
        <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Type a command and press Enter"
          className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 font-mono text-xs" aria-label="Shell command" />
      </form>
    </div>
  );
}
