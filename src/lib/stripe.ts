import "server-only";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { FREQUENCY_LABELS, type DeliveryFrequency, type SubscriptionStatus } from "@/lib/domain/subscription";

let client: Stripe | null = null;

/** Cliente de Stripe, o null si no está configurado. La v1 solo admite claves de test. */
export function getStripe(): Stripe | null {
  const key = env.stripe.secretKey;
  if (!key) return null;
  if (!/^(sk|rk)_test_/.test(key) && process.env.STRIPE_ALLOW_LIVE !== "true") {
    throw new Error("Stripe está en modo live. Hasta el lanzamiento, Cistella solo usa claves de test (sk_test_…).");
  }
  client ??= new Stripe(key);
  return client;
}

/**
 * Modo demo: sin Stripe, la suscripción se activa sin cobrar. Solo para desarrollo y
 * pruebas; se activa a propósito con PAYMENTS_DEMO_MODE=true y nunca con Stripe configurado.
 */
export function paymentsDemoMode(): boolean {
  return !env.stripe.secretKey && process.env.PAYMENTS_DEMO_MODE === "true";
}

export function mapStripeStatus(sub: Stripe.Subscription): SubscriptionStatus {
  switch (sub.status) {
    case "active":
    case "trialing":
      return sub.pause_collection ? "pausada" : "activa";
    case "paused":
      return "pausada";
    case "past_due":
    case "unpaid":
      return "impagada";
    case "canceled":
    case "incomplete_expired":
      return "cancelada";
    default:
      return "incompleta";
  }
}

/**
 * Precio mensual de un plan en Stripe. Se busca por una clave con el plan y el importe, y si no
 * existe se crea: así basta con cambiar el precio en Ajustes, sin tocar Stripe a mano.
 * Las suscripciones ya existentes siguen con el precio con el que se dieron de alta.
 */
export async function getPlanPrice(
  stripe: Stripe,
  plan: Exclude<DeliveryFrequency, "por_envio">,
  amountCents: number,
): Promise<string> {
  const lookupKey = `cistella_${plan}_${amountCents}`;
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const price = await stripe.prices.create({
    currency: "eur",
    unit_amount: amountCents,
    recurring: { interval: "month" },
    tax_behavior: "inclusive",
    lookup_key: lookupKey,
    product_data: { name: `Cistella · ${FREQUENCY_LABELS[plan]}` },
  });
  return price.id;
}

/** Metadatos que guardamos en la suscripción de Stripe para saber su plan */
export type PlanMetadata = { user_id: string; plan: DeliveryFrequency; weekday: string; anchor: string };

/** Copia el estado de una suscripción de Stripe a la tabla subscriptions (service role). */
export async function syncStripeSubscription(service: SupabaseClient, sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const paymentMethod =
    typeof sub.default_payment_method === "string" ? sub.default_payment_method : (sub.default_payment_method?.id ?? null);
  const periodEnd = sub.items.data[0]?.current_period_end;
  const status = mapStripeStatus(sub);
  const meta = (sub.metadata ?? {}) as Partial<PlanMetadata>;

  // Se busca por la suscripción, por el cliente de Stripe o por el usuario de los metadatos
  const { data: rows } = await service
    .from("subscriptions")
    .select("id, status, frequency, stripe_subscription_id")
    .or(
      [
        `stripe_subscription_id.eq.${sub.id}`,
        `stripe_customer_id.eq.${customerId}`,
        ...(meta.user_id ? [`customer_id.eq.${meta.user_id}`] : []),
      ].join(","),
    )
    .limit(1);
  const row = rows?.[0];
  if (!row) return false;
  // Un evento tardío de una suscripción anterior no pisa la nueva del mismo cliente
  if (row.stripe_subscription_id && row.stripe_subscription_id !== sub.id && status === "cancelada") {
    return false;
  }

  const stripeIds = { stripe_customer_id: customerId, ...(paymentMethod ? { stripe_payment_method_id: paymentMethod } : {}) };
  const isUpgradeFromPerDelivery = meta.plan && meta.plan !== "por_envio" && status !== "cancelada";
  if (row.frequency === "por_envio" && !isUpgradeFromPerDelivery) {
    // Ha pasado a pago por envío: la cuota antigua solo se termina; su plan sigue activo
    const { error } = await service.from("subscriptions").update(stripeIds).eq("id", row.id);
    return !error;
  }

  // El plan viene de los metadatos cuando se contrata o se cambia desde Stripe (alta o paso desde pago por envío)
  const planChanged = meta.plan && meta.weekday && meta.anchor && (row.frequency !== meta.plan || row.status === "incompleta");
  const { error } = await service
    .from("subscriptions")
    .update({
      ...stripeIds,
      status,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      // Prueba gratis: se recuerda que la ha usado; mientras dura, hasta cuándo
      ...(sub.trial_start ? { trial_started_at: new Date(sub.trial_start * 1000).toISOString() } : {}),
      trial_ends_at: sub.status === "trialing" && sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      ...(planChanged
        ? { frequency: meta.plan, delivery_weekday: Number(meta.weekday), anchor_date: meta.anchor }
        : {}),
    })
    .eq("id", row.id);
  return !error;
}

/**
 * Pago por envío: al terminar el Checkout en modo "setup" queda guardada la tarjeta para cobrar
 * cada reparto, y el plan pasa a activo.
 */
export async function completeCardSetup(service: SupabaseClient, stripe: Stripe, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id ?? session.client_reference_id;
  const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!userId || !setupIntentId || !customerId) return false;
  const intent = await stripe.setupIntents.retrieve(setupIntentId);
  const paymentMethod = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
  if (!paymentMethod) return false;
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethod } });
  const { error } = await service
    .from("subscriptions")
    .update({ stripe_payment_method_id: paymentMethod, stripe_customer_id: customerId, status: "activa" })
    .eq("customer_id", userId)
    .eq("frequency", "por_envio");
  return !error;
}
