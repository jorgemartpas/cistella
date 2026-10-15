"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isProfileComplete, requireRole } from "@/lib/auth";
import { getScheduleRules, planAnchor } from "@/lib/delivery";
import { hasMonthlyFee, needsWeekday, usesDayBaskets, type DeliveryFrequency } from "@/lib/domain/subscription";
import { env } from "@/lib/env";
import { monthlyPriceCents } from "@/lib/plans";
import {
  completeCardSetup,
  getPlanPrice,
  getStripe,
  paymentsDemoMode,
  syncStripeSubscription,
  type PlanMetadata,
} from "@/lib/stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionState, Settings, Subscription } from "@/lib/types";

const planSchema = z.object({
  plan: z.enum(["dos_por_semana", "semanal", "quincenal", "por_envio"], { error: "Elige un plan" }),
  delivery_weekday: z.coerce.number().int().min(1).max(7).optional(),
});

type ChosenPlan = { plan: DeliveryFrequency; weekday: number; anchorDate: string };

/** Lee el plan del formulario y calcula su primer reparto. */
async function choosePlan(formData: FormData): Promise<ChosenPlan | { error: string }> {
  const parsed = planSchema.safeParse({
    plan: formData.get("plan"),
    delivery_weekday: formData.get("delivery_weekday") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { plan, delivery_weekday } = parsed.data;
  if (needsWeekday(plan) && !delivery_weekday) return { error: "Elige el día de reparto" };
  const supabase = await createClient();
  const anchor = planAnchor(await getScheduleRules(supabase), plan, delivery_weekday ?? null, new Date());
  if (!anchor) return { error: "Ese día ya no hay reparto. Elige otro." };
  return { plan, weekday: anchor.weekday, anchorDate: anchor.anchorDate };
}

async function getSettings(supabase: SupabaseClient): Promise<Settings> {
  const { data } = await supabase.from("settings").select("*").single<Settings>();
  if (!data) throw new Error("No se han podido leer los ajustes");
  return data;
}

async function currentSubscription(customerId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").eq("customer_id", customerId).maybeSingle<Subscription>();
  return data;
}

/**
 * Al pasar a 2 veces por semana, la cesta de cada día empieza como copia de la cesta única;
 * al dejarlo, la cesta única empieza como copia de la del primer día. Nunca pisa una cesta con contenido.
 */
async function prepareBaskets(customerId: string, from: DeliveryFrequency | null, to: DeliveryFrequency) {
  if (usesDayBaskets(from ?? "semanal") === usesDayBaskets(to)) return;
  const supabase = await createClient();
  const [rules, { data: rows }] = await Promise.all([
    getScheduleRules(supabase),
    supabase.from("basket_items").select("product_id, quantity, slot").eq("customer_id", customerId),
  ]);
  const items = rows ?? [];
  const weekdays = rules.filter((r) => r.active).map((r) => r.weekday);
  const copy = async (fromSlot: number, toSlot: number) => {
    const source = items.filter((i) => i.slot === fromSlot);
    if (source.length === 0 || items.some((i) => i.slot === toSlot)) return;
    await supabase
      .from("basket_items")
      .insert(source.map((i) => ({ customer_id: customerId, product_id: i.product_id, quantity: i.quantity, slot: toSlot })));
  };
  if (usesDayBaskets(to)) {
    for (const weekday of weekdays) await copy(0, weekday);
  } else if (weekdays[0]) {
    await copy(weekdays[0], 0);
  }
}

function demoPeriodEnd(plan: DeliveryFrequency) {
  return hasMonthlyFee(plan) ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null;
}

/**
 * Abre el Checkout de Stripe: suscripción con cuota, o solo guardar la tarjeta (pago por envío).
 * Con `confirming`, al volver se confirma el pedido que el cliente quería confirmar.
 */
async function checkoutUrl(
  customerId: string,
  stripeCustomerId: string,
  chosen: ChosenPlan,
  returnPath: string,
  confirming = false,
) {
  const stripe = getStripe()!;
  const metadata: PlanMetadata = {
    user_id: customerId,
    plan: chosen.plan,
    weekday: String(chosen.weekday),
    anchor: chosen.anchorDate,
  };
  const common = {
    customer: stripeCustomerId,
    client_reference_id: customerId,
    locale: "es" as const,
    metadata,
    success_url: `${env.siteUrl}${returnPath}?pago=ok${confirming ? "&confirmar=1" : ""}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.siteUrl}${returnPath}?pago=cancelado${confirming ? "&confirmar=1" : ""}`,
  };
  if (chosen.plan === "por_envio") {
    const session = await stripe.checkout.sessions.create({ ...common, mode: "setup", currency: "eur" });
    return session.url;
  }
  const settings = await getSettings(await createClient());
  const price = await getPlanPrice(stripe, chosen.plan, monthlyPriceCents(settings, chosen.plan));
  const session = await stripe.checkout.sessions.create({
    ...common,
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    payment_method_collection: "always",
    subscription_data: { metadata },
  });
  return session.url;
}

/** Alta: guarda el plan y lleva al cliente a Stripe (o lo activa en modo demo). */
export async function startSubscription(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  if (!isProfileComplete(profile)) return { error: "Antes completa tus datos de entrega." };
  const chosen = await choosePlan(formData);
  if ("error" in chosen) return chosen;
  const confirming = formData.get("confirmar") === "1";

  const existing = await currentSubscription(profile.id);
  if (existing && ["activa", "pausada", "impagada"].includes(existing.status)) {
    return { error: "Ya tienes un plan. Puedes cambiarlo desde tu cuenta." };
  }

  const service = createServiceClient();
  const base = {
    customer_id: profile.id,
    frequency: chosen.plan,
    delivery_weekday: chosen.weekday,
    anchor_date: chosen.anchorDate,
  };
  const stripe = getStripe();

  if (!stripe) {
    if (!paymentsDemoMode()) return { error: "Los pagos aún no están configurados. Inténtalo más tarde." };
    const { error } = await service.from("subscriptions").upsert(
      { ...base, status: "activa", cancel_at_period_end: false, current_period_end: demoPeriodEnd(chosen.plan) },
      { onConflict: "customer_id" },
    );
    if (error) return { error: "No se ha podido activar el plan." };
    await prepareBaskets(profile.id, existing?.frequency ?? null, chosen.plan);
    redirect(confirming ? "/cesta?confirmar=1" : "/bienvenida?pago=ok");
  }

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
    .upsert({ ...base, status: "incompleta", stripe_customer_id: stripeCustomerId }, { onConflict: "customer_id" });
  if (error) return { error: "No se ha podido preparar el plan." };
  await prepareBaskets(profile.id, existing?.frequency ?? null, chosen.plan);

  const url = await checkoutUrl(profile.id, stripeCustomerId, chosen, "/bienvenida", confirming);
  if (!url) return { error: "No se ha podido abrir el pago. Inténtalo de nuevo." };
  redirect(url);
}

/**
 * Al volver de Stripe se sincroniza sin esperar al webhook
 * (que es la vía principal y la que mantiene el estado al día después).
 */
export async function syncCheckoutSession(sessionId: string, customerId: string) {
  const stripe = getStripe();
  if (!stripe) return;
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== customerId) return;
  const service = createServiceClient();
  if (session.mode === "setup") {
    await completeCardSetup(service, stripe, session);
  } else if (session.subscription && typeof session.subscription !== "string") {
    await syncStripeSubscription(service, session.subscription);
  }
}

/** Cambio de plan o de día. Cada plan tiene su cuota: el plan solo lo cambia el servidor. */
export async function updatePlan(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  const chosen = await choosePlan(formData);
  if ("error" in chosen) return chosen;
  const sub = await currentSubscription(profile.id);
  if (!sub || !["activa", "pausada", "impagada"].includes(sub.status)) redirect("/bienvenida");

  const supabase = await createClient();
  const service = createServiceClient();
  const local = { frequency: chosen.plan, delivery_weekday: chosen.weekday, anchor_date: chosen.anchorDate };

  // Mismo plan, otro día: no cambia el precio
  if (sub.frequency === chosen.plan) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ delivery_weekday: chosen.weekday, anchor_date: chosen.anchorDate })
      .eq("customer_id", profile.id);
    if (error) return { error: "No se ha podido cambiar el día." };
    refresh();
    return { ok: "Hecho. Tu próximo reparto ya tiene en cuenta el cambio." };
  }

  const stripe = getStripe();
  if (!stripe && !paymentsDemoMode()) return { error: "Los pagos aún no están configurados. Inténtalo más tarde." };

  if (stripe && hasMonthlyFee(chosen.plan)) {
    const metadata: PlanMetadata = {
      user_id: profile.id,
      plan: chosen.plan,
      weekday: String(chosen.weekday),
      anchor: chosen.anchorDate,
    };
    if (hasMonthlyFee(sub.frequency) && sub.stripe_subscription_id) {
      // De un plan con cuota a otro: Stripe prorratea la diferencia en la próxima factura
      const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const settings = await getSettings(supabase);
      const price = await getPlanPrice(stripe, chosen.plan, monthlyPriceCents(settings, chosen.plan));
      await service.from("subscriptions").update(local).eq("id", sub.id);
      const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items: [{ id: current.items.data[0].id, price }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
        metadata,
      });
      await syncStripeSubscription(service, updated);
    } else {
      // De pago por envío a un plan con cuota: hay que darse de alta en Stripe
      const stripeCustomerId = sub.stripe_customer_id;
      if (!stripeCustomerId) return { error: "No encontramos tu tarjeta. Escríbenos y lo revisamos." };
      await prepareBaskets(profile.id, sub.frequency, chosen.plan);
      const url = await checkoutUrl(profile.id, stripeCustomerId, chosen, "/cuenta/plan");
      if (!url) return { error: "No se ha podido abrir el pago. Inténtalo de nuevo." };
      redirect(url);
    }
  } else if (stripe && chosen.plan === "por_envio") {
    // De un plan con cuota a pago por envío: la cuota deja de renovarse; la tarjeta se mantiene
    if (sub.stripe_subscription_id) {
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
    }
    await service.from("subscriptions").update({ ...local, status: "activa", cancel_at_period_end: false }).eq("id", sub.id);
  } else {
    // Modo demo
    await service
      .from("subscriptions")
      .update({ ...local, status: "activa", cancel_at_period_end: false, current_period_end: demoPeriodEnd(chosen.plan) })
      .eq("id", sub.id);
  }

  await prepareBaskets(profile.id, sub.frequency, chosen.plan);
  refresh();
  return {
    ok:
      chosen.plan === "por_envio"
        ? "Hecho. Ya no tienes cuota: pide desde tu cesta los repartos que quieras."
        : "Hecho. Tu plan ha cambiado y tu próximo reparto ya lo tiene en cuenta.",
  };
}

