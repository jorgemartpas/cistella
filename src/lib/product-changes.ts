import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductCategory } from "@/lib/domain/orders";
import {
  changeSummary,
  describeChange,
  diffProduct,
  requesterName,
  type ChangeKind,
  type FieldDiff,
  type ReviewedFields,
} from "@/lib/domain/product-changes";

export type ChangeStatus = "pendiente" | "aprobado" | "rechazado";

export type ChangeView = {
  id: string;
  kind: ChangeKind;
  status: ChangeStatus;
  category: ProductCategory;
  shopId: string;
  shopName: string;
  /** «Óscar (Oskiñez)» */
  who: string;
  productId: string | null;
  productName: string;
  /** Cómo está (o estaba) el producto; null al crear */
  current: ReviewedFields | null;
  /** Cómo quedaría; null al eliminar */
  proposed: ReviewedFields | null;
  diffs: FieldDiff[];
  /** «cambiar el precio de «Chorizo» (…)» */
  summary: string;
  /** «Óscar (Oskiñez) quiere cambiar el precio de «Chorizo» (…)» */
  title: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

type Row = {
  id: string;
  kind: ChangeKind;
  status: ChangeStatus;
  category: ProductCategory;
  shop_id: string;
  requested_by: string | null;
  product_id: string | null;
  name: string | null;
  description: string | null;
  unit: ReviewedFields["unit"] | null;
  price_cents: number | null;
  image_url: string | null;
  previous: ReviewedFields | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  shops: { name: string } | null;
};

/**
 * Cambios propuestos por las tiendas, listos para enseñar. `pending`: solo los pendientes (los
 * más antiguos primero); si no, los ya revisados (los últimos primero). RLS limita lo que ve cada uno.
 */
export async function loadChanges(
  supabase: SupabaseClient,
  { pending, shopId, limit = 50 }: { pending: boolean; shopId?: string; limit?: number },
): Promise<ChangeView[]> {
  let query = supabase.from("product_changes").select("*, shops(name)").limit(limit);
  query = pending
    ? query.eq("status", "pendiente").order("created_at", { ascending: true })
    : query.neq("status", "pendiente").order("reviewed_at", { ascending: false });
  if (shopId) query = query.eq("shop_id", shopId);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];

  const productIds = [...new Set(rows.map((r) => r.product_id).filter((id): id is string => Boolean(id)))];
  const requesterIds = [...new Set(rows.map((r) => r.requested_by).filter((id): id is string => Boolean(id)))];
  const [{ data: products }, { data: profiles }] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("id, name, description, unit, price_cents, image_url").in("id", productIds)
      : Promise.resolve({ data: [] }),
    requesterIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", requesterIds)
      : Promise.resolve({ data: [] }),
  ]);
  const productById = new Map(((products ?? []) as (ReviewedFields & { id: string })[]).map((p) => [p.id, p]));
  const nameById = new Map(((profiles ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));

  return rows.map((r) => {
    const shopName = r.shops?.name ?? "Una tienda";
    // Pendiente: se compara con cómo está ahora el producto; revisado: con cómo estaba al pedirlo
    const live = r.product_id ? productById.get(r.product_id) : undefined;
    const current = r.kind === "crear" ? null : ((r.status === "pendiente" ? live : null) ?? r.previous ?? live ?? null);
    const proposed: ReviewedFields | null =
      r.kind === "eliminar" || !r.name || !r.unit || r.price_cents === null
        ? null
        : { name: r.name, description: r.description, unit: r.unit, price_cents: r.price_cents, image_url: r.image_url };
    const diffs = current && proposed ? diffProduct(current, proposed) : [];
    const productName = current?.name ?? proposed?.name ?? "producto";
    const who = requesterName(r.requested_by ? nameById.get(r.requested_by) : null, shopName);
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      category: r.category,
      shopId: r.shop_id,
      shopName,
      who,
      productId: r.product_id,
      productName,
      current,
      proposed,
      diffs,
      summary: changeSummary(r.kind, productName, diffs),
      title: describeChange(who, r.kind, productName, diffs),
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
      reviewNote: r.review_note,
    };
  });
}

/** Cuántos cambios esperan revisión (para la campana del admin). */
export async function pendingChangesCount(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("product_changes")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendiente");
  return count ?? 0;
}
