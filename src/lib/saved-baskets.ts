import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeQuantity, type ProductUnit } from "@/lib/domain/money";

/** Cantidad con la que entra un producto guardado sin cantidad: medio kilo o una unidad */
export const defaultQuantity = (unit: ProductUnit) => (unit === "kg" ? 0.5 : 1);

/** Productos (a la venta) y cantidades de una cesta guardada */
export async function savedBasketItems(
  supabase: SupabaseClient,
  listId: string,
): Promise<{ productId: string; quantity: number }[]> {
  const { data } = await supabase
    .from("saved_list_items")
    .select("quantity, products(id, unit, active)")
    .eq("list_id", listId);
  return (data ?? []).flatMap((row) => {
    const product = row.products as unknown as { id: string; unit: ProductUnit; active: boolean } | null;
    if (!product?.active) return [];
    const quantity = row.quantity === null ? defaultQuantity(product.unit) : Number(row.quantity);
    return [{ productId: product.id, quantity: normalizeQuantity(quantity, product.unit) }];
  });
}

/** Deja la cesta `slot` del cliente igual que una cesta guardada. */
export async function copySavedBasketTo(
  supabase: SupabaseClient,
  customerId: string,
  listId: string,
  slot: number,
): Promise<{ error?: string }> {
  const items = await savedBasketItems(supabase, listId);
  const { error: deleteError } = await supabase.from("basket_items").delete().eq("customer_id", customerId).eq("slot", slot);
  if (deleteError) return { error: deleteError.message };
  if (items.length === 0) return {};
  const { error } = await supabase
    .from("basket_items")
    .insert(items.map((i) => ({ customer_id: customerId, slot, product_id: i.productId, quantity: i.quantity })));
  return error ? { error: error.message } : {};
}
