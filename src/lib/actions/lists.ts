"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { basketLockReason } from "@/lib/basket-rules";
import { getScheduleRules } from "@/lib/delivery";
import { normalizeQuantity, type ProductUnit } from "@/lib/domain/money";
import { usesDayBaskets } from "@/lib/domain/subscription";
import { copySavedBasketTo, defaultQuantity, savedBasketItems } from "@/lib/saved-baskets";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const nameSchema = z.string().trim().min(1, "Ponle un nombre.").max(60, "El nombre es demasiado largo.");

/** Cantidad con la que se guarda un producto: la que tenga en su cesta o, si no está, la de por defecto */
async function quantityToSave(supabase: Awaited<ReturnType<typeof createClient>>, customerId: string, productId: string) {
  const [{ data: inBasket }, { data: product }] = await Promise.all([
    supabase.from("basket_items").select("quantity").eq("customer_id", customerId).eq("product_id", productId).limit(1),
    supabase.from("products").select("unit").eq("id", productId).maybeSingle(),
  ]);
  if (inBasket?.[0]) return Number(inBasket[0].quantity);
  return defaultQuantity((product?.unit ?? "unidad") as ProductUnit);
}

/** Crea una cesta guardada vacía (o con un producto, si se crea desde su tarjeta). */
export async function createSavedBasket(name: string, productId?: string): Promise<{ error?: string; id?: string }> {
  const profile = await requireRole("cliente");
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: list, error } = await supabase
    .from("saved_lists")
    .insert({ customer_id: profile.id, kind: "cesta", name: parsed.data })
    .select("id")
    .single();
  if (error || !list) return { error: "No se ha podido crear la cesta." };
  if (productId) {
    const quantity = await quantityToSave(supabase, profile.id, productId);
    await supabase.from("saved_list_items").insert({ list_id: list.id, product_id: productId, quantity });
  }
  refresh();
  return { id: list.id };
}

