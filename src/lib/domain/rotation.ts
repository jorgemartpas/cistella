import type { ISODate } from "./dates";

export type RotationShop = {
  id: string;
  name: string;
  active: boolean;
  rotationOrder: number;
};

/** Orden de rotación: el que fija el admin y, a igualdad, por nombre. Solo tiendas activas. */
export function rotationQueue(shops: RotationShop[]): string[] {
  return shops
    .filter((s) => s.active)
    .sort((a, b) => a.rotationOrder - b.rotationOrder || a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id))
    .map((s) => s.id);
}

/** Tienda que toca después de `previousShopId`. Si no hay anterior (o ya no está activa) empieza la cola. */
export function nextInRotation(queue: string[], previousShopId: string | null): string | null {
  if (queue.length === 0) return null;
  const index = previousShopId ? queue.indexOf(previousShopId) : -1;
  return queue[(index + 1) % queue.length];
}

/**
 * Asigna la tienda de turno a días nuevos, alternando a partir de la última asignada.
 * `dates` debe venir ordenado y ser posterior a `previousShopId`.
 */
export function assignRotation(
  dates: ISODate[],
  shops: RotationShop[],
  previousShopId: string | null,
): Map<ISODate, string | null> {
  const queue = rotationQueue(shops);
  const result = new Map<ISODate, string | null>();
  let previous = previousShopId;
  for (const date of [...dates].sort()) {
    const shopId = nextInRotation(queue, previous);
    result.set(date, shopId);
    previous = shopId ?? previous;
  }
  return result;
}
