import { commissionCents } from "./money";

/** Un pedido vendido por la tienda: lo que el reparto ha recogido, con el peso real (IVA incluido). */
export type ShopSale = {
  shopOrderId: string;
  /** Día de reparto, YYYY-MM-DD */
  date: string;
  customer: string;
  totalCents: number;
};

export type MonthEarnings = {
  /** YYYY-MM */
  month: string;
  /** Del más reciente al más antiguo */
  orders: ShopSale[];
  salesCents: number;
  commissionCents: number;
  /** Lo que gana la tienda: ventas menos la comisión de Cistella */
  earningsCents: number;
};

/**
 * Ventas, comisión y ganancias de una tienda, mes a mes (del más reciente al más antiguo).
 * La comisión se calcula sobre el total del mes, como se factura.
 */
export function earningsByMonth(sales: ShopSale[], commissionPct: number): MonthEarnings[] {
  const months = new Map<string, ShopSale[]>();
  for (const sale of sales) {
    const month = sale.date.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), sale]);
  }
  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, orders]) => monthEarnings(month, orders, commissionPct));
}

/** Un mes concreto (también sin pedidos: todo a cero). */
export function monthEarnings(month: string, orders: ShopSale[], commissionPct: number): MonthEarnings {
  const sorted = [...orders].sort((a, b) => b.date.localeCompare(a.date) || a.customer.localeCompare(b.customer, "es"));
  const salesCents = sorted.reduce((sum, o) => sum + o.totalCents, 0);
  const commission = commissionCents(salesCents, commissionPct);
  return { month, orders: sorted, salesCents, commissionCents: commission, earningsCents: salesCents - commission };
}
