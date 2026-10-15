import { capitalize } from "@/lib/format";
import { WEEKDAY_NAMES, type ScheduleRule } from "@/lib/domain/schedule";
import { FREQUENCY_LABELS, type DeliveryFrequency } from "@/lib/domain/subscription";
import type { Profile } from "@/lib/types";
import { Field, Input } from "./ui";

/** Datos de contacto y entrega del cliente */
export function ProfileFields({ profile }: { profile: Profile }) {
  return (
    <>
      <Field label="Nombre y apellidos">
        <Input name="full_name" defaultValue={profile.full_name} autoComplete="name" required />
      </Field>
      <Field label="Teléfono" hint="Para avisarte el día del reparto">
        <Input name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" inputMode="tel" required />
      </Field>
      <Field label="Dirección de entrega" hint="Calle, número, piso y puerta">
        <Input name="address" defaultValue={profile.address ?? ""} autoComplete="street-address" required />
      </Field>
      <Field label="Código postal" hint="De momento solo repartimos en Alzira">
        <Input
          name="postal_code"
          defaultValue={profile.postal_code ?? "46600"}
          autoComplete="postal-code"
          inputMode="numeric"
          pattern="\d{5}"
          required
        />
      </Field>
    </>
  );
}

function cutoffText(rule: ScheduleRule) {
  const day = WEEKDAY_NAMES[((rule.weekday - rule.cutoffDaysBefore - 1 + 7) % 7) + 1];
  return rule.cutoffDaysBefore === 0
    ? `cierre ese mismo día a las ${rule.cutoffTime}`
    : `cierre el ${day} a las ${rule.cutoffTime}`;
}

/** Día de reparto y frecuencia */
export function PlanFields({
  rules,
  weekday,
  frequency,
}: {
  rules: ScheduleRule[];
  weekday?: number;
  frequency?: DeliveryFrequency;
}) {
  const active = rules.filter((r) => r.active);
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Día de reparto</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {active.map((rule, i) => (
            <label
              key={rule.weekday}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
            >
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
                <span className="block text-sm text-muted">{capitalize(cutoffText(rule))}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">¿Cada cuánto?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(FREQUENCY_LABELS) as DeliveryFrequency[]).map((f) => (
            <label
              key={f}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
            >
              <input
                type="radio"
                name="frequency"
                value={f}
                defaultChecked={(frequency ?? "semanal") === f}
                className="size-5 accent-[var(--primary)]"
              />
              <span className="font-semibold">{FREQUENCY_LABELS[f]}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
