import { describe, expect, it } from "vitest";
import {
  basketSlotFor,
  hasMonthlyFee,
  isDueOn,
  needsWeekday,
  nextDueDay,
  usesDayBaskets,
  type SubscriptionCadence,
} from "./subscription";

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

  it("2 veces por semana: todos los días de reparto desde el primero", () => {
    const sub = { ...weekly, frequency: "dos_por_semana" as const };
    expect(isDueOn(sub, "2026-10-20")).toBe(true); // martes
    expect(isDueOn(sub, "2026-10-23")).toBe(true); // viernes
    expect(isDueOn(sub, "2026-10-27")).toBe(true);
    expect(isDueOn(sub, "2026-10-16")).toBe(false); // antes del alta
  });

  it("pago por envío: no tiene repartos fijos", () => {
    const sub = { ...weekly, frequency: "por_envio" as const };
    expect(isDueOn(sub, "2026-10-20")).toBe(false);
    expect(isDueOn(sub, "2026-10-27")).toBe(false);
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

describe("características de cada plan", () => {
  it("solo el pago por envío va sin cuota mensual", () => {
    expect(hasMonthlyFee("dos_por_semana")).toBe(true);
    expect(hasMonthlyFee("semanal")).toBe(true);
    expect(hasMonthlyFee("quincenal")).toBe(true);
    expect(hasMonthlyFee("por_envio")).toBe(false);
  });

  it("solo los planes de un día fijo eligen día de la semana", () => {
    expect(needsWeekday("semanal")).toBe(true);
    expect(needsWeekday("quincenal")).toBe(true);
    expect(needsWeekday("dos_por_semana")).toBe(false);
    expect(needsWeekday("por_envio")).toBe(false);
  });

  it("2 veces por semana usa la cesta de cada día; el resto, la cesta única", () => {
    expect(usesDayBaskets("dos_por_semana")).toBe(true);
    expect(basketSlotFor("dos_por_semana", "2026-10-20")).toBe(2);
    expect(basketSlotFor("dos_por_semana", "2026-10-23")).toBe(5);
    expect(basketSlotFor("semanal", "2026-10-20")).toBe(0);
    expect(basketSlotFor("por_envio", "2026-10-23")).toBe(0);
  });
});
