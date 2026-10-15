import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getCurrentProfile, HOME_BY_ROLE } from "@/lib/auth";
import { getProducts, getShops } from "@/lib/catalog";
import {
  closingDayFor,
  ensureDeliveryDays,
  getScheduleRules,
  nextDeliveryFor,
  requestableDays,
  skippedDayIds,
  type RequestableDay,
  type UpcomingDelivery,
} from "@/lib/delivery";
import { lineTotalCents } from "@/lib/domain/money";
import type { ScheduleRule } from "@/lib/domain/schedule";
import { rankUsualProducts } from "@/lib/domain/usual";
import { usesDayBaskets, type DeliveryFrequency } from "@/lib/domain/subscription";
import type { TrialState } from "@/lib/domain/trial";
import { readGuestBasket } from "@/lib/guest-basket";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getTrial } from "@/lib/trial";
import type { DeliveryDay, Product, Profile, Settings, Shop, Subscription } from "@/lib/types";

/** Cookie con la cesta que se está llenando en el plan de 2 veces por semana (día de la semana) */
export const BASKET_DAY_COOKIE = "cistella_dia";

export type ClientContext = {
  /** null: visitante sin cuenta (ve la tienda y llena la cesta; la cuenta se crea al confirmar) */
  profile: Profile | null;
  isGuest: boolean;
  sub: Subscription | null;
  settings: Settings | null;
  rules: ScheduleRule[];
  products: Product[];
  shops: Shop[];
  plan: DeliveryFrequency;
  isActive: boolean;
  perDelivery: boolean;
  /** Plan de 2 veces por semana: una cesta para cada día de reparto */
  dayBaskets: boolean;
  weekdays: number[];
  /** Cesta que se ve y se llena: 0 la única, o el día de la semana */
  slot: number;
  /** Productos y cantidades de esa cesta */
  basket: Map<string, number>;
  basketCount: number;
  basketTotalCents: number;
  /** Planes con cuota: próximo reparto de esa cesta */
  next: UpcomingDelivery | null;
  /** Pago por envío: próximos repartos y si los ha pedido */
  requestable: RequestableDay[];
  /** Cesta guardada con envío automático (planes con reparto fijo): los repartos se preparan solos */
  autoBasket: { id: string; name: string } | null;
  /** Reparto que se confirma desde la cesta (con envío automático: que se puede saltar) */
  toConfirm: { day: DeliveryDay; confirmed: boolean; auto: boolean; skipped: boolean } | null;
  /** Reparto del cliente que se está cerrando ahora mismo (la cesta no se toca) */
  closing: DeliveryDay | null;
  /** Productos que la tienda de turno no tiene para el próximo reparto */
  unavailable: Set<string>;
  /** Puede empezar la prueba gratis (visitante, o cliente sin plan que nunca la ha usado) */
  trialOffer: boolean;
  /** Prueba gratis en curso: días y pedidos que le quedan */
  trial: TrialState | null;
};

/** Cliente con sesión: el contexto, o a /entrar si es un visitante. */
export async function getCustomerContext(): Promise<ClientContext & { profile: Profile }> {
  const ctx = await getClientContext();
  if (!ctx.profile) redirect("/entrar");
  return ctx as ClientContext & { profile: Profile };
}

/**
 * Todo lo que necesitan las páginas de la tienda (y la cabecera, con el botón de la cesta),
 * cargado una vez por petición. Sirve también para visitantes sin cuenta.
 */
