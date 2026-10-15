import type Stripe from "stripe";
import { env } from "@/lib/env";
import { completeCardSetup, getStripe, syncStripeSubscription } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

// Stripe → LaCistella: estado de las suscripciones y resultado de los cobros de pedidos.
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = env.stripe.webhookSecret;
  if (!stripe || !secret) return new Response("Stripe no está configurado", { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Falta la firma", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Firma no válida", { status: 400 });
  }

  const service = createServiceClient();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && typeof session.subscription === "string") {
        await syncStripeSubscription(service, await stripe.subscriptions.retrieve(session.subscription));
      } else if (session.mode === "setup") {
        await completeCardSetup(service, stripe, session);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncStripeSubscription(service, event.data.object);
      break;
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      const orderId = intent.metadata?.order_id;
      if (orderId) {
        const ok = event.type === "payment_intent.succeeded";
        await service
          .from("orders")
          .update({
            payment_status: ok ? "pagado" : "fallido",
            payment_error: ok ? null : (intent.last_payment_error?.message ?? "El banco ha rechazado el cobro"),
            stripe_payment_intent_id: intent.id,
          })
          .eq("id", orderId)
          .neq("payment_status", "pagado");
      }
      break;
    }
  }
  return Response.json({ received: true });
}
