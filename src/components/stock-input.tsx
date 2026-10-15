"use client";

import { useState, useTransition } from "react";
import { setStock } from "@/lib/actions/inventory";
import { UNIT_LABELS, type ProductUnit } from "@/lib/domain/money";
import { Icon } from "./icons";
import { cx } from "./ui";

const toInput = (n: number | null) =>
  n === null ? "" : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3, useGrouping: false }).format(n);

/** Casilla del inventario: cuánto hay de un producto. Se guarda con «Guardar» o Intro. */
export function StockInput({
  shopId,
  productId,
  productName,
  unit,
  stock,
}: {
  shopId: string;
  productId: string;
  productName: string;
  unit: ProductUnit;
  stock: number | null;
}) {
  const [value, setValue] = useState(toInput(stock));
  const [saved, setSaved] = useState(toInput(stock));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = value.trim() !== saved;

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await setStock(shopId, productId, value);
      if (result.error) setError(result.error);
      else setSaved(value.trim());
    });
  };

  return (
    <form
      className="flex flex-col items-end gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex items-center gap-2">
        <label className="flex items-center overflow-hidden rounded-full border border-border bg-surface focus-within:border-primary">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder="—"
            aria-label={`Inventario de ${productName} (${UNIT_LABELS[unit].plural})`}
            className="w-20 bg-transparent py-1.5 pl-3 text-right font-semibold tabular-nums"
            style={{ outline: "none" }}
          />
          <span className="pl-1 pr-3 text-sm text-muted">{unit === "kg" ? "kg" : UNIT_LABELS[unit].plural}</span>
        </label>
        <button
          type="submit"
          disabled={pending || !changed}
          className={cx(
            "inline-flex min-w-20 items-center justify-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold",
            changed ? "bg-primary text-primary-ink hover:bg-primary-hover" : "text-muted",
          )}
        >
          {pending ? "…" : changed ? "Guardar" : saved !== "" ? <><Icon name="check" className="size-4" /> Guardado</> : null}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
