import { describe, expect, it } from "vitest";
import { FREE_TRIAL, trialEligible, trialState, trialUsedUp } from "./trial";

describe("prueba gratis", () => {
  it("es de 2 semanas o 2 pedidos", () => {
    expect(FREE_TRIAL).toEqual({ days: 14, orders: 2 });
  });

  it("solo en los planes con cuota y una vez por cliente", () => {
    expect(trialEligible("semanal", null)).toBe(true);
    expect(trialEligible("quincenal", undefined)).toBe(true);
    expect(trialEligible("dos_por_semana", null)).toBe(true);
    expect(trialEligible("por_envio", null)).toBe(false);
    expect(trialEligible("semanal", "2026-09-01T10:00:00Z")).toBe(false);
  });

  it("se gasta con el 2.º pedido preparado", () => {
    expect(trialUsedUp(0)).toBe(false);
    expect(trialUsedUp(1)).toBe(false);
    expect(trialUsedUp(2)).toBe(true);
  });

  it("dice cuántos días y pedidos quedan", () => {
    const now = new Date("2026-10-15T10:00:00Z");
    expect(trialState("2026-10-29T10:00:00Z", 0, now)).toEqual({
      endsAt: "2026-10-29T10:00:00Z",
      daysLeft: 14,
      ordersLeft: 2,
    });
    expect(trialState("2026-10-16T09:00:00Z", 1, now)).toMatchObject({ daysLeft: 1, ordersLeft: 1 });
  });

  it("termina lo que llegue antes: la fecha o los 2 pedidos", () => {
    const now = new Date("2026-10-15T10:00:00Z");
    expect(trialState("2026-10-15T09:59:00Z", 0, now)).toBeNull();
    expect(trialState("2026-10-29T10:00:00Z", 2, now)).toBeNull();
    expect(trialState(null, 0, now)).toBeNull();
  });
});
