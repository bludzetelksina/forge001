import { useEffect, useState } from "react";
import * as Y from "yjs";

import { supabase } from "@/integrations/supabase/client";

const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * A shared text document for one file, merged letter by letter between
 * everyone who has it open. Updates travel over a realtime broadcast channel.
 */
export function useLiveText(fileId: string | null, initial: string, enabled: boolean) {
  const [ytext, setYtext] = useState<Y.Text | null>(null);

  useEffect(() => {
    if (!fileId || !enabled) return;
    const doc = new Y.Doc();
    const text = doc.getText("content");
    const channel = supabase.channel(`live-${fileId}`, { config: { broadcast: { self: false } } });
    let ready = false;

    const markReady = () => {
      if (ready) return;
      ready = true;
      setYtext(text);
    };

    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      void channel.send({ type: "broadcast", event: "update", payload: { u: toB64(update) } });
    });

    channel
      .on("broadcast", { event: "update" }, ({ payload }) => {
        Y.applyUpdate(doc, fromB64(payload.u), "remote");
      })
      .on("broadcast", { event: "state" }, ({ payload }) => {
        Y.applyUpdate(doc, fromB64(payload.u), "remote");
        markReady();
      })
      .on("broadcast", { event: "hello" }, () => {
        if (!ready) return;
        void channel.send({ type: "broadcast", event: "state", payload: { u: toB64(Y.encodeStateAsUpdate(doc)) } });
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void channel.send({ type: "broadcast", event: "hello", payload: {} });
        // Nobody else has this file open: start the shared document from the saved text.
        setTimeout(() => {
          if (ready) return;
          if (text.length === 0 && initial) doc.transact(() => text.insert(0, initial), "init");
          markReady();
        }, 800);
      });

    return () => {
      setYtext(null);
      void supabase.removeChannel(channel);
      doc.destroy();
    };
    // initial is only read when the document is first created
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, enabled]);

  return ytext;
}
