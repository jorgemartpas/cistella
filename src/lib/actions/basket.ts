"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { closingDayFor, getScheduleRules } from "@/lib/delivery";
import { quantityStep, type ProductUnit } from "@/lib/domain/money";
import { usesDayBaskets } from "@/lib/domain/subscription";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/lib/types";

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Cambia la cantidad de un producto en la cesta (0 lo quita). `slot` es la cesta: 0 la única,
 * o el día de la semana en el plan de 2 veces por semana. Mientras se cierra un reparto del
 * cliente (entre la hora de cierre y la generación de pedidos) no se puede tocar.
 */
export async function setBasketQuantity(productId: string, quantity: number, slot = 0): Promise<{ error?: string }> {
  const profile = await requireRole("cliente");
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("customer_id", profile.id)
    .maybeSingle<Subscription>();

  if (sub && usesDayBaskets(sub.frequency)) {
    const rules = await getScheduleRules(supabase);
    if (!rules.some((r) => r.active && r.weekday === slot)) return { error: "Elige la cesta de un día de reparto." };
  } else if (slot !== 0) {
    return { error: "Tu plan tiene una sola cesta." };
  }

  if (sub?.status === "activa") {
    const closing = await closingDayFor(supabase, sub, new Date());
    if (closing) {
      return {
        error: `Estamos cerrando el reparto del ${DATE_FORMAT.format(new Date(closing.date))}. En unos minutos podrás cambiar la cesta para el siguiente.`,
      };
    }
  }

  if (quantity <= 0) {
    await supabase
      .from("basket_items")
      .delete()
      .eq("customer_id", profile.id)
      .eq("slot", slot)
      .eq("product_id", productId);
    refresh();
    return {};
  }

  const { data: product } = await supabase.from("products").select("unit, active").eq("id", productId).maybeSingle();
  if (!product?.active) return { error: "Este producto ya no está disponible." };
  const step = quantityStep(product.unit as ProductUnit);
  const rounded = Math.round(quantity / step) * step;
  if (rounded <= 0 || rounded > 50) return { error: "Esa cantidad no es válida." };

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

/** Pago por envío: pide (o anula) un reparto suelto. Solo hasta su hora de cierre. */
export async function setDeliveryRequest(dayId: string, requested: boolean): Promise<{ error?: string }> {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("frequency, status")
    .eq("customer_id", profile.id)
    .maybeSingle();
  if (sub?.frequency !== "por_envio" || sub.status !== "activa") {
    return { error: "Los repartos sueltos son del plan de pago por envío." };
  }

  const { error } = requested
    ? await supabase.from("delivery_requests").insert({ customer_id: profile.id, delivery_day_id: dayId })
    : await supabase.from("delivery_requests").delete().eq("customer_id", profile.id).eq("delivery_day_id", dayId);
  // RLS solo deja pedir o anular repartos abiertos y antes de su cierre
  if (error && error.code !== "23505") return { error: "Ese reparto ya está cerrado. Elige otro." };
  refresh();
  return {};
}