/** Guarda la cesta que se está llenando como cesta guardada, con sus cantidades. */
export async function saveBasket(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  const parsed = nameSchema.safeParse(formData.get("name") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const slot = Number(formData.get("slot") ?? 0);
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("basket_items")
    .select("product_id, quantity")
    .eq("customer_id", profile.id)
    .eq("slot", slot);
  if (!items?.length) return { error: "Tu cesta está vacía: añade algo antes de guardarla." };

  const { data: list, error } = await supabase
    .from("saved_lists")
    .insert({ customer_id: profile.id, kind: "cesta", name: parsed.data })
    .select("id")
    .single();
  if (error || !list) return { error: "No se ha podido guardar la cesta." };
  const { error: itemsError } = await supabase
    .from("saved_list_items")
    .insert(items.map((i) => ({ list_id: list.id, product_id: i.product_id, quantity: i.quantity })));
  if (itemsError) {
    await supabase.from("saved_lists").delete().eq("id", list.id);
    return { error: "No se ha podido guardar la cesta." };
  }
  refresh();
  return { ok: `Cesta «${parsed.data}» creada. La tienes en Cestas.` };
}

/** Marcador de un producto: lo añade a una cesta guardada (con su cantidad) o lo quita. */
export async function setListItem(listId: string, productId: string, inList: boolean): Promise<{ error?: string }> {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const { error } = inList
    ? await supabase
        .from("saved_list_items")
        .upsert(
          { list_id: listId, product_id: productId, quantity: await quantityToSave(supabase, profile.id, productId) },
          { onConflict: "list_id,product_id", ignoreDuplicates: true },
        )
    : await supabase.from("saved_list_items").delete().eq("list_id", listId).eq("product_id", productId);
  // RLS solo deja tocar las cestas propias
  if (error) return { error: "No se ha podido cambiar la cesta guardada." };
  await supabase.from("saved_lists").update({ updated_at: new Date().toISOString() }).eq("id", listId);
  refresh();
  return {};
}

/** Cambia la cantidad de un producto en una cesta guardada (0 lo quita). Firma de QuantityStepper. */
export async function setSavedBasketQuantity(listId: string, productId: string, quantity: number): Promise<{ error?: string }> {
  await requireRole("cliente");
  const supabase = await createClient();
  if (quantity <= 0) {
    await supabase.from("saved_list_items").delete().eq("list_id", listId).eq("product_id", productId);
  } else {
    const { data: product } = await supabase.from("products").select("unit").eq("id", productId).maybeSingle();
    const rounded = normalizeQuantity(quantity, (product?.unit ?? "unidad") as ProductUnit);
    if (!(rounded > 0) || rounded > 50) return { error: "Esa cantidad no es válida." };
    const { error } = await supabase
      .from("saved_list_items")
      .upsert({ list_id: listId, product_id: productId, quantity: rounded }, { onConflict: "list_id,product_id" });
    if (error) return { error: "No se ha podido guardar el cambio." };
  }
  await supabase.from("saved_lists").update({ updated_at: new Date().toISOString() }).eq("id", listId);
  refresh();
  return {};
}

export async function renameList(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("cliente");
  const parsed = nameSchema.safeParse(formData.get("name") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_lists")
    .update({ name: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", String(formData.get("id")));
  if (error) return { error: "No se ha podido cambiar el nombre." };
  refresh();
  return { ok: "Nombre cambiado." };
}

export async function deleteList(listId: string): Promise<void> {
  await requireRole("cliente");
  const supabase = await createClient();
  await supabase.from("saved_lists").delete().eq("id", listId);
  redirect("/cestas-guardadas");
}

/**
 * Lleva una cesta guardada a la cesta que se está llenando: «sustituir» la cambia entera;
 * «añadir» suma los productos que falten, sin tocar los que ya estén.
 */
export async function applyList(
  listId: string,
  slot: number,
  mode: "sustituir" | "añadir",
): Promise<{ error?: string; ok?: string }> {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const locked = await basketLockReason(supabase, profile.id, slot);
  if (locked) return { error: locked };

  if (mode === "sustituir") {
    const { error } = await copySavedBasketTo(supabase, profile.id, listId, slot);
    if (error) return { error: "No se ha podido cambiar tu cesta." };
  } else {
    const items = await savedBasketItems(supabase, listId);
    if (items.length === 0) return { error: "No tiene ningún producto que esté a la venta ahora." };
    const { error } = await supabase.from("basket_items").upsert(
      items.map((i) => ({ customer_id: profile.id, slot, product_id: i.productId, quantity: i.quantity })),
      { onConflict: "customer_id,slot,product_id", ignoreDuplicates: true },
    );
    if (error) return { error: "No se han podido añadir los productos." };
  }
  refresh();
  return {
    ok:
      mode === "sustituir"
        ? "Hecho: tu cesta es ahora esta cesta guardada."
        : "Hecho: los productos que no tenías ya están en tu cesta.",
  };
}

/**
 * Activa (o quita) el envío automático con una cesta guardada: cada reparto del plan se prepara
 * solo, sin confirmar, y después la cesta vuelve a ser esta. Al activarlo, la cesta pasa a ser
 * esta ya. Solo una cesta automática; solo en los planes con reparto fijo.
 */
export async function setAutoDelivery(listId: string, on: boolean): Promise<{ error?: string; ok?: string }> {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  if (!on) {
    await supabase.from("saved_lists").update({ auto_delivery: false }).eq("id", listId);
    refresh();
    return { ok: "Envío automático desactivado. Desde ahora confirmas tú cada pedido." };
  }

  const { data: sub } = await supabase.from("subscriptions").select("status, frequency").eq("customer_id", profile.id).maybeSingle();
  if (sub?.status !== "activa") return { error: "Para el envío automático necesitas un plan activo." };
  if (sub.frequency === "por_envio") {
    return { error: "El envío automático es para los planes con reparto fijo. En pago por envío pides cada reparto." };
  }
  if ((await savedBasketItems(supabase, listId)).length === 0) {
    return { error: "Esta cesta está vacía: añade algo antes de activar el envío automático." };
  }

  // La cesta (o las del martes y el viernes, en 2 veces por semana) pasa a ser esta ya
  const slots = usesDayBaskets(sub.frequency)
    ? (await getScheduleRules(supabase)).filter((r) => r.active).map((r) => r.weekday)
    : [0];
  for (const slot of slots) {
    const locked = await basketLockReason(supabase, profile.id, slot);
    if (locked) return { error: locked };
  }
  await supabase.from("saved_lists").update({ auto_delivery: false }).eq("customer_id", profile.id).eq("auto_delivery", true);
  const { error } = await supabase.from("saved_lists").update({ auto_delivery: true }).eq("id", listId);
  if (error) return { error: "No se ha podido activar el envío automático." };
  for (const slot of slots) await copySavedBasketTo(supabase, profile.id, listId, slot);
  refresh();
  return { ok: "Envío automático activado: tus próximos repartos se preparan solos con esta cesta." };
}
