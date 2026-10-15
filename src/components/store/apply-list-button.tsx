"use client";

import { useState, useTransition } from "react";
import { applyList } from "@/lib/actions/lists";
import { buttonStyles, cx } from "../ui";

/** «Usar esta cesta» (sustituye la cesta que se está llenando) o «Añadir a mi cesta» (suma lo que falte). */
export function ApplyListButton({
  listId,
  mode,
  slot,
  basketLabel,
  variant = "primary",
  className,
}: {
  listId: string;
  mode: "sustituir" | "añadir";
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
          if (mode === "sustituir" && !window.confirm(`Se cambiará ${basketLabel} por esta cesta guardada. ¿Seguir?`)) return;
          setMessage(null);
          startTransition(async () => setMessage(await applyList(listId, slot, mode)));
        }}
      >
        {pending ? "Un momento…" : mode === "sustituir" ? "Usar esta cesta" : "Añadir a mi cesta"}
      </button>
      {message && (
        <p role={message.error ? "alert" : "status"} className={cx("mt-2 text-sm", message.error ? "text-danger" : "text-primary")}>
          {message.error ?? message.ok}
        </p>
      )}
    </div>
  );
}
