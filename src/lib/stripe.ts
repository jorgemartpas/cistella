import "server-only";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { SubscriptionStatus } from "@/lib/domain/subscription";

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

/** Copia el estado de una suscripción de Stripe a la tabla subscriptions (service role). */
export async function syncStripeSubscription(service: SupabaseClient, sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const paymentMethod =
    typeof sub.default_payment_method === "string" ? sub.default_payment_method : (sub.default_payment_method?.id ?? null);
  const periodEnd = sub.items.data[0]?.current_period_end;
  const values = {
    status: mapStripeStatus(sub),
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    ...(paymentMethod ? { stripe_payment_method_id: paymentMethod } : {}),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
  };

  // Se busca por la suscripción, por el cliente de Stripe o por el usuario de los metadatos
  const userId = sub.metadata?.user_id;
  const { data: rows } = await service
    .from("subscriptions")
    .select("id, stripe_subscription_id")
    .or(
      [
        `stripe_subscription_id.eq.${sub.id}`,
        `stripe_customer_id.eq.${customerId}`,
        ...(userId ? [`customer_id.eq.${userId}`] : []),
      ].join(","),
    )
    .limit(1);
  const row = rows?.[0];
  if (!row) return false;
  // Un evento tardío de una suscripción anterior no pisa la nueva del mismo cliente
  if (row.stripe_subscription_id && row.stripe_subscription_id !== sub.id && values.status === "cancelada") {
    return false;
  }
  const { error } = await service.from("subscriptions").update(values).eq("id", row.id);
  return !error;
}
