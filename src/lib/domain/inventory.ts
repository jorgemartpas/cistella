import type { ProductUnit } from "./money";

/**
 * Cómo va el inventario de un producto frente a lo pedido para el próximo reparto:
 * - sin_inventario: la tienda no ha apuntado cuánto tiene
 * - suficiente: lo pedido cabe en lo que hay
 * - justo: se pasa, pero dentro del margen (solo lo que va al peso, en kg)
 * - no_llega: se pasa más que el margen
 * Solo avisa: no limita los pedidos.
 */
export type StockStatus = "sin_inventario" | "suficiente" | "justo" | "no_llega";

export function stockStatus(stock: number | null, ordered: number, unit: ProductUnit, marginKg: number): StockStatus {
  if (stock === null) return "sin_inventario";
  if (ordered <= stock) return "suficiente";
  const margin = unit === "kg" ? marginKg : 0;
  return ordered <= stock + margin ? "justo" : "no_llega";
}

/** Suma lo pedido de cada producto (con el gramo como mínimo para evitar decimales raros). */
export function demandByProduct(lines: { productId: string | null; quantity: number }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { productId, quantity } of lines) {
    if (!productId) continue;
    totals.set(productId, Math.round(((totals.get(productId) ?? 0) + quantity) * 1000) / 1000);
  }
  return totals;
}
