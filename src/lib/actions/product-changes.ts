"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireShop } from "@/lib/auth";
import { parsePriceCents, UNIFIED_CATEGORIES_BY_SHOP_TYPE } from "@/lib/catalog";
import type { ProductCategory, ShopType } from "@/lib/domain/orders";
import { diffProduct } from "@/lib/domain/product-changes";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionState, Product } from "@/lib/types";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const BUCKET = "product-images";

const changeSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Escribe el nombre del producto").max(80),
  description: z.string().trim().max(200).optional(),
  category: z.enum(["carne", "fruta", "verdura", "pescado"]),
  unit: z.enum(["kg", "unidad", "bandeja"], { error: "Elige la unidad" }),
  price: z.string().min(1, "Escribe el precio"),
});

/** Categorías en las que una tienda propone cambios: la carnicería, la suya; las demás, el catálogo común de su tipo. */
function categoriesFor(type: ShopType): ProductCategory[] {
  return type === "carniceria" ? ["carne"] : UNIFIED_CATEGORIES_BY_SHOP_TYPE[type];
}

/** ¿Puede la tienda proponer cambios en este producto? */
function canPropose(product: Product, shopId: string, type: ShopType): boolean {
  if (type === "carniceria") return product.shop_id === shopId;
  return product.shop_id === null && categoriesFor(type).includes(product.category);
}

/** Ruta en el almacén de una foto aún pendiente de revisión (para borrarla si no se usa). */
function pendingPhotoPath(url: string | null | undefined): string | null {
  const match = url?.match(/\/product-images\/(pending\/.+)$/);
  return match ? match[1] : null;
}

async function removePendingPhoto(url: string | null | undefined) {
  const path = pendingPhotoPath(url);
  if (path) await createServiceClient().storage.from(BUCKET).remove([path]);
}

async function shopType(shopId: string): Promise<ShopType | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("shops").select("type").eq("id", shopId).single();
  return (data?.type as ShopType) ?? null;
}

/** Quita el cambio pendiente que la tienda ya tuviera para ese producto (el nuevo lo sustituye). */
async function replacePending(shopId: string, productId: string) {
  const supabase = await createClient();
  const { data: old } = await supabase
    .from("product_changes")
    .select("id, image_url")
    .eq("shop_id", shopId)
    .eq("product_id", productId)
    .eq("status", "pendiente")
    .maybeSingle();
  if (!old) return;
  await supabase.from("product_changes").delete().eq("id", old.id);
  await removePendingPhoto(old.image_url);
}

/**
 * La tienda propone crear o cambiar un producto (nombre, descripción, unidad, precio o foto).
 * No cambia nada todavía: queda «pendiente de revisión» hasta que el admin lo acepta.
 */
