import { Loader2, Power, RotateCcw, Save, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const IMAGE_URL = "https://i.copy.sh/buildroot-bzimage68.bin";
export const VM_USER = "forge";
export const VM_PASSWORD = "server123";

/** Commands typed into the VM after boot to create the forge account and sign in as it. */
const SETUP = [
  `adduser -D ${VM_USER} 2>/dev/null || true`,
  `echo '${VM_USER}:${VM_PASSWORD}' | chpasswd 2>/dev/null`,
  `export PS1='${VM_USER}@forge:\\w$ '`,
  `cd /home/${VM_USER} 2>/dev/null; clear; echo "Signed in as ${VM_USER} (password ${VM_PASSWORD})"`,
];

type Emulator = {
  add_listener: (event: string, fn: (value: unknown) => void) => void;
  serial0_send: (text: string) => void;
  save_state: () => Promise<ArrayBuffer>;
  restore_state: (state: ArrayBuffer) => Promise<void>;
  restart: () => void;
  destroy: () => Promise<void>;
  keyboard_set_enabled?: (on: boolean) => void;
};

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

export default function ShellPanel({ projectId, memoryMb = 256 }: { projectId: string; memoryMb?: number }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const emuRef = useRef<Emulator | null>(null);
  const [status, setStatus] = useState<"idle" | "booting" | "ready">("idle");
  const [line, setLine] = useState("");

  async function boot() {
    if (emuRef.current || !screenRef.current) return;
    setStatus("booting");
    const { V86 } = await import("v86");
    const emulator = new V86({
      wasm_path: "/v86/v86.wasm",
      memory_size: memoryMb * 1024 * 1024,
      vga_memory_size: 8 * 1024 * 1024,
      screen_container: screenRef.current,
      bios: { url: "/v86/seabios.bin" },
      vga_bios: { url: "/v86/vgabios.bin" },
      bzimage: { url: IMAGE_URL, async: false },
      cmdline: "tsc=reliable mitigations=off random.trust_cpu=on",
      autostart: true,
      disable_speaker: true,
    }) as unknown as Emulator;
    emuRef.current = emulator;

    let buffer = "";
    let setupDone = false;
    emulator.add_listener("serial0-output-byte", (byte) => {
      buffer = (buffer + String.fromCharCode(byte as number)).slice(-200);
      if (!setupDone && /[#$] $/.test(buffer)) {
        setupDone = true;
        for (const cmd of SETUP) emulator.serial0_send(`${cmd}\n`);
        setStatus("ready");
      }
    });
    // Screen keyboard input also works; the serial console is the reliable path for setup.
    emulator.add_listener("emulator-ready", () => undefined);
    setTimeout(() => {
      if (!setupDone) {
        setupDone = true;
        for (const cmd of SETUP) emulator.serial0_send(`${cmd}\n`);
        setStatus("ready");
      }
    }, 60_000);
  }

  useEffect(() => {
    void boot();
    return () => {
      void emuRef.current?.destroy();
      emuRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col bg-editor">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-chrome px-2 py-1 font-mono text-[11px] text-muted-foreground">
        {status === "booting" ? <Loader2 className="size-3 animate-spin" /> : <Power className="size-3" />}
        <span className="flex-1">
          {status === "ready" ? `Linux · ${VM_USER} / ${VM_PASSWORD} · ${memoryMb} MB` : "Booting Linux in your browser…"}
        </span>
        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => emuRef.current?.restart()} aria-label="Restart VM">
          <RotateCcw className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-2" aria-label="Save VM state"
          onClick={async () => {
            const state = await emuRef.current?.save_state();
            if (state) await idb("readwrite", (s) => s.put(state, projectId));
            toast.success("Machine state saved in this browser.");
          }}>
          <Save className="size-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-2" aria-label="Restore VM state"
          onClick={async () => {
            const state = await idb<ArrayBuffer | undefined>("readonly", (s) => s.get(projectId));
            if (!state) return toast.message("No saved state for this project yet.");
            await emuRef.current?.restore_state(state);
            toast.success("Machine state restored.");
          }}>
          <Upload className="size-3" />
        </Button>
      </div>
      <div ref={screenRef} className="forge-vm min-h-0 flex-1 overflow-auto" data-testid="vm-screen">
        <div style={{ whiteSpace: "pre", font: "14px monospace", lineHeight: "normal" }} />
        <canvas style={{ display: "none" }} />
      </div>
      <form
        className="flex shrink-0 gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          emuRef.current?.serial0_send(`${line}\n`);
          setLine("");
        }}
      >
        <input
          value={line}
          onChange={(e) => setLine(e.target.value)}
          placeholder="Type a command and press Enter (or click the screen and type)"
          className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 font-mono text-xs"
          aria-label="Shell command"
        />
      </form>
    </div>
  );
}
