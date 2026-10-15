"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isProfileComplete, requireRole } from "@/lib/auth";
import { getScheduleRules } from "@/lib/delivery";
import { nextOpenDateForWeekday } from "@/lib/domain/schedule";
import { env } from "@/lib/env";
import { getStripe, paymentsDemoMode, syncStripeSubscription } from "@/lib/stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionState, Subscription } from "@/lib/types";

const planSchema = z.object({
  delivery_weekday: z.coerce.number().int().min(1).max(7),
  frequency: z.enum(["semanal", "quincenal", "mensual"], { error: "Elige cada cuánto quieres el reparto" }),
});

/** Primer reparto abierto del día elegido: sirve de ancla para la frecuencia. */
async function anchorFor(weekday: number): Promise<string | null> {
  const supabase = await createClient();
  const rules = await getScheduleRules(supabase);
  return nextOpenDateForWeekday(rules, weekday, new Date())?.date ?? null;
}

async function currentSubscription(customerId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").eq("customer_id", customerId).maybeSingle<Subscription>();
  return data;
}

/** Alta: guarda el plan y lleva al cliente al pago de Stripe (o activa en modo demo). */
export async function startSubscription(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  if (!isProfileComplete(profile)) return { error: "Antes completa tus datos de entrega." };
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const anchor = await anchorFor(parsed.data.delivery_weekday);
  if (!anchor) return { error: "Ese día ya no hay reparto. Elige otro." };

  const existing = await currentSubscription(profile.id);
  if (existing && ["activa", "pausada", "impagada"].includes(existing.status)) {
    return { error: "Ya tienes una suscripción. Puedes cambiarla desde tu cuenta." };
  }

  const service = createServiceClient();
  const plan = { ...parsed.data, anchor_date: anchor };
  const stripe = getStripe();

  if (!stripe) {
    if (!paymentsDemoMode()) return { error: "Los pagos aún no están configurados. Inténtalo más tarde." };
    const { error } = await service.from("subscriptions").upsert(
      {
        customer_id: profile.id,
        ...plan,
        status: "activa",
        cancel_at_period_end: false,
        current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      },
      { onConflict: "customer_id" },
    );
    if (error) return { error: "No se ha podido activar la suscripción." };
    redirect("/bienvenida?pago=ok");
  }

  const priceId = env.stripe.priceId;
  if (!priceId) return { error: "Falta configurar el precio de la suscripción (STRIPE_PRICE_ID)." };

  let stripeCustomerId = existing?.stripe_customer_id ?? null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: profile.email ?? undefined,
      name: profile.full_name,
      phone: profile.phone ?? undefined,
      metadata: { user_id: profile.id },
    });
    stripeCustomerId = customer.id;
  }
  const { error } = await service
    .from("subscriptions")
    .upsert(
      { customer_id: profile.id, ...plan, status: "incompleta", stripe_customer_id: stripeCustomerId },
      { onConflict: "customer_id" },
    );
  if (error) return { error: "No se ha podido preparar la suscripción." };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    client_reference_id: profile.id,
    line_items: [{ price: priceId, quantity: 1 }],
    locale: "es",
    payment_method_collection: "always",
    subscription_data: { metadata: { user_id: profile.id } },
    metadata: { user_id: profile.id },
    success_url: `${env.siteUrl}/bienvenida?pago=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.siteUrl}/bienvenida?pago=cancelado`,
  });
  if (!session.url) return { error: "No se ha podido abrir el pago. Inténtalo de nuevo." };
  redirect(session.url);
}

/**
 * Al volver de Stripe se sincroniza la suscripción sin esperar al webhook
 * (que es la vía principal y la que mantiene el estado al día después).
 */
export async function syncCheckoutSession(sessionId: string, customerId: string) {
  const stripe = getStripe();
  if (!stripe) return;
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== customerId || !session.subscription || typeof session.subscription === "string") return;
  await syncStripeSubscription(createServiceClient(), session.subscription);
}

/** Cambio de frecuencia o día: el primer reparto pasa a ser el siguiente abierto de ese día. */
export async function updatePlan(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const anchor = await anchorFor(parsed.data.delivery_weekday);
  if (!anchor) return { error: "Ese día ya no hay reparto. Elige otro." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ ...parsed.data, anchor_date: anchor })
    .eq("customer_id", profile.id);
  if (error) return { error: "No se ha podido cambiar el reparto." };
  refresh();
  return { ok: "Hecho. Tu próximo reparto ya tiene en cuenta el cambio." };
}

type LifecycleAction = "pausar" | "reanudar" | "cancelar" | "mantener";

/** Pausa, reanudación y baja. En Stripe la pausa anula las cuotas mientras dure. */
export async function changeSubscription(action: LifecycleAction): Promise<void> {
  const profile = await requireRole("cliente");
  const sub = await currentSubscription(profile.id);
  if (!sub) redirect("/bienvenida");

  const service = createServiceClient();
  const stripe = getStripe();
  const reanchor = async () => {
    const anchor = await anchorFor(sub.delivery_weekday);
    if (anchor) await service.from("subscriptions").update({ anchor_date: anchor }).eq("id", sub.id);
  };

  if (stripe && sub.stripe_subscription_id) {
    const params =
      action === "pausar"
        ? { pause_collection: { behavior: "void" as const } }
        : action === "reanudar"
          ? { pause_collection: "" as const }
          : { cancel_at_period_end: action === "cancelar" };
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, params);
    await syncStripeSubscription(service, updated);
  } else if (paymentsDemoMode()) {
    const values =
      action === "pausar"
        ? { status: "pausada" as const }
        : action === "reanudar"
          ? { status: "activa" as const }
          : { cancel_at_period_end: action === "cancelar" };
    await service.from("subscriptions").update(values).eq("id", sub.id);
  }
  if (action === "reanudar") await reanchor();
  refresh();
}

/** Portal de Stripe para cambiar la tarjeta y ver facturas. */
export async function openBillingPortal() {
  const profile = await requireRole("cliente");
  const sub = await currentSubscription(profile.id);
  const stripe = getStripe();
  if (!stripe || !sub?.stripe_customer_id) redirect("/cuenta");
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${env.siteUrl}/cuenta`,
    locale: "es",
  });
  redirect(portal.url);
}
