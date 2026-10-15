import { addDays, isoWeekday, madridDate, madridLocalToUTC, type ISODate } from "./dates";

/** Regla del calendario semanal: qué días se reparte y cuándo cierra cada reparto. */
export type ScheduleRule = {
  weekday: number;
  active: boolean;
  cutoffDaysBefore: number;
  cutoffTime: string;
};

export type PlannedDeliveryDate = {
  date: ISODate;
  cutoffAt: Date;
};

export function cutoffFor(date: ISODate, rule: Pick<ScheduleRule, "cutoffDaysBefore" | "cutoffTime">): Date {
  return madridLocalToUTC(addDays(date, -rule.cutoffDaysBefore), rule.cutoffTime);
}

/**
 * Fechas de reparto desde `fromDate` (incluida) durante `days` días según el calendario.
 * Solo devuelve las que todavía no han cerrado en `now`.
 */
export function upcomingDeliveryDates(
  rules: ScheduleRule[],
  fromDate: ISODate,
  days: number,
  now: Date,
): PlannedDeliveryDate[] {
  const byWeekday = new Map(rules.filter((r) => r.active).map((r) => [r.weekday, r]));
  const result: PlannedDeliveryDate[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const rule = byWeekday.get(isoWeekday(date));
    if (!rule) continue;
    const cutoffAt = cutoffFor(date, rule);
    if (cutoffAt.getTime() > now.getTime()) result.push({ date, cutoffAt });
  }
  return result;
}

/**
 * Primer reparto de un día de la semana que aún admite cambios en la cesta.
 * Sirve de ancla para la cadencia de la suscripción.
 */
export function nextOpenDateForWeekday(
  rules: ScheduleRule[],
  weekday: number,
  now: Date,
): PlannedDeliveryDate | null {
  const rule = rules.find((r) => r.active && r.weekday === weekday);
  if (!rule) return null;
  const today = madridDate(now);
  // Basta con mirar dos semanas: el cierre como mucho es 6 días antes
  return upcomingDeliveryDates([rule], today, 15, now)[0] ?? null;
}

/** Primer reparto que aún admite cambios, sea cual sea el día de la semana. */
export function nextOpenDate(rules: ScheduleRule[], now: Date): PlannedDeliveryDate | null {
  return upcomingDeliveryDates(rules, madridDate(now), 15, now)[0] ?? null;
}

export const WEEKDAY_NAMES = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
