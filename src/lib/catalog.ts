import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseEurosToCents } from "@/lib/domain/money";
import type { ProductCategory, ShopType } from "@/lib/domain/orders";
import type { Product, Shop } from "@/lib/types";

export const CATEGORY_ORDER: ProductCategory[] = ["fruta", "verdura", "pescado", "carne"];

export const CATEGORY_ICONS: Record<ProductCategory, string> = {
  fruta: "🍊",
  verdura: "🥬",
  pescado: "🐟",
  carne: "🥩",
};

/** Categorías del catálogo unificado que sirve cada tipo de tienda. */
export const UNIFIED_CATEGORIES_BY_SHOP_TYPE: Record<ShopType, ProductCategory[]> = {
  fruteria: ["fruta", "verdura"],
  pescaderia: ["pescado"],
  carniceria: [],
};

export async function getShops(supabase: SupabaseClient): Promise<Shop[]> {
  const { data, error } = await supabase
    .from("shops")
    .select("*")
    .order("type")
    .order("rotation_order")
    .order("name");
  if (error) throw error;
  return data as Shop[];
}

export async function getProducts(
  supabase: SupabaseClient,
  filter: { categories?: ProductCategory[]; shopId?: string; onlyActive?: boolean } = {},
): Promise<Product[]> {
  let query = supabase.from("products").select("*").order("name");
  if (filter.categories) query = query.in("category", filter.categories);
  if (filter.shopId) query = query.eq("shop_id", filter.shopId);
  if (filter.onlyActive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data as Product[];
}

/** "3,50" o "3.5" → 350 céntimos. Devuelve null si no es un precio válido (mayor que cero). */
export function parsePriceCents(input: string): number | null {
  return parseEurosToCents(input);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
