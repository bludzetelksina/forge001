import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type PresencePeer = {
  userId: string;
  name: string;
  colour: string;
  filePath: string | null;
  anchor: number;
  head: number;
};

const COLOURS = [
  "oklch(0.78 0.18 140)",
  "oklch(0.75 0.17 250)",
  "oklch(0.78 0.18 60)",
  "oklch(0.72 0.19 20)",
  "oklch(0.76 0.15 320)",
  "oklch(0.80 0.14 190)",
];

export function colourFor(userId: string) {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return COLOURS[hash % COLOURS.length]!;
}

type Local = { filePath: string | null; anchor: number; head: number };

/**
 * Shows who else has this project open, and where their cursor sits.
 * Text itself is not merged — saves still replace the whole file.
 */
export function useProjectPresence(
  projectId: string,
  me: { userId: string | null; name: string },
  local: Local,
) {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localRef = useRef(local);
  localRef.current = local;

  const colour = useMemo(() => (me.userId ? colourFor(me.userId) : COLOURS[0]!), [me.userId]);

  useEffect(() => {
    if (!me.userId) return;
    const channel = supabase.channel(`presence-${projectId}`, {
      config: { presence: { key: me.userId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePeer>();
        const next: PresencePeer[] = [];
        for (const [key, entries] of Object.entries(state)) {
          if (key === me.userId) continue;
          const entry = entries[entries.length - 1];
          if (entry) next.push(entry as unknown as PresencePeer);
        }
        setPeers(next);
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void channel.track({
          userId: me.userId,
          name: me.name,
          colour,
          ...localRef.current,
        });
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [projectId, me.userId, me.name, colour]);

  /* Throttled cursor updates. */
  useEffect(() => {
    if (!me.userId) return;
    const timer = setTimeout(() => {
      void channelRef.current?.track({
        userId: me.userId,
        name: me.name,
        colour,
        ...local,
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [local.filePath, local.anchor, local.head, me.userId, me.name, colour, local]);

  return { peers, colour };
}
