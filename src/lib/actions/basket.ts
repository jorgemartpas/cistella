"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import { closingDayFor } from "@/lib/delivery";
import { quantityStep, type ProductUnit } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/lib/types";

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Cambia la cantidad de un producto en la cesta recurrente (0 lo quita). Mientras se cierra
 * un reparto del cliente (entre la hora de cierre y la generación de pedidos) no se puede tocar.
 */
export async function setBasketQuantity(productId: string, quantity: number): Promise<{ error?: string }> {
  const profile = await requireRole("cliente");
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("customer_id", profile.id)
    .maybeSingle<Subscription>();
  if (sub?.status === "activa") {
    const closing = await closingDayFor(supabase, sub, new Date());
    if (closing) {
      return {
        error: `Estamos cerrando el reparto del ${DATE_FORMAT.format(new Date(closing.date))}. En unos minutos podrás cambiar la cesta para el siguiente.`,
      };
    }
  }

  if (quantity <= 0) {
    await supabase.from("basket_items").delete().eq("customer_id", profile.id).eq("product_id", productId);
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
    .upsert({ customer_id: profile.id, product_id: productId, quantity: rounded }, { onConflict: "customer_id,product_id" });
  if (error) return { error: "No se ha podido guardar el cambio. Inténtalo de nuevo." };
  refresh();
  return {};
}
