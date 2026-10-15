"use client";

import { useState } from "react";
import { WEEKDAY_NAMES, type ScheduleRule } from "@/lib/domain/schedule";
import { FREQUENCY_LABELS, PLAN_ORDER, needsWeekday, type DeliveryFrequency } from "@/lib/domain/subscription";
import { planPriceLabel, type PlanPrices } from "@/lib/plans";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function cutoffText(rule: ScheduleRule) {
  const day = WEEKDAY_NAMES[((rule.weekday - rule.cutoffDaysBefore - 1 + 7) % 7) + 1];
  return rule.cutoffDaysBefore === 0
    ? `Cierre ese mismo día a las ${rule.cutoffTime}`
    : `Cierre el ${day} a las ${rule.cutoffTime}`;
}

function listDays(weekdays: number[]) {
  const names = weekdays.map((w) => WEEKDAY_NAMES[w]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names.at(-1)}` : (names[0] ?? "");
}

const radioCard =
  "flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft";

/** Elección de plan (con su precio) y, si el plan lo necesita, del día de reparto. */
export function PlanPicker({
  rules,
  prices,
  plan,
  weekday,
}: {
  rules: ScheduleRule[];
  prices: PlanPrices;
  plan?: DeliveryFrequency;
  weekday?: number;
}) {
  const [selected, setSelected] = useState<DeliveryFrequency>(plan ?? "semanal");
  const active = rules.filter((r) => r.active);
  const days = listDays(active.map((r) => r.weekday));
  const descriptions: Record<DeliveryFrequency, string> = {
    dos_por_semana: `Todos los repartos (${days}), con una cesta distinta para cada día.`,
    semanal: "Un reparto a la semana, el día que elijas.",
    quincenal: "Un reparto cada dos semanas, el día que elijas.",
    por_envio: "Sin cuota mensual. Pides solo los repartos que quieras y pagas el envío de cada uno.",
  };

  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Elige tu plan</legend>
        <div className="grid gap-2">
          {PLAN_ORDER.map((p) => (
            <label key={p} className={radioCard}>
              <input
                type="radio"
                name="plan"
                value={p}
                checked={selected === p}
                onChange={() => setSelected(p)}
                className="size-5 shrink-0 accent-[var(--primary)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">{FREQUENCY_LABELS[p]}</span>
                  <span className="font-bold">{planPriceLabel(prices, p)}</span>
                </span>
                <span className="block text-sm text-muted">{descriptions[p]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {needsWeekday(selected) && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Día de reparto</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {active.map((rule, i) => (
              <label key={rule.weekday} className={radioCard}>
                <input
                  type="radio"
                  name="delivery_weekday"
                  value={rule.weekday}
                  defaultChecked={weekday ? weekday === rule.weekday : i === 0}
                  className="size-5 accent-[var(--primary)]"
                  required
                />
                <span>
                  <span className="block font-semibold">{capitalize(WEEKDAY_NAMES[rule.weekday])}</span>
                  <span className="block text-sm text-muted">{cutoffText(rule)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-sm text-muted">
        Precios con IVA incluido. Los productos se cobran aparte en cada reparto, con el peso real, a la misma tarjeta.
        {selected !== "por_envio" && " Sin permanencia: puedes pausar, cambiar de plan o darte de baja cuando quieras."}
      </p>
    </>
  );
}
