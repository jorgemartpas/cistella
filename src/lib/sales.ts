import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/domain/dates";
import { commissionCents } from "@/lib/domain/money";
import type { Shop } from "@/lib/types";

export type ShopMonthSales = {
  shop: Shop;
  orders: number;
  salesCents: number;
  commissionCents: number;
};

/** Primer y último día de un mes 'YYYY-MM' */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from: `${month}-01`, to: addDays(next, -1) };
}

/** Ventas y comisión de cada tienda en un mes (lo recogido por el reparto, con el peso real). */
export async function salesByShop(supabase: SupabaseClient, month: string): Promise<ShopMonthSales[]> {
  const { from, to } = monthRange(month);
  const [{ data: shops }, { data: sales }] = await Promise.all([
    supabase.from("shops").select("*").order("type").order("name"),
    supabase.from("shop_sales").select("shop_id, total_cents").gte("delivery_date", from).lte("delivery_date", to),
  ]);
  return ((shops ?? []) as Shop[]).map((shop) => {
    const rows = (sales ?? []).filter((s) => s.shop_id === shop.id);
    const salesCents = rows.reduce((sum, r) => sum + Number(r.total_cents), 0);
    return {
      shop,
      orders: rows.length,
      salesCents,
      commissionCents: commissionCents(salesCents, Number(shop.commission_pct)),
    };
  });
}
