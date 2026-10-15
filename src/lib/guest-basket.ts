import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getScheduleRules } from "@/lib/delivery";
import { parseGuestBasket, updateGuestBasket } from "@/lib/domain/guest-basket";
import { normalizeQuantity, type ProductUnit } from "@/lib/domain/money";
import { usesDayBaskets } from "@/lib/domain/subscription";

/** Cookie con la cesta del visitante que aún no tiene cuenta */
const COOKIE = "cistella_cesta";
const COOKIE_OPTIONS = { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" as const, httpOnly: true };

export async function readGuestBasket(): Promise<Map<string, number>> {
  return parseGuestBasket((await cookies()).get(COOKIE)?.value);
}

/** Cambia la cantidad de un producto en la cesta del visitante (solo en Server Actions). */
export async function setGuestBasketQuantity(productId: string, quantity: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, updateGuestBasket(parseGuestBasket(store.get(COOKIE)?.value), productId, quantity), COOKIE_OPTIONS);
}

/**
 * Al crear la cuenta o entrar: lleva la cesta del visitante a la del cliente (lo que ya tuviera
 * se mantiene; si un producto está en las dos, manda la cantidad del visitante) y borra la cookie.
 * Solo en Server Actions o rutas, con el cliente de Supabase ya con la sesión del usuario.
 */
export async function moveGuestBasketToAccount(supabase: SupabaseClient, userId: string): Promise<void> {
  const store = await cookies();
  const basket = parseGuestBasket(store.get(COOKIE)?.value);
  if (basket.size === 0) return;
  store.delete(COOKIE);

  const [{ data: profile }, { data: sub }, { data: products }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase.from("subscriptions").select("frequency").eq("customer_id", userId).maybeSingle(),
    supabase.from("products").select("id, unit").eq("active", true).in("id", [...basket.keys()]),
  ]);
  if (profile?.role !== "cliente" || !products?.length) return;

  // En el plan de 2 veces por semana va a la cesta del primer día de reparto
  let slot = 0;
  if (sub && usesDayBaskets(sub.frequency)) {
    slot = (await getScheduleRules(supabase)).find((r) => r.active)?.weekday ?? 0;
  }
  await supabase.from("basket_items").upsert(
    products.map((p) => ({
      customer_id: userId,
      slot,
      product_id: p.id,
      quantity: normalizeQuantity(basket.get(p.id)!, p.unit as ProductUnit),
    })),
    { onConflict: "customer_id,slot,product_id" },
  );
}