type LifecycleAction = "pausar" | "reanudar" | "cancelar" | "mantener";

/** Pausa, reanudación y baja. En Stripe la pausa anula las cuotas mientras dure. */
export async function changeSubscription(action: LifecycleAction): Promise<void> {
  const profile = await requireRole("cliente");
  const sub = await currentSubscription(profile.id);
  if (!sub) redirect("/bienvenida");

  const service = createServiceClient();

  // Pago por envío: sin cuota, la baja es inmediata y se anulan los repartos pedidos
  if (sub.frequency === "por_envio") {
    if (action === "cancelar") {
      const supabase = await createClient();
      await supabase.from("delivery_requests").delete().eq("customer_id", profile.id);
      await service.from("subscriptions").update({ status: "cancelada" }).eq("id", sub.id);
    }
    refresh();
    return;
  }

  const stripe = getStripe();
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
  if (action === "reanudar") {
    const anchor = planAnchor(await getScheduleRules(service), sub.frequency, sub.delivery_weekday, new Date());
    if (anchor) {
      await service
        .from("subscriptions")
        .update({ anchor_date: anchor.anchorDate, delivery_weekday: anchor.weekday })
        .eq("id", sub.id);
    }
  }
  refresh();
}

/** Portal de Stripe para cambiar la tarjeta y ver facturas. */
export async function openBillingPortal() {
  const profile = await requireRole("cliente");
  const sub = await currentSubscription(profile.id);
  const stripe = getStripe();
  if (!stripe || !sub?.stripe_customer_id) redirect("/cuenta/pago");
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${env.siteUrl}/cuenta/pago`,
    locale: "es",
  });
  redirect(portal.url);
}
