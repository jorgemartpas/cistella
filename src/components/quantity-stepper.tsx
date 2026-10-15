"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setBasketQuantity } from "@/lib/actions/basket";
import { formatQuantity, normalizeQuantity, parseQuantity, quantityStep, type ProductUnit } from "@/lib/domain/money";
import { Icon } from "./icons";
import { cx } from "./ui";

const UNIT_SUFFIX: Record<ProductUnit, string> = { kg: "kg", unidad: "ud.", bandeja: "bandejas" };

/**
 * Añadir, sumar y restar un producto de la cesta recurrente. Pulsando la cantidad se puede
 * escribir la exacta (al gramo en lo que va al kilo).
 */
export function QuantityStepper({
  productId,
  productName,
  unit,
  quantity,
  slot = 0,
  variant = "row",
}: {
  productId: string;
  productName: string;
  unit: ProductUnit;
  quantity: number;
  /** Cesta: 0 la única, o el día de la semana (plan de 2 veces por semana) */
  slot?: number;
  /** "card": a todo el ancho, para las tarjetas de producto */
  variant?: "row" | "card";
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(quantity);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const step = quantityStep(unit);
  const card = variant === "card";

  const change = (next: number) => {
    const value = Math.max(0, normalizeQuantity(next, unit));
    setError(null);
    startTransition(async () => {
      setOptimistic(value);
      const result = await setBasketQuantity(productId, value, slot);
      if (result.error) setError(result.error);
    });
  };

  const submitTyped = (input: string) => {
    const typed = parseQuantity(input);
    if (typed === null || typed > 50) {
      setError(unit === "kg" ? "Escribe el peso así: 0,3" : "Escribe un número entero.");
      return;
    }
    setEditing(false);
    if (normalizeQuantity(typed, unit) !== optimistic) change(typed);
  };

  if (editing) {
    return (
      <div className={cx("flex flex-col gap-1", card ? "items-stretch" : "items-end")}>
        <form
          className={cx(
            "inline-flex items-center gap-1 rounded-full border border-primary bg-surface pl-3",
            card && "justify-end",
          )}
          onSubmit={(e) => {
            e.preventDefault();
            submitTyped(String(new FormData(e.currentTarget).get("quantity") ?? ""));
          }}
        >
          <input
            name="quantity"
            inputMode={unit === "kg" ? "decimal" : "numeric"}
            defaultValue={String(optimistic).replace(".", ",")}
            aria-label={`Cantidad exacta de ${productName}`}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            className="w-16 bg-transparent py-2 text-right text-sm font-semibold tabular-nums"
            // El borde verde del óvalo ya marca el foco (la regla global de :focus-visible no cede ante clases)
            style={{ outline: "none" }}
          />
          <span className="text-sm text-muted">{UNIT_SUFFIX[unit]}</span>
          <button
            type="submit"
            className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-primary-soft"
            aria-label={`Guardar la cantidad de ${productName}`}
          >
            <Icon name="check" className="size-4" />
          </button>
        </form>
        {error && (
          <p role="alert" className="max-w-56 text-right text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col gap-1", card ? "items-stretch" : "items-end")}>
      {optimistic === 0 ? (
        <button
          type="button"
          onClick={() => change(unit === "kg" ? 0.5 : 1)}
          className={cx(
            "inline-flex min-h-10 items-center justify-center gap-1 rounded-full px-4 text-sm font-semibold",
            card
              ? "w-full border border-primary text-primary hover:bg-primary-soft"
              : "bg-primary text-primary-ink",
          )}
          aria-label={`Añadir ${productName}`}
        >
          <Icon name="plus" className="size-4" /> {card ? "Añadir a la cesta" : "Añadir"}
        </button>
      ) : (
        <div
          className={cx(
            "inline-flex items-center rounded-full border bg-surface",
            card ? "w-full justify-between border-primary bg-primary-soft" : "border-border",
            pending && "opacity-80",
          )}
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
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing(true);
            }}
            className="min-w-20 rounded-md text-center text-sm font-semibold tabular-nums underline decoration-dotted underline-offset-4"
            aria-label={`${formatQuantity(optimistic, unit)}. Escribir la cantidad exacta de ${productName}`}
            title="Escribir la cantidad exacta"
          >
            <span aria-live="polite">{formatQuantity(optimistic, unit)}</span>
          </button>
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
