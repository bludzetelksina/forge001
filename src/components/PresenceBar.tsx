import type { PresencePeer } from "@/lib/presence";

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "??";
}

/** Who else has this project open right now. */
export default function PresenceBar({ peers }: { peers: PresencePeer[] }) {
  if (!peers.length) return null;

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-chrome px-3 py-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Here now</span>
      {peers.map((peer) => (
        <span
          key={peer.userId}
          className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
          title={peer.filePath ? `${peer.name} — ${peer.filePath}` : peer.name}
        >
          <span
            className="grid size-4 place-items-center rounded-full text-[8px] font-semibold text-background"
            style={{ background: peer.colour }}
          >
            {initials(peer.name)}
          </span>
          <span className="text-foreground">{peer.name}</span>
          {peer.filePath ? <span className="hidden sm:inline">{peer.filePath}</span> : null}
        </span>
      ))}
    </div>
  );
}
