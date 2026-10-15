"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { normalizeQuantity, parseQuantity, type ProductUnit } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";

/**
 * Apunta cuánto tiene una tienda de un producto (en su unidad). Vacío = deja de llevar inventario
 * de ese producto. La tienda solo el suyo; el admin, el de cualquiera (RLS lo vuelve a comprobar).
 */
export async function setStock(shopId: string, productId: string, input: string): Promise<{ error?: string }> {
  const profile = await requireRole("admin", "tienda");
  if (profile.role === "tienda" && profile.shop_id !== shopId) return { error: "Este inventario no es de tu tienda." };
  const supabase = await createClient();

  if (input.trim() === "") {
    const { error } = await supabase.from("shop_inventory").delete().eq("shop_id", shopId).eq("product_id", productId);
    if (error) return { error: "No se ha podido guardar." };
    refresh();
    return {};
  }
  const parsed = parseQuantity(input);
  if (parsed === null || parsed > 100000) return { error: "Escribe la cantidad así: 30 o 12,5" };
  const { data: product } = await supabase.from("products").select("unit").eq("id", productId).maybeSingle();
  if (!product) return { error: "Ese producto ya no existe." };

  const { error } = await supabase
    .from("shop_inventory")
    .upsert(
      { shop_id: shopId, product_id: productId, quantity: normalizeQuantity(parsed, product.unit as ProductUnit) },
      { onConflict: "shop_id,product_id" },
    );
  if (error) return { error: "No se ha podido guardar." };
  refresh();
  return {};
}
