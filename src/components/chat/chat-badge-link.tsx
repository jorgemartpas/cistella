"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getChatUnread } from "@/lib/actions/chat";
import { Icon } from "../icons";

/** Icono de mensajes de la cabecera con los no leídos; se actualiza solo cada medio minuto. */
export function ChatBadgeLink({ href, initial }: { href: string; initial: number }) {
  // Lo último consultado, mientras el servidor no mande otro número
  const [polled, setPolled] = useState<{ base: number; value: number } | null>(null);
  const count = polled && polled.base === initial ? polled.value : initial;

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const value = await getChatUnread();
      setPolled({ base: initial, value });
    };
    const id = window.setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [initial]);

  const label = count === 0 ? "Mensajes" : count === 1 ? "1 mensaje sin leer" : `${count} mensajes sin leer`;
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="relative flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
    >
      <Icon name="chat" className="size-5" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
