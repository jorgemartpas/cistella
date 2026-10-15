"use server";

import { refresh } from "next/cache";
import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState, OrderItem, ShopOrder } from "@/lib/types";

/** Guarda las cantidades reales (si cambian) y marca la parte del pedido como preparada. */
export async function prepareShopOrder(_: ActionState, formData: FormData): Promise<ActionState> {
  const { shopId } = await requireShop();
  const id = String(formData.get("shop_order_id") ?? "");
  const supabase = await createClient();
  const { data: part } = await supabase
    .from("shop_orders")
    .select("id, status, order_items(id, product_name, quantity_ordered)")
    .eq("id", id)
    .eq("shop_id", shopId)
    .maybeSingle<Pick<ShopOrder, "id" | "status"> & { order_items: Pick<OrderItem, "id" | "product_name" | "quantity_ordered">[] }>();
  if (!part) return { error: "Este pedido no es de tu tienda." };
  if (part.status === "recogido") return { error: "Este pedido ya lo ha recogido el reparto." };

  for (const item of part.order_items) {
    const raw = String(formData.get(`real_${item.id}`) ?? "").trim().replace(",", ".");
    let actual: number | null = null;
    if (raw !== "") {
      actual = Number(raw);
      if (!Number.isFinite(actual) || actual < 0 || actual > 100) {
        return { error: `La cantidad real de ${item.product_name} no es válida.` };
      }
      actual = Math.round(actual * 1000) / 1000;
    }
    const { error } = await supabase.from("order_items").update({ quantity_actual: actual }).eq("id", item.id);
    if (error) return { error: "No se han podido guardar las cantidades." };
  }

  const { error } = await supabase.from("shop_orders").update({ status: "preparado" }).eq("id", part.id);
  if (error) return { error: "No se ha podido marcar como preparado." };
  refresh();
  return { ok: "Preparado." };
}

export async function reopenShopOrder(shopOrderId: string) {
  const { shopId } = await requireShop();
  const supabase = await createClient();
  await supabase
    .from("shop_orders")
    .update({ status: "pendiente" })
    .eq("id", shopOrderId)
    .eq("shop_id", shopId)
    .eq("status", "preparado");
  refresh();
}
