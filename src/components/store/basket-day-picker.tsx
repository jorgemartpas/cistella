"use client";

import { useOptimistic, useTransition } from "react";
import { chooseBasketDay } from "@/lib/actions/basket";
import { cx } from "../ui";

/** Plan de 2 veces por semana: qué cesta se está llenando (la del martes o la del viernes). */
export function BasketDayPicker({ days, current }: { days: { weekday: number; label: string }[]; current: number }) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(current);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Estás llenando la cesta del:</span>
      {days.map((d) => (
        <button
          key={d.weekday}
          type="button"
          aria-pressed={optimistic === d.weekday}
          onClick={() =>
            startTransition(async () => {
              setOptimistic(d.weekday);
              await chooseBasketDay(d.weekday);
            })
          }
          className={cx(
            "rounded-full px-4 py-1.5 font-semibold",
            optimistic === d.weekday ? "bg-primary text-primary-ink" : "border border-border bg-surface hover:bg-surface-2",
          )}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
