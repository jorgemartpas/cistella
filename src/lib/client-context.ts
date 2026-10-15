import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { requireRole } from "@/lib/auth";
import { getProducts, getShops } from "@/lib/catalog";
import {
  closingDayFor,
  ensureDeliveryDays,
  getScheduleRules,
  nextDeliveryFor,
  requestableDays,
  type RequestableDay,
  type UpcomingDelivery,
} from "@/lib/delivery";
import { lineTotalCents } from "@/lib/domain/money";
import type { ScheduleRule } from "@/lib/domain/schedule";
import { usesDayBaskets, type DeliveryFrequency } from "@/lib/domain/subscription";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { DeliveryDay, Product, Profile, Settings, Shop, Subscription } from "@/lib/types";

/** Cookie con la cesta que se está llenando en el plan de 2 veces por semana (día de la semana) */
export const BASKET_DAY_COOKIE = "cistella_dia";

export type ClientContext = {
  profile: Profile;
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
  /** Reparto que se confirma desde la cesta */
  toConfirm: { day: DeliveryDay; confirmed: boolean } | null;
  /** Reparto del cliente que se está cerrando ahora mismo (la cesta no se toca) */
  closing: DeliveryDay | null;
  /** Productos que la tienda de turno no tiene para el próximo reparto */
  unavailable: Set<string>;
};

/**
 * Todo lo que necesitan las páginas del cliente (y la cabecera, con el botón de la cesta),
 * cargado una vez por petición.
 */
export const getClientContext = cache(async (): Promise<ClientContext> => {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const now = new Date();

  const [{ data: sub }, products, shops, rules, { data: basketRows }, { data: settings }, cookieStore] =
    await Promise.all([
      supabase.from("subscriptions").select("*").eq("customer_id", profile.id).maybeSingle<Subscription>(),
      getProducts(supabase, { onlyActive: true }),
      getShops(supabase),
      getScheduleRules(supabase),
      supabase.from("basket_items").select("product_id, quantity, slot").eq("customer_id", profile.id),
      supabase.from("settings").select("*").single<Settings>(),
      cookies(),
    ]);

  const plan = sub?.frequency ?? "semanal";
  const isActive = sub?.status === "activa";
  const perDelivery = plan === "por_envio";
  const dayBaskets = usesDayBaskets(plan);
  const weekdays = rules.filter((r) => r.active).map((r) => r.weekday);
  const chosenDay = Number(cookieStore.get(BASKET_DAY_COOKIE)?.value);
  const slot = dayBaskets ? (weekdays.includes(chosenDay) ? chosenDay : (weekdays[0] ?? 0)) : 0;

  let next: UpcomingDelivery | null = null;
  let requestable: RequestableDay[] = [];
  if (isActive && perDelivery) {
    requestable = await requestableDays(supabase, profile.id, now);
    if (requestable.length === 0) {
      await ensureDeliveryDays(createServiceClient(), now);
      requestable = await requestableDays(supabase, profile.id, now);
    }
  } else if (isActive) {
    next = await nextDeliveryFor(supabase, sub, now, dayBaskets ? slot : undefined);
    // Para poder confirmarlo, el día de reparto tiene que existir
    if (next && !next.day) {
      await ensureDeliveryDays(createServiceClient(), now, next.date);
      next = await nextDeliveryFor(supabase, sub, now, dayBaskets ? slot : undefined);
    }
  }
  const closing = isActive && sub ? await closingDayFor(supabase, sub, now) : null;

  const firstRequested = requestable.find((r) => r.requested);
  // En pago por envío se confirma el primero pedido (o el primero abierto, para pedirlo)
  const firstRequestable = firstRequested ?? requestable[0];
  const toConfirm = !isActive
    ? null
    : perDelivery
      ? firstRequestable
        ? { day: firstRequestable.day, confirmed: firstRequestable.requested }
        : null
      : next?.day
        ? { day: next.day, confirmed: next.confirmed }
        : null;

  const upcomingDay = next?.day ?? firstRequested?.day ?? null;
  const { data: unavailableIds } = upcomingDay
    ? await supabase.rpc("unavailable_on_day", { p_day_id: upcomingDay.id })
    : { data: [] };

  const basket = new Map(
    (basketRows ?? []).filter((b) => b.slot === slot).map((b) => [b.product_id as string, Number(b.quantity)]),
  );
  const productById = new Map(products.map((p) => [p.id, p]));
  const inBasket = [...basket.entries()].filter(([id]) => productById.has(id));

  return {
    profile,
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
    toConfirm,
    closing,
    unavailable: new Set<string>((unavailableIds as string[] | null) ?? []),
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
  const profile = await requireRole("cliente");
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

/** «Mis habituales»: productos que más ha pedido el cliente, del más al menos pedido. */
export const getUsualProductIds = cache(async (): Promise<string[]> => {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("status, shop_orders(order_items(product_id))")
    .eq("customer_id", profile.id)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(30);
  const timesOrdered = new Map<string, number>();
  for (const order of (data ?? []) as { shop_orders: { order_items: { product_id: string | null }[] }[] }[]) {
    const inOrder = new Set(order.shop_orders.flatMap((so) => so.order_items.map((i) => i.product_id)));
    for (const id of inOrder) if (id) timesOrdered.set(id, (timesOrdered.get(id) ?? 0) + 1);
  }
  return [...timesOrdered.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
});
