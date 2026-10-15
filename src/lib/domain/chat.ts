import { addDays, madridDate, type ISODate } from "./dates";

export const MAX_MESSAGE_LENGTH = 2000;

/** Un mensaje listo para guardar (sin espacios de más), o el motivo por el que no vale. */
export function cleanMessage(input: string): { body: string } | { error: string } {
  const body = input.replace(/\r\n/g, "\n").trim();
  if (!body) return { error: "Escribe un mensaje." };
  if (body.length > MAX_MESSAGE_LENGTH) return { error: `El mensaje es demasiado largo (máximo ${MAX_MESSAGE_LENGTH} caracteres).` };
  return { body };
}

/** «Hoy», «Ayer» o null (otro día) para separar los mensajes por días. */
export function relativeDay(date: ISODate, today: ISODate): "Hoy" | "Ayer" | null {
  if (date === today) return "Hoy";
  if (date === addDays(today, -1)) return "Ayer";
  return null;
}

/** Agrupa los mensajes (ya ordenados del más antiguo al más nuevo) por día, en hora de Alzira. */
export function groupByDay<T extends { created_at: string }>(messages: T[]): { date: ISODate; messages: T[] }[] {
  const groups: { date: ISODate; messages: T[] }[] = [];
  for (const message of messages) {
    const date = madridDate(new Date(message.created_at));
    const last = groups.at(-1);
    if (last?.date === date) last.messages.push(message);
    else groups.push({ date, messages: [message] });
  }
  return groups;
}