export const getClientContext = cache(async (): Promise<ClientContext> => {
  const profile = await getCurrentProfile();
  if (profile && profile.role !== "cliente") redirect(HOME_BY_ROLE[profile.role]);
  const supabase = await createClient();
  const now = new Date();

  const [{ data: sub }, products, shops, rules, { data: basketRows }, { data: settings }, cookieStore] =
    await Promise.all([
      profile
        ? supabase.from("subscriptions").select("*").eq("customer_id", profile.id).maybeSingle<Subscription>()
        : Promise.resolve({ data: null }),
      getProducts(supabase, { onlyActive: true }),
      getShops(supabase),
      getScheduleRules(supabase),
      profile
        ? supabase.from("basket_items").select("product_id, quantity, slot").eq("customer_id", profile.id)
        : readGuestBasket().then((guest) => ({
            data: [...guest].map(([product_id, quantity]) => ({ product_id, quantity, slot: 0 })),
          })),
      supabase.from("settings").select("*").single<Settings>(),
      cookies(),
    ]);

  const plan = sub?.frequency ?? "semanal";
  const isActive = sub?.status === "activa";
  const perDelivery = plan === "por_envio";
  const { data: autoRow } = profile
    ? await supabase
        .from("saved_lists")
        .select("id, name")
        .eq("customer_id", profile.id)
        .eq("auto_delivery", true)
        .maybeSingle<{ id: string; name: string }>()
    : { data: null };
  const auto = Boolean(autoRow) && !perDelivery;
  const dayBaskets = usesDayBaskets(plan);
  const weekdays = rules.filter((r) => r.active).map((r) => r.weekday);
  const chosenDay = Number(cookieStore.get(BASKET_DAY_COOKIE)?.value);
  const slot = dayBaskets ? (weekdays.includes(chosenDay) ? chosenDay : (weekdays[0] ?? 0)) : 0;

  let next: UpcomingDelivery | null = null;
  let requestable: RequestableDay[] = [];
  if (profile && isActive && perDelivery) {
    requestable = await requestableDays(supabase, profile.id, now);
    if (requestable.length === 0) {
      await ensureDeliveryDays(createServiceClient(), now);
      requestable = await requestableDays(supabase, profile.id, now);
    }
  } else if (profile && sub && isActive) {
    next = await nextDeliveryFor(supabase, sub, now, dayBaskets ? slot : undefined);
    // Para poder confirmarlo, el día de reparto tiene que existir
    if (next && !next.day) {
      await ensureDeliveryDays(createServiceClient(), now, next.date);
      next = await nextDeliveryFor(supabase, sub, now, dayBaskets ? slot : undefined);
    }
  }
  const closing = isActive && sub ? await closingDayFor(supabase, sub, now, auto) : null;
  const nextSkipped =
    auto && profile && next?.day ? (await skippedDayIds(supabase, profile.id, [next.day.id])).has(next.day.id) : false;

  const firstRequested = requestable.find((r) => r.requested);
  // En pago por envío se confirma el primero pedido (o el primero abierto, para pedirlo)
  const firstRequestable = firstRequested ?? requestable[0];
  const toConfirm = !isActive
    ? null
    : perDelivery
      ? firstRequestable
        ? { day: firstRequestable.day, confirmed: firstRequestable.requested, auto: false, skipped: false }
        : null
      : next?.day
        ? { day: next.day, confirmed: next.confirmed || (auto && !nextSkipped), auto, skipped: nextSkipped }
        : null;

  const upcomingDay = next?.day ?? firstRequested?.day ?? null;
  const { data: unavailableIds } = upcomingDay
    ? await supabase.rpc("unavailable_on_day", { p_day_id: upcomingDay.id })
    : { data: [] };

  const subscribed = Boolean(sub && ["activa", "pausada", "impagada"].includes(sub.status));
  const trial = sub?.status === "activa" ? await getTrial(supabase, sub, now) : null;

  const basket = new Map(
    (basketRows ?? []).filter((b) => b.slot === slot).map((b) => [b.product_id as string, Number(b.quantity)]),
  );
  const productById = new Map(products.map((p) => [p.id, p]));
  const inBasket = [...basket.entries()].filter(([id]) => productById.has(id));

  return {
    profile,
    isGuest: !profile,
    sub: sub ?? null,
    settings: settings ?? null,
    rules,
    products,
    shops,
    plan,
    isActive,
    perDelivery,
    dayBaskets,
    weekdays,
    slot,
    basket,
    basketCount: inBasket.length,
    basketTotalCents: inBasket.reduce((sum, [id, q]) => sum + lineTotalCents(q, productById.get(id)!.price_cents), 0),
    next,
    requestable,
    autoBasket: autoRow ?? null,
    toConfirm,
    closing,
    unavailable: new Set<string>((unavailableIds as string[] | null) ?? []),
    trialOffer: !subscribed && !sub?.trial_started_at,
    trial,
  };
});

export type ListMembership = {
  /** Listas (no cestas) del cliente, la última tocada primero */
  lists: { id: string; name: string }[];
  /** En qué listas está cada producto */
  byProduct: Map<string, string[]>;
};

/** Listas del cliente y qué productos hay en cada una (para el botón de guardar en lista). */
export const getListMembership = cache(async (): Promise<ListMembership> => {
  const profile = await getCurrentProfile();
  if (profile?.role !== "cliente") return { lists: [], byProduct: new Map() };
  const supabase = await createClient();
  const { data: lists } = await supabase
    .from("saved_lists")
    .select("id, name")
    .eq("customer_id", profile.id)
    .eq("kind", "lista")
    .order("updated_at", { ascending: false });
  const ids = (lists ?? []).map((l) => l.id as string);
  const { data: items } = ids.length
    ? await supabase.from("saved_list_items").select("list_id, product_id").in("list_id", ids)
    : { data: [] };
  const byProduct = new Map<string, string[]>();
  for (const item of (items ?? []) as { list_id: string; product_id: string }[]) {
    byProduct.set(item.product_id, [...(byProduct.get(item.product_id) ?? []), item.list_id]);
  }
  return { lists: (lists ?? []) as { id: string; name: string }[], byProduct };
});

/** «Mis habituales»: lo que más ha pedido el cliente en sus pedidos entregados (si no hay, ninguno). */
export const getUsualProductIds = cache(async (): Promise<string[]> => {
  const profile = await getCurrentProfile();
  if (profile?.role !== "cliente") return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("shop_orders(order_items(product_id, quantity_ordered, quantity_actual))")
    .eq("customer_id", profile.id)
    .eq("status", "entregado")
    .order("created_at", { ascending: false })
    .limit(30);
  type Row = {
    shop_orders: {
      order_items: { product_id: string | null; quantity_ordered: number; quantity_actual: number | null }[];
    }[];
  };
  return rankUsualProducts(
    ((data ?? []) as Row[]).map((order) => ({
      items: order.shop_orders.flatMap((so) =>
        so.order_items.map((i) => ({
          productId: i.product_id,
          quantity: Number(i.quantity_actual ?? i.quantity_ordered),
        })),
      ),
    })),
  );
});
