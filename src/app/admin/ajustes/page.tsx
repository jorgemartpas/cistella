import type { Metadata } from "next";
import { refresh } from "next/cache";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, PageHeader, PageSkeleton } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { centsToInput } from "@/lib/catalog";
import { parseEurosToCents } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, Settings } from "@/lib/types";

export const metadata: Metadata = { title: "Ajustes" };

const settingsSchema = z.object({
  min_order: z.string(),
  allowed_postal_codes: z.string(),
  default_commission_pct: z.coerce.number().min(0).max(100),
  weeks_ahead: z.coerce.number().int().min(1).max(12),
  price_dos_por_semana: z.string(),
  price_semanal: z.string(),
  price_quincenal: z.string(),
  delivery_fee: z.string(),
});

async function saveSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  await requireRole("admin");
  const raw = Object.fromEntries(formData);
  const parsed = settingsSchema.safeParse({
    ...raw,
    default_commission_pct: String(raw.default_commission_pct ?? "").replace(",", "."),
  });
  if (!parsed.success) return { error: "Revisa los valores: hay alguno que no es válido." };
  // [columna, nombre de la casilla, valor, ¿admite 0?]
  const amountFields = [
    ["min_order_cents", "Pedido mínimo", parsed.data.min_order.trim() || "0", true],
    ["price_dos_por_semana_cents", "2 veces por semana", parsed.data.price_dos_por_semana, false],
    ["price_semanal_cents", "Cada semana", parsed.data.price_semanal, false],
    ["price_quincenal_cents", "Cada 2 semanas", parsed.data.price_quincenal, false],
    ["delivery_fee_cents", "Pago por envío", parsed.data.delivery_fee, true],
  ] as const;
  const amounts: Record<string, number> = {};
  for (const [column, label, value, allowZero] of amountFields) {
    const cents = parseEurosToCents(value, { allowZero });
    if (cents === null) return { error: `Revisa «${label}»: escribe el importe así: 15,00` };
    amounts[column] = cents;
  }
  const postalCodes = parsed.data.allowed_postal_codes.split(/[\s,]+/).filter(Boolean);
  if (postalCodes.length === 0 || postalCodes.some((cp) => !/^\d{5}$/.test(cp))) {
    return { error: "Los códigos postales tienen que ser de 5 cifras, separados por comas." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      ...amounts,
      allowed_postal_codes: postalCodes,
      default_commission_pct: parsed.data.default_commission_pct,
      weeks_ahead: parsed.data.weeks_ahead,
    })
    .eq("id", true);
  if (error) return { error: "No se han podido guardar los ajustes." };
  refresh();
  return { ok: "Ajustes guardados." };
}

export default function SettingsPage() {
  return (
    <>
      <BackLink href="/admin">Inicio</BackLink>
      <PageHeader title="Ajustes" subtitle="Valores generales del piloto. Algunos son provisionales (ver DECISIONES.md)." />
      <Suspense fallback={<PageSkeleton />}>
        <SettingsForm />
      </Suspense>
    </>
  );
}

async function SettingsForm() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("*").single<Settings>();
  if (!settings) return null;
  return (
    <ActionForm action={saveSettings}>
      <Field label="Pedido mínimo por reparto (€)" hint="0 = sin mínimo. Las cestas por debajo no se preparan ese día.">
        <Input name="min_order" inputMode="decimal" defaultValue={centsToInput(settings.min_order_cents)} />
      </Field>
      <Field label="Códigos postales con reparto" hint="Separados por comas. Ahora: solo Alzira.">
        <Input name="allowed_postal_codes" defaultValue={settings.allowed_postal_codes.join(", ")} />
      </Field>
      <Field label="Comisión por defecto para tiendas nuevas (%)" hint="Cada tienda tiene la suya en su ficha.">
        <Input name="default_commission_pct" inputMode="decimal" defaultValue={String(settings.default_commission_pct).replace(".", ",")} />
      </Field>
      <Field label="Semanas de repartos programados por adelantado">
        <Input name="weeks_ahead" type="number" min={1} max={12} defaultValue={settings.weeks_ahead} />
      </Field>
      <fieldset className="space-y-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Precios de los planes (IVA incluido)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="2 veces por semana (€/mes)">
            <Input name="price_dos_por_semana" inputMode="decimal" defaultValue={centsToInput(settings.price_dos_por_semana_cents)} />
          </Field>
          <Field label="Cada semana (€/mes)">
            <Input name="price_semanal" inputMode="decimal" defaultValue={centsToInput(settings.price_semanal_cents)} />
          </Field>
          <Field label="Cada 2 semanas (€/mes)">
            <Input name="price_quincenal" inputMode="decimal" defaultValue={centsToInput(settings.price_quincenal_cents)} />
          </Field>
          <Field label="Pago por envío (€ por reparto)">
            <Input name="delivery_fee" inputMode="decimal" defaultValue={centsToInput(settings.delivery_fee_cents)} />
          </Field>
        </div>
        <p className="text-xs text-muted">
          Un precio nuevo se aplica a las altas y cambios de plan desde ese momento; las suscripciones que ya existen
          siguen con su precio.
        </p>
      </fieldset>
      <SubmitButton className="w-full">Guardar ajustes</SubmitButton>
    </ActionForm>
  );
}
