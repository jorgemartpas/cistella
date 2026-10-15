import { TIME_ZONE, type ISODate } from "@/lib/domain/dates";

const dayFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDayFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const instantFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const longDateFormatter = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });
const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

/** "viernes, 16 de octubre" para una fecha de reparto */
export function formatDay(date: ISODate): string {
  return dayFormatter.format(new Date(`${date}T00:00:00Z`));
}

/** "vie, 16 oct" */
export function formatShortDay(date: ISODate): string {
  return shortDayFormatter.format(new Date(`${date}T00:00:00Z`));
}

/** "jueves 15, 20:00" para la hora de cierre (hora de Alzira) */
export function formatCutoff(instant: Date | string): string {
  return instantFormatter.format(new Date(instant)).replace(",", "").replace(/(\d{1,2}) (\d{2}:\d{2})$/, "$1, $2");
}

export function formatDateTime(instant: Date | string): string {
  return dateTimeFormatter.format(new Date(instant));
}

export function formatLongDate(instant: Date | string): string {
  return longDateFormatter.format(new Date(instant));
}

/** "octubre de 2026" a partir de 'YYYY-MM' */
export function formatMonth(month: string): string {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "1 pedido", "3 pedidos" */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
