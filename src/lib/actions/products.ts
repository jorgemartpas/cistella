"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { parsePriceCents } from "@/lib/catalog";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const productSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Escribe el nombre del producto").max(80),
  description: z.string().trim().max(200).optional(),
  category: z.enum(["carne", "fruta", "verdura", "pescado"]),
  unit: z.enum(["kg", "unidad", "bandeja"], { error: "Elige la unidad" }),
  price: z.string().min(1, "Escribe el precio"),
  active: z.literal("on").optional(),
});

/**
 * Crea o edita un producto. El admin gestiona el catálogo unificado (y puede corregir cualquier
 * producto); cada carnicería solo los suyos. RLS lo vuelve a comprobar en la base de datos.
 */
export async function saveProduct(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("admin", "tienda");
  const raw = Object.fromEntries(formData);
  const parsed = productSchema.safeParse({ ...raw, id: raw.id || undefined, description: raw.description || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const priceCents = parsePriceCents(input.price);
  if (priceCents === null) return { error: "El precio no es válido. Escríbelo así: 3,50" };

  const supabase = await createClient();
  let shopId: string | null = null;
  let category = input.category;

  if (profile.role === "tienda") {
    const { data: shop } = await supabase.from("shops").select("type").eq("id", profile.shop_id).single();
    if (shop?.type !== "carniceria") return { error: "Solo las carnicerías gestionan sus propios productos." };
    shopId = profile.shop_id;
    category = "carne";
  } else if (input.id) {
    // El admin no cambia la tienda ni el tipo (carne o catálogo unificado) de un producto existente
    const { data: existing } = await supabase.from("products").select("shop_id, category").eq("id", input.id).single();
    if (!existing) return { error: "Ese producto ya no existe." };
    shopId = existing.shop_id;
    if (existing.category === "carne") category = "carne";
    else if (category === "carne") return { error: "La carne la gestionan las carnicerías." };
  } else if (category === "carne") {
    return { error: "La carne la crean las carnicerías desde su panel." };
  }

  const values = {
    name: input.name,
    description: input.description ?? null,
    category,
    unit: input.unit,
    price_cents: priceCents,
    active: input.active === "on",
    shop_id: shopId,
  };

  const { data: saved, error } = input.id
    ? await supabase.from("products").update(values).eq("id", input.id).select("id").single()
    : await supabase.from("products").insert(values).select("id").single();
  if (error || !saved) return { error: "No se ha podido guardar el producto. Inténtalo de nuevo." };

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const ext = PHOTO_TYPES[photo.type];
    if (!ext) return { error: "La foto tiene que ser JPG, PNG o WebP. El producto se ha guardado sin foto." };
    if (photo.size > MAX_PHOTO_BYTES) return { error: "La foto pesa demasiado (máximo 4 MB). El producto se ha guardado sin foto." };
    // Ya sabemos que puede editar el producto (la escritura anterior pasó por RLS)
    const storage = createServiceClient().storage.from("product-images");
    const path = `${saved.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await storage.upload(path, await photo.arrayBuffer(), {
      contentType: photo.type,
      upsert: true,
    });
    if (uploadError) return { error: "No se ha podido subir la foto. El resto de datos sí se han guardado." };
    const imageUrl = storage.getPublicUrl(path).data.publicUrl;
    await supabase.from("products").update({ image_url: imageUrl }).eq("id", saved.id);
  }

  redirect(profile.role === "admin" ? `/admin/catalogo?categoria=${category}` : "/tienda/productos");
}

/** Activa o retira un producto (en carne equivale a "disponible o no"). */
export async function setProductActive(productId: string, active: boolean) {
  await requireRole("admin", "tienda");
  const supabase = await createClient();
  await supabase.from("products").update({ active }).eq("id", productId);
  refresh();
}

export async function deleteProduct(productId: string) {
  const profile = await requireRole("admin", "tienda");
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("category").eq("id", productId).single();
  await supabase.from("products").delete().eq("id", productId);
  redirect(profile.role === "admin" ? `/admin/catalogo?categoria=${data?.category ?? "fruta"}` : "/tienda/productos");
}

/** Marca si una tienda tiene un producto del catálogo unificado. */
export async function setAvailability(shopId: string, productId: string, available: boolean) {
  const profile = await requireRole("admin", "tienda");
  if (profile.role === "tienda" && profile.shop_id !== shopId) return;
  const supabase = await createClient();
  await supabase
    .from("shop_availability")
    .upsert({ shop_id: shopId, product_id: productId, available }, { onConflict: "shop_id,product_id" });
  refresh();
}
