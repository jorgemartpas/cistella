"use server";

import { refresh } from "next/cache";
import { getCurrentProfile, requireRole } from "@/lib/auth";
import { cookies } from "next/headers";
import { basketLockReason } from "@/lib/basket-rules";
import { BASKET_DAY_COOKIE } from "@/lib/client-context";
import { toCadence } from "@/lib/delivery";
import { setGuestBasketQuantity } from "@/lib/guest-basket";
import { normalizeQuantity, type ProductUnit } from "@/lib/domain/money";
import { basketSlotFor, isDueOn } from "@/lib/domain/subscription";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/lib/types";

/**
 * Cambia la cantidad de un producto en la cesta (0 lo quita). `slot` es la cesta: 0 la única,
 * o el día de la semana en el plan de 2 veces por semana. Un visitante sin cuenta también
 * puede llenar su cesta: se guarda en una cookie y pasa a su cuenta cuando la crea o entra.
 */
export async function setBasketQuantity(productId: string, quantity: number, slot = 0): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  if (profile && profile.role !== "cliente") return { error: "Las tiendas y el equipo no tienen cesta." };
  const supabase = await createClient();
  if (profile) {
    const locked = await basketLockReason(supabase, profile.id, slot);
    if (locked) return { error: locked };
  }

  if (quantity <= 0) {
    if (!profile) {
      await setGuestBasketQuantity(productId, 0);
    } else {
      await supabase
        .from("basket_items")
        .delete()
        .eq("customer_id", profile.id)
        .eq("slot", slot)
        .eq("product_id", productId);
    }
    refresh();
    return {};
  }

  const { data: product } = await supabase.from("products").select("unit, active").eq("id", productId).maybeSingle();
  if (!product?.active) return { error: "Este producto ya no está disponible." };
  // Al gramo en lo que va al kilo; enteros en unidades y bandejas
  const rounded = normalizeQuantity(quantity, product.unit as ProductUnit);
  if (!(rounded > 0) || rounded > 50) return { error: "Esa cantidad no es válida." };

  if (!profile) {
    await setGuestBasketQuantity(productId, rounded);
    refresh();
    return {};
  }
  const { error } = await supabase
    .from("basket_items")
    .upsert(
      { customer_id: profile.id, product_id: productId, slot, quantity: rounded },
      { onConflict: "customer_id,slot,product_id" },
    );
  if (error) return { error: "No se ha podido guardar el cambio. Inténtalo de nuevo." };
  refresh();
  return {};
}

/**
 * Confirma (o anula) un reparto. Sin confirmar, ese día no se prepara nada. En los planes con
 * cuota solo se confirman los días que tocan; en pago por envío, cualquiera (es pedirlo).
 * Solo hasta la hora de cierre de ese reparto.
 */
export async function confirmDelivery(dayId: string, confirmed: boolean): Promise<{ error?: string }> {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const [{ data: sub }, { data: day }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("customer_id", profile.id).maybeSingle<Subscription>(),
    supabase.from("delivery_days").select("id, date").eq("id", dayId).maybeSingle(),
  ]);
  if (sub?.status !== "activa") return { error: "Necesitas un plan activo para recibir repartos." };
  if (!day) return { error: "Ese reparto ya no existe." };
  if (sub.frequency !== "por_envio" && !isDueOn(toCadence(sub), day.date)) {
    return { error: "Ese día no te toca reparto con tu plan." };
  }

  if (confirmed) {
    const { count } = await supabase
      .from("basket_items")
      .select("product_id", { count: "exact", head: true })
      .eq("customer_id", profile.id)
      .eq("slot", basketSlotFor(sub.frequency, day.date));
    if (!count) return { error: "Tu cesta está vacía. Añade algo antes de confirmar." };
  }

  const { error } = confirmed
    ? await supabase.from("delivery_requests").insert({ customer_id: profile.id, delivery_day_id: dayId })
    : await supabase.from("delivery_requests").delete().eq("customer_id", profile.id).eq("delivery_day_id", dayId);
  // RLS solo deja confirmar o anular repartos abiertos y antes de su cierre
  if (error && error.code !== "23505") return { error: "Ese reparto ya está cerrado." };
  refresh();
  return {};
}

/** Plan de 2 veces por semana: elige qué cesta (la de qué día) se está llenando. */
export async function chooseBasketDay(weekday: number): Promise<void> {
  await requireRole("cliente");
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return;
  (await cookies()).set(BASKET_DAY_COOKIE, String(weekday), { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax" });
  refresh();
}
