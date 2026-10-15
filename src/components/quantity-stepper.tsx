"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setBasketQuantity } from "@/lib/actions/basket";
import { formatQuantity, quantityStep, type ProductUnit } from "@/lib/domain/money";
import { Icon } from "./icons";
import { cx } from "./ui";

/** Añadir, sumar y restar un producto de la cesta recurrente. */
export function QuantityStepper({
  productId,
  productName,
  unit,
  quantity,
  slot = 0,
}: {
  productId: string;
  productName: string;
  unit: ProductUnit;
  quantity: number;
  /** Cesta: 0 la única, o el día de la semana (plan de 2 veces por semana) */
  slot?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(quantity);
  const [error, setError] = useState<string | null>(null);
  const step = quantityStep(unit);

  const change = (next: number) => {
    const value = Math.max(0, Math.round(next / step) * step);
    setError(null);
    startTransition(async () => {
      setOptimistic(value);
      const result = await setBasketQuantity(productId, value, slot);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      {optimistic === 0 ? (
        <button
          type="button"
          onClick={() => change(unit === "kg" ? 0.5 : 1)}
          className="inline-flex min-h-10 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-ink"
          aria-label={`Añadir ${productName}`}
        >
          <Icon name="plus" className="size-4" /> Añadir
        </button>
      ) : (
        <div
          className={cx("inline-flex items-center rounded-full border border-border bg-surface", pending && "opacity-80")}
          role="group"
          aria-label={`Cantidad de ${productName}`}
        >
          <button
            type="button"
            onClick={() => change(optimistic - step)}
            className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-primary-soft"
            aria-label={optimistic <= step ? `Quitar ${productName}` : `Menos ${productName}`}
          >
            <Icon name={optimistic <= step ? "trash" : "minus"} className="size-4" />
          </button>
          <span className="min-w-20 text-center text-sm font-semibold tabular-nums" aria-live="polite">
            {formatQuantity(optimistic, unit)}
          </span>
          <button
            type="button"
            onClick={() => change(optimistic + step)}
            className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-primary-soft"
            aria-label={`Más ${productName}`}
          >
            <Icon name="plus" className="size-4" />
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="max-w-56 text-right text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
