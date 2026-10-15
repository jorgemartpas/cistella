"use client";

import { useOptimistic, useState, useTransition } from "react";
import { confirmDelivery } from "@/lib/actions/basket";
import { Icon } from "./icons";
import { cx } from "./ui";

/** Pago por envío: pedir o anular un reparto suelto. */
export function DeliveryRequestToggle({
  dayId,
  requested,
  label,
}: {
  dayId: string;
  requested: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(requested);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-pressed={optimistic}
        aria-label={`${optimistic ? "Anular" : "Pedir"} el reparto del ${label}`}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            setOptimistic(!optimistic);
            const result = await confirmDelivery(dayId, !optimistic);
            if (result.error) setError(result.error);
          });
        }}
        className={cx(
          "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold",
          optimistic ? "bg-primary-soft text-primary" : "bg-primary text-primary-ink",
          pending && "opacity-70",
        )}
      >
        {optimistic ? (
          <>
            <Icon name="check" className="size-4" /> Pedido
          </>
        ) : (
          "Pedir"
        )}
      </button>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
