"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { chargeOrder } from "@/lib/payments";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/** La furgoneta recoge en una tienda todas sus partes de ese día. */
export async function markShopPickedUp(dayId: string, shopId: string) {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("shop_orders")
    .update({ status: "recogido" })
    .eq("delivery_day_id", dayId)
    .eq("shop_id", shopId)
    .neq("status", "recogido");
  refresh();
}

/** Entregado: se cierra el pedido y se cobra con el peso real. */
export async function markDelivered(orderId: string) {
  await requireRole("admin");
  const supabase = await createClient();
  // Si se entrega, lo de todas las tiendas ya se había recogido
  await supabase.from("shop_orders").update({ status: "recogido" }).eq("order_id", orderId).neq("status", "recogido");
  const { data: updated } = await supabase
    .from("orders")
    .update({ status: "entregado", delivered_at: new Date().toISOString() })
    .eq("id", orderId)
    .in("status", ["pendiente", "preparado", "en_reparto"])
    .select("id");
  if (updated?.length) await chargeOrder(createServiceClient(), orderId);
  refresh();
}

/** El cliente no estaba. De momento no se cobra (decisión pendiente); el admin puede cobrarlo después. */
export async function markNotDelivered(orderId: string) {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("orders")
    .update({ status: "no_entregado" })
    .eq("id", orderId)
    .in("status", ["pendiente", "preparado", "en_reparto"]);
  refresh();
}

/** Reintenta el cobro (tras un fallo) o cobra un pedido no entregado. */
export async function chargeAgain(orderId: string) {
  await requireRole("admin");
  await chargeOrder(createServiceClient(), orderId);
  refresh();
}
