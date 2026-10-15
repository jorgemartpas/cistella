import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { mapStripeStatus } from "./stripe";

const sub = (status: Stripe.Subscription.Status, paused = false) =>
  ({ status, pause_collection: paused ? { behavior: "void" } : null }) as Stripe.Subscription;

describe("estado de la suscripción a partir de Stripe", () => {
  it("activa, o pausada si se ha pausado el cobro", () => {
    expect(mapStripeStatus(sub("active"))).toBe("activa");
    expect(mapStripeStatus(sub("trialing"))).toBe("activa");
    expect(mapStripeStatus(sub("active", true))).toBe("pausada");
    expect(mapStripeStatus(sub("paused"))).toBe("pausada");
  });

  it("impagada si falla el cobro de la cuota", () => {
    expect(mapStripeStatus(sub("past_due"))).toBe("impagada");
    expect(mapStripeStatus(sub("unpaid"))).toBe("impagada");
  });

  it("cancelada o incompleta", () => {
    expect(mapStripeStatus(sub("canceled"))).toBe("cancelada");
    expect(mapStripeStatus(sub("incomplete_expired"))).toBe("cancelada");
    expect(mapStripeStatus(sub("incomplete"))).toBe("incompleta");
  });
});
