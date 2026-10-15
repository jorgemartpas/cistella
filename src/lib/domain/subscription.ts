import { daysBetween, isoWeekday, type ISODate } from "./dates";

export type SubscriptionStatus = "incompleta" | "activa" | "pausada" | "impagada" | "cancelada";
export type DeliveryFrequency = "semanal" | "quincenal" | "mensual";

export const FREQUENCY_WEEKS: Record<DeliveryFrequency, number> = {
  semanal: 1,
  quincenal: 2,
  mensual: 4,
};

export const FREQUENCY_LABELS: Record<DeliveryFrequency, string> = {
  semanal: "Cada semana",
  quincenal: "Cada 2 semanas",
  mensual: "Cada 4 semanas",
};

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  incompleta: "Pendiente de pago",
  activa: "Activa",
  pausada: "Pausada",
  impagada: "Pago pendiente",
  cancelada: "Cancelada",
};

export type SubscriptionCadence = {
  status: SubscriptionStatus;
  frequency: DeliveryFrequency;
  deliveryWeekday: number;
  anchorDate: ISODate;
};

/** ¿Le toca reparto a esta suscripción en esta fecha? */
export function isDueOn(sub: SubscriptionCadence, date: ISODate): boolean {
  if (sub.status !== "activa") return false;
  if (isoWeekday(date) !== sub.deliveryWeekday) return false;
  const days = daysBetween(sub.anchorDate, date);
  if (days < 0) return false;
  return (days / 7) % FREQUENCY_WEEKS[sub.frequency] === 0;
}

/** Primer reparto abierto que le toca al cliente, de entre los días ya generados. */
export function nextDueDay<T extends { date: ISODate; cutoffAt: Date; status: string }>(
  sub: SubscriptionCadence,
  days: T[],
  now: Date,
): T | null {
  return (
    [...days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((d) => d.status === "abierto" && d.cutoffAt.getTime() > now.getTime() && isDueOn(sub, d.date)) ?? null
  );
}
