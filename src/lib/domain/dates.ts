// Fechas de calendario como 'YYYY-MM-DD' y horas de Alzira (Europe/Madrid).
// Se trabaja con cadenas para no arrastrar husos horarios en las fechas de reparto.

export type ISODate = string;

export const TIME_ZONE = "Europe/Madrid";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: string): value is ISODate {
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function toUTCDate(date: ISODate): Date {
  const m = ISO_DATE_RE.exec(date);
  if (!m) throw new Error(`Fecha no válida: ${date}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

function fromUTCDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = toUTCDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTCDate(d);
}

/** Días naturales de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUTCDate(to).getTime() - toUTCDate(from).getTime()) / 86_400_000);
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(date: ISODate): number {
  const day = toUTCDate(date).getUTCDay();
  return day === 0 ? 7 : day;
}

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function madridParts(instant: Date) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(instant).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}` as ISODate,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Fecha de calendario en Alzira para un instante dado. */
export function madridDate(instant: Date): ISODate {
  return madridParts(instant).date;
}

/** Minutos que Madrid va por delante de UTC en ese instante (60 en invierno, 120 en verano). */
function madridOffsetMinutes(instant: Date): number {
  const p = madridParts(instant);
  const asUTC = Date.UTC(
    +p.date.slice(0, 4),
    +p.date.slice(5, 7) - 1,
    +p.date.slice(8, 10),
    p.hour,
    p.minute,
    p.second,
  );
  return Math.round((asUTC - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** Instante UTC que corresponde a una fecha y hora locales de Madrid ('HH:MM' o 'HH:MM:SS'). */
export function madridLocalToUTC(date: ISODate, time: string): Date {
  const [h, m, s = "0"] = time.split(":");
  const base = toUTCDate(date);
  base.setUTCHours(Number(h), Number(m), Number(s), 0);
  const guess = new Date(base.getTime() - madridOffsetMinutes(base) * 60_000);
  // Segunda pasada por si el cambio de hora cae entre medias
  return new Date(base.getTime() - madridOffsetMinutes(guess) * 60_000);
}
