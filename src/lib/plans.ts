import { formatEuros } from "@/lib/domain/money";
import type { DeliveryFrequency } from "@/lib/domain/subscription";
import type { Settings } from "@/lib/types";

export type PlanPrices = Pick<
  Settings,
  "price_dos_por_semana_cents" | "price_semanal_cents" | "price_quincenal_cents" | "delivery_fee_cents"
>;

/** Precios por defecto (los de la migración); los reales están en Ajustes */
export const DEFAULT_PRICES: PlanPrices = {
  price_dos_por_semana_cents: 2500,
  price_semanal_cents: 2000,
  price_quincenal_cents: 1600,
  delivery_fee_cents: 600,
};

/** Cuota mensual de cada plan, según Ajustes (0 en el pago por envío) */
export function monthlyPriceCents(prices: PlanPrices, plan: DeliveryFrequency): number {
  if (plan === "dos_por_semana") return prices.price_dos_por_semana_cents;
  if (plan === "semanal") return prices.price_semanal_cents;
  if (plan === "quincenal") return prices.price_quincenal_cents;
  return 0;
}

/** "25,00 €/mes" o "6,00 € por envío" */
export function planPriceLabel(prices: PlanPrices, plan: DeliveryFrequency): string {
  return plan === "por_envio"
    ? `${formatEuros(prices.delivery_fee_cents)} por envío`
    : `${formatEuros(monthlyPriceCents(prices, plan))}/mes`;
}

const WEEKDAYS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** "Cada semana, los martes", "2 veces por semana" o "Pago por envío" */
export function planDescription(sub: { frequency: DeliveryFrequency; delivery_weekday: number }): string {
  if (sub.frequency === "dos_por_semana") return "2 veces por semana";
  if (sub.frequency === "por_envio") return "Pago por envío";
  return `${sub.frequency === "semanal" ? "Cada semana" : "Cada 15 días"}, los ${WEEKDAYS[sub.delivery_weekday]}`;
}

/** Textos de la prueba gratis (todos los sitios dicen lo mismo) */
export const TRIAL_COPY = {
  badge: "2 semanas gratis",
  title: "Prueba Cistella 2 semanas gratis",
  rule: "Sin cuota durante 2 semanas o tus 2 primeros pedidos, lo que llegue antes.",
  after: "Después, la cuota se cobra sola cada mes. Si te das de baja antes, no pagas ninguna cuota.",
  products: "Los productos se pagan siempre, al entregarlos, con el peso real.",
};
