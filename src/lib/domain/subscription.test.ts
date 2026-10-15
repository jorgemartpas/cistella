import { describe, expect, it } from "vitest";
import { isDueOn, nextDueDay, type SubscriptionCadence } from "./subscription";

const weekly: SubscriptionCadence = {
  status: "activa",
  frequency: "semanal",
  deliveryWeekday: 2,
  anchorDate: "2026-10-20",
};

describe("cadencia de la suscripción", () => {
  it("semanal: todos los martes desde el primer reparto", () => {
    expect(isDueOn(weekly, "2026-10-20")).toBe(true);
    expect(isDueOn(weekly, "2026-10-27")).toBe(true);
    expect(isDueOn(weekly, "2026-10-13")).toBe(false); // antes del alta
    expect(isDueOn(weekly, "2026-10-23")).toBe(false); // viernes
  });

  it("quincenal: martes alternos", () => {
    const sub = { ...weekly, frequency: "quincenal" as const };
    expect(isDueOn(sub, "2026-10-20")).toBe(true);
    expect(isDueOn(sub, "2026-10-27")).toBe(false);
    expect(isDueOn(sub, "2026-11-03")).toBe(true);
  });

  it("mensual: cada 4 semanas", () => {
    const sub = { ...weekly, frequency: "mensual" as const };
    expect(isDueOn(sub, "2026-10-20")).toBe(true);
    expect(isDueOn(sub, "2026-11-03")).toBe(false);
    expect(isDueOn(sub, "2026-11-10")).toBe(false);
    expect(isDueOn(sub, "2026-11-17")).toBe(true);
  });

  it("no reparte a suscripciones pausadas, impagadas o canceladas", () => {
    for (const status of ["pausada", "impagada", "cancelada", "incompleta"] as const) {
      expect(isDueOn({ ...weekly, status }, "2026-10-27")).toBe(false);
    }
  });

  it("encuentra el próximo reparto abierto que le toca", () => {
    const days = [
      { date: "2026-10-23", cutoffAt: new Date("2026-10-22T18:00:00Z"), status: "abierto" },
      { date: "2026-10-20", cutoffAt: new Date("2026-10-19T18:00:00Z"), status: "cerrado" },
      { date: "2026-10-27", cutoffAt: new Date("2026-10-26T19:00:00Z"), status: "cancelado" },
      { date: "2026-11-03", cutoffAt: new Date("2026-11-02T19:00:00Z"), status: "abierto" },
    ];
    const now = new Date("2026-10-19T19:00:00Z");
    expect(nextDueDay(weekly, days, now)?.date).toBe("2026-11-03");
  });
});
