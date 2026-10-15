export type ProductUnit = "kg" | "unidad" | "bandeja";

export const UNIT_LABELS: Record<ProductUnit, { short: string; singular: string; plural: string }> = {
  kg: { short: "kg", singular: "kg", plural: "kg" },
  unidad: { short: "ud.", singular: "unidad", plural: "unidades" },
  bandeja: { short: "bandeja", singular: "bandeja", plural: "bandejas" },
};

/** Paso al ajustar cantidades: cuartos de kilo o unidades enteras. */
/** Lo que suman o restan los botones + y − (lo que va al kilo, de cuarto en cuarto) */
export function quantityStep(unit: ProductUnit): number {
  return unit === "kg" ? 0.25 : 1;
}

/** Cantidad que se puede pedir: al gramo en lo que va al kilo; enteros en unidades y bandejas. */
export function normalizeQuantity(quantity: number, unit: ProductUnit): number {
  return unit === "kg" ? Math.round(quantity * 1000) / 1000 : Math.round(quantity);
}

/** "0,3" o "0.3" → 0,3. Devuelve null si no es un número válido. */
export function parseQuantity(input: string): number | null {
  const normalized = input.trim().replace(/\s|kg/gi, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(normalized)) return null;
  return Number(normalized);
}

/**
 * "3,50", "3.5" o "15 €" → céntimos. Devuelve null si no es un importe válido.
 * El cero solo vale si se permite (por ejemplo, «sin pedido mínimo»).
 */
export function parseEurosToCents(input: string, { allowZero = false } = {}): number | null {
  const normalized = input.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (cents >= 1_000_000) return null;
  return cents > 0 || (allowZero && cents === 0) ? cents : null;
}

/** Importe de una línea en céntimos, redondeado al céntimo. */
export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  return Math.round(Math.round(quantity * 1000) * unitPriceCents / 1000);
}

const euroFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function formatEuros(cents: number): string {
  return euroFormatter.format(cents / 100);
}

export function formatQuantity(quantity: number, unit: ProductUnit): string {
  const n = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(quantity);
  const label = UNIT_LABELS[unit];
  return `${n} ${quantity === 1 ? label.singular : label.plural}`;
}

export function formatUnitPrice(cents: number, unit: ProductUnit): string {
  return `${formatEuros(cents)}/${UNIT_LABELS[unit].short}`;
}

/** Comisión en céntimos sobre unas ventas, con el porcentaje de la tienda. */
export function commissionCents(salesCents: number, commissionPct: number): number {
  return Math.round((salesCents * commissionPct) / 100);
}
