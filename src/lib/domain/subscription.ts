import { daysBetween, isoWeekday, type ISODate } from "./dates";

export type SubscriptionStatus = "incompleta" | "activa" | "pausada" | "impagada" | "cancelada";

/**
 * Planes (decisión del 15/10/2026):
 * - dos_por_semana: todos los días de reparto (martes y viernes), con una cesta para cada día
 * - semanal / quincenal: un día de reparto a la semana o cada dos semanas
 * - por_envio: sin cuota; el cliente pide los repartos sueltos que quiere y paga el envío de cada uno
 */
export type DeliveryFrequency = "dos_por_semana" | "semanal" | "quincenal" | "por_envio";

export const PLAN_ORDER: DeliveryFrequency[] = ["dos_por_semana", "semanal", "quincenal", "por_envio"];

export const FREQUENCY_LABELS: Record<DeliveryFrequency, string> = {
  dos_por_semana: "2 veces por semana",
  semanal: "Cada semana",
  quincenal: "Cada 2 semanas",
  por_envio: "Pago por envío",
};

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  incompleta: "Pendiente de pago",
  activa: "Activa",
  pausada: "Pausada",
  impagada: "Pago pendiente",
  cancelada: "Cancelada",
};

/** Semanas entre repartos de los planes con un día fijo */
const EVERY_WEEKS: Partial<Record<DeliveryFrequency, number>> = { semanal: 1, quincenal: 2 };

/** ¿Tiene cuota mensual (suscripción en Stripe)? */
export function hasMonthlyFee(plan: DeliveryFrequency): boolean {
  return plan !== "por_envio";
}

/** ¿El cliente elige un día de la semana? */
export function needsWeekday(plan: DeliveryFrequency): boolean {
  return plan in EVERY_WEEKS;
}

/** ¿Tiene una cesta distinta para cada día de reparto? */
export function usesDayBaskets(plan: DeliveryFrequency): boolean {
  return plan === "dos_por_semana";
}

/** Cesta que se usa en una fecha: la del día de la semana o la única (0). */
export function basketSlotFor(plan: DeliveryFrequency, date: ISODate): number {
  return usesDayBaskets(plan) ? isoWeekday(date) : 0;
}

export type SubscriptionCadence = {
  status: SubscriptionStatus;
  frequency: DeliveryFrequency;
  deliveryWeekday: number;
  anchorDate: ISODate;
};

/**
 * ¿Le toca reparto fijo a esta suscripción en esta fecha de reparto? Las fechas que recibe son
 * siempre días del calendario de reparto. El pago por envío no tiene repartos fijos: solo los que pide.
 */
export function isDueOn(sub: SubscriptionCadence, date: ISODate): boolean {
  if (sub.status !== "activa") return false;
  const days = daysBetween(sub.anchorDate, date);
  if (days < 0) return false;
  if (sub.frequency === "dos_por_semana") return true;
  const weeks = EVERY_WEEKS[sub.frequency];
  if (!weeks) return false;
  if (isoWeekday(date) !== sub.deliveryWeekday) return false;
  return (days / 7) % weeks === 0;
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
