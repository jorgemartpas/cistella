import "server-only";
import { UNIFIED_CATEGORIES_BY_SHOP_TYPE } from "@/lib/catalog";
import { buildDayPlan } from "@/lib/delivery";
import { madridDate } from "@/lib/domain/dates";
import { demandByProduct, stockStatus, type StockStatus } from "@/lib/domain/inventory";
import { createServiceClient } from "@/lib/supabase/server";
import type { DeliveryDay, Product, Shop } from "@/lib/types";

export type InventoryRow = {
  product: Product;
  /** null: la tienda no lleva inventario de este producto */
  stock: number | null;
  /** Lo pedido para el próximo reparto (aún sin preparar) */
  ordered: number;
  status: StockStatus;
  /** Catálogo unificado: si la tienda lo tiene marcado como «lo tengo» */
  available: boolean;
};

export type ShopInventory = {
  shop: Shop;
  /** Próximo reparto de la tienda (null si no tiene ninguno programado) */
  day: DeliveryDay | null;
  /** true: el reparto aún no ha cerrado y lo pedido es lo confirmado hasta ahora */
  preview: boolean;
  marginKg: number;
  rows: InventoryRow[];
};

/**
 * Inventario de una tienda frente a lo pedido para su próximo reparto. Si el reparto aún está
 * abierto, lo pedido es una previsión (lo que saldría si cerrara ahora); si ya ha cerrado, lo que
 * queda por preparar (lo preparado ya se ha restado del inventario).
 * Usa la clave de servicio: llamar solo después de comprobar que es la tienda o el admin.
 */
export async function getShopInventory(shopId: string, now = new Date()): Promise<ShopInventory | null> {
  const service = createServiceClient();
  const { data: shop } = await service.from("shops").select("*").eq("id", shopId).maybeSingle<Shop>();
  if (!shop) return null;

  const today = madridDate(now);
  const productsQuery =
    shop.type === "carniceria"
      ? service.from("products").select("*").eq("shop_id", shop.id)
      : service
          .from("products")
          .select("*")
          .is("shop_id", null)
          .eq("active", true)
          .in("category", UNIFIED_CATEGORIES_BY_SHOP_TYPE[shop.type]);
  const [{ data: products }, { data: stock }, { data: availability }, { data: settings }, { data: days }] =
    await Promise.all([
      productsQuery.order("category").order("name"),
      service.from("shop_inventory").select("product_id, quantity").eq("shop_id", shop.id),
      service.from("shop_availability").select("product_id, available").eq("shop_id", shop.id),
      service.from("settings").select("inventory_margin_kg").single(),
      service.from("delivery_days").select("*").gte("date", today).neq("status", "cancelado").order("date").limit(20),
    ]);

  // Próximo reparto en el que trabaja: abierto, o cerrado con partes aún por preparar
  const onDuty = ((days ?? []) as DeliveryDay[]).filter(
    (d) => shop.type === "carniceria" || d.fruteria_id === shop.id || d.pescaderia_id === shop.id,
  );
  const closedIds = onDuty.filter((d) => d.status === "cerrado").map((d) => d.id);
  const { data: pending } = closedIds.length
    ? await service
        .from("shop_orders")
        .select("delivery_day_id, order_items(product_id, quantity_ordered)")
        .eq("shop_id", shop.id)
        .eq("status", "pendiente")
        .in("delivery_day_id", closedIds)
    : { data: [] };
  const pendingParts = (pending ?? []) as {
    delivery_day_id: string;
    order_items: { product_id: string | null; quantity_ordered: number }[];
  }[];
  const day =
    onDuty.find((d) => d.status === "abierto" || pendingParts.some((p) => p.delivery_day_id === d.id)) ?? null;

  let ordered = new Map<string, number>();
  if (day?.status === "abierto") {
    const { plan } = await buildDayPlan(service, day);
    ordered = demandByProduct(
      plan.orders.flatMap((o) =>
        o.shops.filter((s) => s.shopId === shop.id).flatMap((s) => s.items.map((i) => ({ productId: i.productId, quantity: i.quantity }))),
      ),
    );
  } else if (day) {
    ordered = demandByProduct(
      pendingParts
        .filter((p) => p.delivery_day_id === day.id)
        .flatMap((p) => p.order_items.map((i) => ({ productId: i.product_id, quantity: Number(i.quantity_ordered) }))),
    );
  }

  const marginKg = Number(settings?.inventory_margin_kg ?? 5);
  const stockOf = new Map((stock ?? []).map((r) => [r.product_id as string, Number(r.quantity)]));
  const availableOf = new Map((availability ?? []).map((a) => [a.product_id as string, Boolean(a.available)]));
  const rows = ((products ?? []) as Product[]).map((product) => {
    const s = stockOf.has(product.id) ? stockOf.get(product.id)! : null;
    const o = ordered.get(product.id) ?? 0;
    return {
      product,
      stock: s,
      ordered: o,
      status: stockStatus(s, o, product.unit, marginKg),
      available: shop.type === "carniceria" ? product.active : (availableOf.get(product.id) ?? false),
    };
  });
  return { shop, day, preview: day?.status === "abierto", marginKg, rows };
}