export async function proposeProductChange(_: ActionState, formData: FormData): Promise<ActionState> {
  const { profile, shopId } = await requireShop();
  const raw = Object.fromEntries(formData);
  const parsed = changeSchema.safeParse({ ...raw, id: raw.id || undefined, description: raw.description || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const priceCents = parsePriceCents(input.price);
  if (priceCents === null) return { error: "El precio no es válido. Escríbelo así: 3,50" };

  const type = await shopType(shopId);
  if (!type) return { error: "No encontramos tu tienda." };
  const supabase = await createClient();

  let current: Product | null = null;
  let category = input.category;
  if (input.id) {
    const { data } = await supabase.from("products").select("*").eq("id", input.id).maybeSingle<Product>();
    if (!data || !canPropose(data, shopId, type)) return { error: "Este producto no lo puedes cambiar." };
    current = data;
    category = data.category;
  } else if (!categoriesFor(type).includes(category)) {
    return { error: "Esa categoría no es de tu tienda." };
  }

  // La foto nueva se guarda aparte hasta que se acepte
  let imageUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const ext = PHOTO_TYPES[photo.type];
    if (!ext) return { error: "La foto tiene que ser JPG, PNG o WebP." };
    if (photo.size > MAX_PHOTO_BYTES) return { error: "La foto pesa demasiado (máximo 4 MB)." };
    const storage = createServiceClient().storage.from(BUCKET);
    const path = `pending/${shopId}/${Date.now()}.${ext}`;
    const { error } = await storage.upload(path, await photo.arrayBuffer(), { contentType: photo.type });
    if (error) return { error: "No se ha podido subir la foto. Inténtalo de nuevo." };
    imageUrl = storage.getPublicUrl(path).data.publicUrl;
  }

  const proposed = {
    name: input.name,
    description: input.description ?? null,
    unit: input.unit,
    price_cents: priceCents,
    image_url: imageUrl,
  };
  if (current && diffProduct(current, proposed).length === 0) {
    await removePendingPhoto(imageUrl);
    return { error: "No has cambiado nada. (Disponible o agotado se cambia desde la lista, al momento.)" };
  }
  if (current) await replacePending(shopId, current.id);

  const { error } = await supabase.from("product_changes").insert({
    shop_id: shopId,
    requested_by: profile.id,
    kind: current ? "editar" : "crear",
    product_id: current?.id ?? null,
    category,
    ...proposed,
    previous: current
      ? {
          name: current.name,
          description: current.description,
          unit: current.unit,
          price_cents: current.price_cents,
          image_url: current.image_url,
        }
      : null,
  });
  if (error) {
    await removePendingPhoto(imageUrl);
    return { error: "No se ha podido enviar el cambio. Inténtalo de nuevo." };
  }
  redirect("/tienda/productos?enviado=1");
}

/** La tienda pide que se elimine un producto (también pasa por revisión). */
export async function proposeProductDeletion(productId: string) {
  const { profile, shopId } = await requireShop();
  const type = await shopType(shopId);
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", productId).maybeSingle<Product>();
  if (!type || !product || !canPropose(product, shopId, type)) redirect("/tienda/productos");
  await replacePending(shopId, product.id);
  await supabase.from("product_changes").insert({
    shop_id: shopId,
    requested_by: profile.id,
    kind: "eliminar",
    product_id: product.id,
    category: product.category,
    previous: {
      name: product.name,
      description: product.description,
      unit: product.unit,
      price_cents: product.price_cents,
      image_url: product.image_url,
    },
  });
  redirect("/tienda/productos?enviado=1");
}

/** La tienda retira un cambio que aún no se ha revisado. */
export async function cancelProductChange(changeId: string) {
  const { shopId } = await requireShop();
  const supabase = await createClient();
  const { data: change } = await supabase
    .from("product_changes")
    .select("id, image_url")
    .eq("id", changeId)
    .eq("shop_id", shopId)
    .eq("status", "pendiente")
    .maybeSingle();
  if (!change) return;
  await supabase.from("product_changes").delete().eq("id", change.id);
  await removePendingPhoto(change.image_url);
  refresh();
}

/** El admin acepta (y se aplica al momento en la tienda) o rechaza un cambio, con un motivo opcional. */
export async function reviewProductChange(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = String(formData.get("change_id") ?? "");
  const approve = formData.get("decision") === "aceptar";
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const supabase = await createClient();
  const { data: change } = await supabase.from("product_changes").select("image_url").eq("id", id).maybeSingle();
  if (!change) return { error: "Ese cambio ya no existe." };
  const { error } = await supabase.rpc("review_product_change", { p_change_id: id, p_approve: approve, p_note: note || null });
  if (error) return { error: error.message.includes("revisado") ? "Ese cambio ya está revisado." : "No se ha podido guardar la revisión." };
  if (!approve) await removePendingPhoto(change.image_url);
  // La tarjeta desaparece de «pendientes»: el aviso sale arriba de la página
  redirect(`/admin/revisiones?hecho=${approve ? "aceptado" : "rechazado"}`);
}
