"use client";

import { useState, useTransition } from "react";
import { applyList } from "@/lib/actions/lists";
import { buttonStyles, cx } from "../ui";

/** «Usar esta cesta» (sustituye la cesta) o «Añadir todo a mi cesta» (lista). */
export function ApplyListButton({
  listId,
  kind,
  slot,
  basketLabel,
  variant = "primary",
  className,
}: {
  listId: string;
  kind: "lista" | "cesta";
  slot: number;
  /** "tu cesta" o "tu cesta del martes" */
  basketLabel: string;
  variant?: "primary" | "outline";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);
  return (
    <div className={className}>
      <button
        type="button"
        disabled={pending}
        className={cx(buttonStyles[variant], "w-full")}
        onClick={() => {
          if (kind === "cesta" && !window.confirm(`Se cambiará ${basketLabel} por esta cesta guardada. ¿Seguir?`)) return;
          setMessage(null);
          startTransition(async () => setMessage(await applyList(listId, slot)));
        }}
      >
        {pending ? "Un momento…" : kind === "cesta" ? "Usar esta cesta" : "Añadir todo a mi cesta"}
      </button>
      {message && (
        <p role={message.error ? "alert" : "status"} className={cx("mt-2 text-sm", message.error ? "text-danger" : "text-primary")}>
          {message.error ?? message.ok}
        </p>
      )}
    </div>
  );
}
