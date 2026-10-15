"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { markChatRead } from "@/lib/actions/chat";

/**
 * Mantiene la conversación al día: la marca como leída, baja al último mensaje cuando llega uno
 * nuevo y vuelve a pedir los mensajes cada pocos segundos mientras la página está a la vista.
 */
export function ChatLive({ shopId, lastId }: { shopId: string; lastId: string | null }) {
  const router = useRouter();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void markChatRead(shopId);
    end.current?.scrollIntoView({ block: "end" });
  }, [shopId, lastId]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, 8000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [router]);

  return <div ref={end} aria-hidden />;
}
