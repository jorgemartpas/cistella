"use client";

import { useState, useTransition } from "react";
import { setAutoDelivery } from "@/lib/actions/lists";
import { Icon } from "../icons";
import { buttonStyles, cx } from "../ui";

/** Activa o quita el envío automático con una cesta guardada. */
export function AutoDeliveryToggle({ listId, on, otherName }: { listId: string; on: boolean; otherName?: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className={cx(on ? buttonStyles.secondary : buttonStyles.primary, "w-full sm:w-auto sm:px-6")}
        onClick={() => {
          const question = on
            ? "Dejarás de recibir los repartos solos: tendrás que confirmar cada pedido. ¿Quitar el envío automático?"
            : `Tu cesta pasará a ser esta y tus próximos repartos se prepararán solos con ella${otherName ? ` (en lugar de «${otherName}»)` : ""}. ¿Activar?`;
          if (!window.confirm(question)) return;
          setMessage(null);
          startTransition(async () => setMessage(await setAutoDelivery(listId, !on)));
        }}
      >
        <Icon name={on ? "pause" : "check"} className="size-5" />
        {pending ? "Un momento…" : on ? "Quitar el envío automático" : "Activar envío automático con esta cesta"}
      </button>
      {message && (
        <p role={message.error ? "alert" : "status"} className={cx("text-sm", message.error ? "text-danger" : "text-primary")}>
          {message.error ?? message.ok}
        </p>
      )}
    </div>
  );
}
