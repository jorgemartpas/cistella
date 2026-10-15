import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { finalTotalCents } from "@/lib/domain/orders";
import { getStripe } from "@/lib/stripe";
import type { OrderItem } from "@/lib/types";

export type ChargeResult = { status: "pagado" | "fallido" | "pendiente" | "sin_cobro" | "omitido"; message?: string };

/**
 * Cobra un pedido entregado con el peso real, a la tarjeta de la suscripción (off-session).
 * Solo un proceso a la vez puede cobrar cada pedido: primero lo pasa a 'procesando'.
 */
export async function chargeOrder(service: SupabaseClient, orderId: string): Promise<ChargeResult> {
  const { data: order } = await service
    .from("orders")
    .select("id, customer_id, payment_status, delivery_fee_cents, delivery_days(date), shop_orders(order_items(*))")
    .eq("id", orderId)
    .single<{
      id: string;
      customer_id: string | null;
      payment_status: string;
      delivery_fee_cents: number;
      delivery_days: { date: string };
      shop_orders: { order_items: OrderItem[] }[];
    }>();
  if (!order) return { status: "omitido", message: "El pedido no existe" };

  const items = order.shop_orders.flatMap((so) => so.order_items);
  // Productos con el peso real + gastos de envío (pago por envío)
  const amount = order.delivery_fee_cents + finalTotalCents(
    items.map((i) => ({
      quantityOrdered: Number(i.quantity_ordered),
      quantityActual: i.quantity_actual === null ? null : Number(i.quantity_actual),
      unitPriceCents: i.unit_price_cents,
    })),
  );

  // Reservar el cobro: si otro proceso ya lo está cobrando o ya está pagado, no se hace nada
  const { data: claimed } = await service
    .from("orders")
    .update({ payment_status: "procesando", final_total_cents: amount })
    .eq("id", orderId)
    .in("payment_status", ["pendiente", "fallido", "sin_cobro"])
    .select("payment_attempts")
    .maybeSingle();
  if (!claimed) return { status: "omitido", message: "Este pedido ya está cobrado o cobrándose" };

  const finish = async (result: ChargeResult, intentId?: string) => {
    const { error } = await service
      .from("orders")
      .update({
        payment_status: result.status === "omitido" ? "pendiente" : result.status,
        payment_error: result.status === "fallido" || result.status === "pendiente" ? (result.message ?? null) : null,
        payment_attempts: claimed.payment_attempts + 1,
        ...(intentId ? { stripe_payment_intent_id: intentId } : {}),
      })
      .eq("id", orderId);
    // El pedido se quedaría en 'procesando'; el webhook de Stripe lo acabará corrigiendo
    if (error) throw new Error(`No se ha podido guardar el resultado del cobro del pedido ${orderId}: ${error.message}`);
    return result;
  };

  if (amount === 0) return finish({ status: "sin_cobro" });

  const stripe = getStripe();
  if (!stripe) return finish({ status: "pendiente", message: "Stripe no está configurado: el cobro no se ha hecho." });

  const { data: sub } = await service
    .from("subscriptions")
    .select("stripe_customer_id, stripe_payment_method_id")
    .eq("customer_id", order.customer_id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) return finish({ status: "fallido", message: "El cliente no tiene una tarjeta guardada." });

  let paymentMethod = sub.stripe_payment_method_id as string | null;
  if (!paymentMethod) {
    const customer = await stripe.customers.retrieve(sub.stripe_customer_id);
    if (!customer.deleted) {
      const pm = customer.invoice_settings.default_payment_method;
      paymentMethod = typeof pm === "string" ? pm : (pm?.id ?? null);
    }
  }
  if (!paymentMethod) return finish({ status: "fallido", message: "El cliente no tiene una tarjeta guardada." });

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount,
        currency: "eur",
        customer: sub.stripe_customer_id,
        payment_method: paymentMethod,
        off_session: true,
        confirm: true,
        description: `Cistella · pedido del ${order.delivery_days.date}`,
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `order-${order.id}-${claimed.payment_attempts + 1}` },
    );
    if (intent.status === "succeeded") return finish({ status: "pagado" }, intent.id);
    if (intent.status === "processing") return finish({ status: "pendiente", message: "El banco está procesando el cobro." }, intent.id);
    return finish({ status: "fallido", message: "El cobro necesita una acción del cliente." }, intent.id);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeCardError) {
      const message =
        err.code === "authentication_required"
          ? "El banco pide que el cliente confirme el pago. Pídele que actualice la tarjeta."
          : (err.message ?? "El banco ha rechazado el cobro.");
      return finish({ status: "fallido", message }, err.payment_intent?.id);
    }
    await finish({ status: "fallido", message: "Error al conectar con Stripe. Vuelve a intentarlo." });
    throw err;
  }
}
