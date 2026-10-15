/** Cesta del visitante sin cuenta: se guarda en una cookie como {idDeProducto: cantidad}. */

/** Como mucho tantos productos, para que la cookie no pase de unos 4 KB */
export const GUEST_BASKET_MAX_ITEMS = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lee la cookie; lo que no sea válido se ignora (nunca falla). */
export function parseGuestBasket(raw: string | undefined): Map<string, number> {
  const basket = new Map<string, number>();
  if (!raw) return basket;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return basket;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return basket;
  for (const [id, quantity] of Object.entries(data as Record<string, unknown>)) {
    if (basket.size >= GUEST_BASKET_MAX_ITEMS) break;
    if (UUID.test(id) && typeof quantity === "number" && quantity > 0 && quantity <= 50) basket.set(id, quantity);
  }
  return basket;
}

/** Cambia la cantidad de un producto (0 lo quita) y devuelve el texto de la cookie. */
export function updateGuestBasket(basket: Map<string, number>, productId: string, quantity: number): string {
  const next = new Map(basket);
  if (quantity <= 0) next.delete(productId);
  else if (next.has(productId) || next.size < GUEST_BASKET_MAX_ITEMS) next.set(productId, quantity);
  return JSON.stringify(Object.fromEntries(next));
}
