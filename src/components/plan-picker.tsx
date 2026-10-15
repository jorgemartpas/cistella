"use client";

import { useState } from "react";
import { WEEKDAY_NAMES, type ScheduleRule } from "@/lib/domain/schedule";
import { FREQUENCY_LABELS, PLAN_ORDER, hasMonthlyFee, needsWeekday, type DeliveryFrequency } from "@/lib/domain/subscription";
import { planPriceLabel, TRIAL_COPY, type PlanPrices } from "@/lib/plans";
import { SubmitButton } from "./forms";

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
  "flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft";

/**
 * Elección de plan (con su precio) y, si el plan lo necesita, del día de reparto. Con `trial`, los
 * planes con cuota muestran la prueba gratis; con `submit`, el botón cambia según el plan elegido.
 */
export function PlanPicker({
  rules,
  prices,
  plan,
  weekday,
  trial = false,
  submit,
}: {
  rules: ScheduleRule[];
  prices: PlanPrices;
  plan?: DeliveryFrequency;
  weekday?: number;
  trial?: boolean;
  submit?: { label: string; trialLabel: string; pendingText: string };
}) {
  const [selected, setSelected] = useState<DeliveryFrequency>(plan ?? "semanal");
  const active = rules.filter((r) => r.active);
  const days = listDays(active.map((r) => r.weekday));
  const descriptions: Record<DeliveryFrequency, string> = {
    dos_por_semana: `Todos los repartos (${days}), con una cesta distinta para cada día.`,
    semanal: "Un reparto a la semana, el día que elijas.",
    quincenal: "Un reparto cada 15 días, el día que elijas (uno sí y otro no).",
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
                  <span className="font-bold">
                    {trial && hasMonthlyFee(p) && <span className="font-medium text-muted">luego </span>}
                    {planPriceLabel(prices, p)}
                  </span>
                </span>
                {trial && hasMonthlyFee(p) && (
                  <span className="mt-1 inline-flex rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-ink">
                    🎁 {TRIAL_COPY.badge}
                  </span>
                )}
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

      {trial && hasMonthlyFee(selected) && (
        <div className="rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
          <p className="font-bold">🎁 {TRIAL_COPY.title}</p>
          <p className="mt-0.5">
            {TRIAL_COPY.rule} Te pedimos la tarjeta ahora, pero no se cobra ninguna cuota hasta que termine la prueba.{" "}
            {TRIAL_COPY.after}
          </p>
        </div>
      )}

      <p className="text-sm text-muted">
        Precios con IVA incluido. Los productos se cobran aparte en cada reparto, con el peso real, a la misma tarjeta.
        {selected !== "por_envio" && " Sin permanencia: puedes pausar, cambiar de plan o darte de baja cuando quieras."}
      </p>

      {submit && (
        <SubmitButton className="w-full" pendingText={submit.pendingText}>
          {trial && hasMonthlyFee(selected) ? submit.trialLabel : submit.label}
        </SubmitButton>
      )}
    </>
  );
}
