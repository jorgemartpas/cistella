"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { basketLockReason } from "@/lib/basket-rules";
import { normalizeQuantity, type ProductUnit } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const nameSchema = z.string().trim().min(1, "Ponle un nombre.").max(60, "El nombre es demasiado largo.");

/** Cantidad con la que entra un producto de una lista sin cantidad: medio kilo o una unidad */
const defaultQuantity = (unit: ProductUnit) => (unit === "kg" ? 0.5 : 1);

/** Crea una lista vacía (o con un producto, si se crea desde su tarjeta). */
export async function createList(name: string, productId?: string): Promise<{ error?: string; id?: string }> {
  const profile = await requireRole("cliente");
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: list, error } = await supabase
    .from("saved_lists")
    .insert({ customer_id: profile.id, kind: "lista", name: parsed.data })
    .select("id")
    .single();
  if (error || !list) return { error: "No se ha podido crear la lista." };
  if (productId) await supabase.from("saved_list_items").insert({ list_id: list.id, product_id: productId });
  refresh();
  return { id: list.id };
}

/** Formulario «Nueva lista» de la página de listas. */
export async function createListForm(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await createList(String(formData.get("name") ?? ""));
  if (result.error) return { error: result.error };
  redirect(`/listas/${result.id}`);
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
  return { ok: `Guardada como «${parsed.data}». La tienes en Listas y cestas.` };
}

/** Añade o quita un producto de una lista. */
export async function setListItem(listId: string, productId: string, inList: boolean): Promise<{ error?: string }> {
  await requireRole("cliente");
  const supabase = await createClient();
  const { error } = inList
    ? await supabase.from("saved_list_items").upsert({ list_id: listId, product_id: productId }, { ignoreDuplicates: true })
    : await supabase.from("saved_list_items").delete().eq("list_id", listId).eq("product_id", productId);
  // RLS solo deja tocar las listas propias
  if (error) return { error: "No se ha podido cambiar la lista." };
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
  const { data: list } = await supabase.from("saved_lists").select("kind").eq("id", listId).maybeSingle();
  await supabase.from("saved_lists").delete().eq("id", listId);
  redirect(`/listas?ver=${list?.kind === "cesta" ? "cestas" : "listas"}`);
}

/**
 * Lleva una lista o cesta guardada a la cesta que se está llenando. Una cesta guardada la
 * sustituye entera; una lista añade los productos que falten (sin tocar los que ya estén).
 */
export async function applyList(listId: string, slot: number): Promise<{ error?: string; ok?: string }> {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const locked = await basketLockReason(supabase, profile.id, slot);
  if (locked) return { error: locked };

  const [{ data: list }, { data: items }] = await Promise.all([
    supabase.from("saved_lists").select("kind").eq("id", listId).maybeSingle(),
    supabase.from("saved_list_items").select("quantity, products(id, unit, active)").eq("list_id", listId),
  ]);
  if (!list) return { error: "Esa lista ya no existe." };
  const usable = (items ?? [])
    .map((i) => ({ quantity: i.quantity as number | null, product: i.products as unknown as { id: string; unit: ProductUnit; active: boolean } | null }))
    .filter((i) => i.product?.active);
  if (usable.length === 0) return { error: "No tiene ningún producto que esté a la venta ahora." };

  const rows = usable.map(({ quantity, product }) => ({
    customer_id: profile.id,
    slot,
    product_id: product!.id,
    quantity: normalizeQuantity(Number(quantity ?? defaultQuantity(product!.unit)), product!.unit),
  }));

  if (list.kind === "cesta") {
    const { error: deleteError } = await supabase.from("basket_items").delete().eq("customer_id", profile.id).eq("slot", slot);
    if (deleteError) return { error: "No se ha podido cambiar tu cesta." };
    const { error } = await supabase.from("basket_items").insert(rows);
    if (error) return { error: "No se ha podido cambiar tu cesta." };
  } else {
    const { error } = await supabase
      .from("basket_items")
      .upsert(rows, { onConflict: "customer_id,slot,product_id", ignoreDuplicates: true });
    if (error) return { error: "No se han podido añadir los productos." };
  }
  refresh();
  return {
    ok:
      list.kind === "cesta"
        ? "Hecho: tu cesta es ahora esta cesta guardada."
        : "Hecho: los productos que no tenías ya están en tu cesta.",
  };
}
