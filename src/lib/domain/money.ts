export type ProductUnit = "kg" | "unidad" | "bandeja";

export const UNIT_LABELS: Record<ProductUnit, { short: string; singular: string; plural: string }> = {
  kg: { short: "kg", singular: "kg", plural: "kg" },
  unidad: { short: "ud.", singular: "unidad", plural: "unidades" },
  bandeja: { short: "bandeja", singular: "bandeja", plural: "bandejas" },
};

/** Paso al ajustar cantidades: cuartos de kilo o unidades enteras. */
export function quantityStep(unit: ProductUnit): number {
  return unit === "kg" ? 0.25 : 1;
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
