import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { trialState, trialUsedUp, type TrialState } from "@/lib/domain/trial";
import { getStripe, syncStripeSubscription } from "@/lib/stripe";

/** Pedidos preparados desde que empezó la prueba (todos menos los anulados). */
export async function ordersInTrial(supabase: SupabaseClient, customerId: string, startedAt: string): Promise<number> {
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .gte("created_at", startedAt)
    .neq("status", "cancelado");
  return count ?? 0;
}

/** La prueba en curso de un cliente (null si no está de prueba). */
export async function getTrial(
  supabase: SupabaseClient,
  sub: { customer_id: string; trial_started_at: string | null; trial_ends_at: string | null } | null,
  now = new Date(),
): Promise<TrialState | null> {
  if (!sub?.trial_started_at || !sub.trial_ends_at || new Date(sub.trial_ends_at) <= now) return null;
  return trialState(sub.trial_ends_at, await ordersInTrial(supabase, sub.customer_id, sub.trial_started_at), now);
}

/**
 * Termina la prueba de quien ya tiene preparados sus 2 pedidos: Stripe cobra la cuota en ese
 * momento y el plan sigue con su cuota mensual (si el cobro falla, queda impagada y no recibe más
 * pedidos); si se había dado de baja, el plan termina sin cobrar. Por tiempo la termina Stripe solo. Se llama al cerrar cada reparto y en cada cron,
 * que reintenta si Stripe falló. Devuelve cuántas pruebas ha terminado.
 */
export async function endUsedUpTrials(service: SupabaseClient, customerIds?: string[]): Promise<number> {
  if (customerIds && customerIds.length === 0) return 0;
  const now = new Date();
  let query = service
    .from("subscriptions")
    .select("id, customer_id, stripe_subscription_id, trial_started_at, trial_ends_at, cancel_at_period_end")
    .gt("trial_ends_at", now.toISOString())
    .not("trial_started_at", "is", null);
  if (customerIds) query = query.in("customer_id", customerIds);
  const { data: subs } = await query;

  const stripe = getStripe();
  let ended = 0;
  for (const sub of subs ?? []) {
    if (!trialUsedUp(await ordersInTrial(service, sub.customer_id, sub.trial_started_at))) continue;
    if (stripe && sub.stripe_subscription_id) {
      try {
        // Si se dio de baja durante la prueba, el plan termina aquí sin cobrar nada
        const updated = sub.cancel_at_period_end
          ? await stripe.subscriptions.cancel(sub.stripe_subscription_id)
          : await stripe.subscriptions.update(sub.stripe_subscription_id, { trial_end: "now" });
        await syncStripeSubscription(service, updated);
      } catch (error) {
        console.error("No se ha podido terminar la prueba gratis", sub.customer_id, error);
        continue;
      }
    } else {
      // Modo demo: sin cobro, el periodo de la cuota empieza ahora (o el plan termina, si se dio de baja)
      await service
        .from("subscriptions")
        .update(
          sub.cancel_at_period_end
            ? { trial_ends_at: now.toISOString(), status: "cancelada" }
            : {
                trial_ends_at: now.toISOString(),
                current_period_end: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
              },
        )
        .eq("id", sub.id);
    }
    ended += 1;
  }
  return ended;
}
