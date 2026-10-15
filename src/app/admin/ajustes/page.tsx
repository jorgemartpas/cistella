import type { Metadata } from "next";
import { refresh } from "next/cache";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, PageHeader, PageSkeleton } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { centsToInput, parsePriceCents } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, Settings } from "@/lib/types";

export const metadata: Metadata = { title: "Ajustes" };

const settingsSchema = z.object({
  min_order: z.string(),
  allowed_postal_codes: z.string(),
  default_commission_pct: z.coerce.number().min(0).max(100),
  weeks_ahead: z.coerce.number().int().min(1).max(12),
  subscription_price: z.string(),
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
  const minOrder = parsed.data.min_order.trim() === "" || parsed.data.min_order.trim() === "0"
    ? 0
    : parsePriceCents(parsed.data.min_order);
  const price = parsePriceCents(parsed.data.subscription_price);
  const postalCodes = parsed.data.allowed_postal_codes.split(/[\s,]+/).filter(Boolean);
  if (minOrder === null || price === null) return { error: "Escribe los importes así: 15,00" };
  if (postalCodes.length === 0 || postalCodes.some((cp) => !/^\d{5}$/.test(cp))) {
    return { error: "Los códigos postales tienen que ser de 5 cifras, separados por comas." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      min_order_cents: minOrder,
      allowed_postal_codes: postalCodes,
      default_commission_pct: parsed.data.default_commission_pct,
      weeks_ahead: parsed.data.weeks_ahead,
      subscription_price_cents: price,
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
      <Field
        label="Precio de la suscripción que se muestra (€/mes)"
        hint="Solo es el texto de la web: el cobro real lo define el precio de Stripe (STRIPE_PRICE_ID)."
      >
        <Input name="subscription_price" inputMode="decimal" defaultValue={centsToInput(settings.subscription_price_cents)} />
      </Field>
      <SubmitButton className="w-full">Guardar ajustes</SubmitButton>
    </ActionForm>
  );
}
