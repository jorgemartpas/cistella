import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoWeekday, madridDate, type ISODate } from "@/lib/domain/dates";
import { planOrdersForDay, type PlannedOrder, type ProductCategory } from "@/lib/domain/orders";
import { nextInRotation, rotationQueue } from "@/lib/domain/rotation";
import { upcomingDeliveryDates, type ScheduleRule } from "@/lib/domain/schedule";
import { isDueOn, type SubscriptionCadence } from "@/lib/domain/subscription";
import type { DeliveryDay, DeliveryScheduleRow, GenerationReport, Shop, Subscription } from "@/lib/types";

export async function getScheduleRules(supabase: SupabaseClient): Promise<ScheduleRule[]> {
  const { data, error } = await supabase.from("delivery_schedule").select("*").order("weekday");
  if (error) throw error;
  return (data as DeliveryScheduleRow[]).map((r) => ({
    weekday: r.weekday,
    active: r.active,
    cutoffDaysBefore: r.cutoff_days_before,
    cutoffTime: r.cutoff_time.slice(0, 5),
  }));
}

export function toCadence(sub: Pick<Subscription, "status" | "frequency" | "delivery_weekday" | "anchor_date">): SubscriptionCadence {
  return {
    status: sub.status,
    frequency: sub.frequency,
    deliveryWeekday: sub.delivery_weekday,
    anchorDate: sub.anchor_date,
  };
}

export type UpcomingDelivery = {
  date: ISODate;
  cutoffAt: Date;
  /** Día ya generado en delivery_days (con su tienda de turno), si existe */
  day: DeliveryDay | null;
};

/**
 * Próximo reparto que le toca a una suscripción y que aún admite cambios. Usa los días ya
 * generados (respeta los cancelados y los cierres editados) y, si aún no existen, el calendario.
 */
export async function nextDeliveryFor(
  supabase: SupabaseClient,
  sub: Pick<Subscription, "status" | "frequency" | "delivery_weekday" | "anchor_date">,
  now: Date,
): Promise<UpcomingDelivery | null> {
  const cadence = toCadence({ ...sub, status: "activa" });
  const today = madridDate(now);
  const [rules, { data: days }] = await Promise.all([
    getScheduleRules(supabase),
    supabase.from("delivery_days").select("*").gte("date", today).order("date"),
  ]);
  const byDate = new Map((days as DeliveryDay[] | null ?? []).map((d) => [d.date, d]));
  const candidates = upcomingDeliveryDates(rules, today, 7 * 9, now);
  for (const c of candidates) {
    if (!isDueOn(cadence, c.date)) continue;
    const day = byDate.get(c.date) ?? null;
    if (day) {
      if (day.status !== "abierto" || new Date(day.cutoff_at) <= now) continue;
      return { date: day.date, cutoffAt: new Date(day.cutoff_at), day };
    }
    return { date: c.date, cutoffAt: c.cutoffAt, day: null };
  }
  return null;
}

/**
 * ¿Se está cerrando ahora mismo un reparto de este cliente? Pasa entre la hora de cierre y
 * la generación de pedidos (el cron corre poco después). Mientras tanto la cesta no se toca.
 */
export async function closingDayFor(
  supabase: SupabaseClient,
  sub: Pick<Subscription, "status" | "frequency" | "delivery_weekday" | "anchor_date">,
  now: Date,
): Promise<DeliveryDay | null> {
  const { data } = await supabase
    .from("delivery_days")
    .select("*")
    .eq("status", "abierto")
    .is("orders_generated_at", null)
    .lte("cutoff_at", now.toISOString());
  return ((data as DeliveryDay[] | null) ?? []).find((d) => isDueOn(toCadence(sub), d.date)) ?? null;
}

/**
 * Crea los días de reparto de las próximas semanas según el calendario y les asigna la
 * tienda de turno, alternando a partir del último día ya asignado. Devuelve cuántos crea.
 */
export async function ensureDeliveryDays(service: SupabaseClient, now = new Date()): Promise<number> {
  const today = madridDate(now);
  const [rules, { data: settings }, { data: shopsData }] = await Promise.all([
    getScheduleRules(service),
    service.from("settings").select("weeks_ahead").single(),
    service.from("shops").select("*"),
  ]);
  const planned = upcomingDeliveryDates(rules, today, (settings?.weeks_ahead ?? 4) * 7, now);
  if (planned.length === 0) return 0;

  const { data: existingData } = await service
    .from("delivery_days")
    .select("date, fruteria_id, pescaderia_id")
    .gte("date", addDays(planned[0].date, -90))
    .order("date");
  const existing = (existingData ?? []) as Pick<DeliveryDay, "date" | "fruteria_id" | "pescaderia_id">[];
  const existingDates = new Set(existing.map((d) => d.date));
  const missing = planned.filter((p) => !existingDates.has(p.date));
  if (missing.length === 0) return 0;

  const shops = (shopsData ?? []) as Shop[];
  const queue = (type: Shop["type"]) =>
    rotationQueue(
      shops.filter((s) => s.type === type).map((s) => ({ id: s.id, name: s.name, active: s.active, rotationOrder: s.rotation_order })),
    );
  const fruteriaQueue = queue("fruteria");
  const pescaderiaQueue = queue("pescaderia");

  // Línea temporal con los días existentes y los nuevos, para continuar la alternancia
  const timeline = [...existing];
  const rows = [];
  for (const p of missing) {
    const before = timeline.filter((d) => d.date < p.date);
    const lastWith = (key: "fruteria_id" | "pescaderia_id") =>
      [...before].reverse().find((d) => d[key] !== null)?.[key] ?? null;
    const row = {
      date: p.date,
      cutoff_at: p.cutoffAt.toISOString(),
      fruteria_id: nextInRotation(fruteriaQueue, lastWith("fruteria_id")),
      pescaderia_id: nextInRotation(pescaderiaQueue, lastWith("pescaderia_id")),
    };
    rows.push(row);
    timeline.push(row);
    timeline.sort((a, b) => a.date.localeCompare(b.date));
  }

  const { error } = await service.from("delivery_days").upsert(rows, { onConflict: "date", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

export type CloseResult = { date: ISODate; orders: number; skipped: number };

/** Cierra un día de reparto: convierte las cestas en pedidos por tienda (idempotente). */
export async function closeDeliveryDay(service: SupabaseClient, dayId: string): Promise<CloseResult | null> {
  const { data: day } = await service.from("delivery_days").select("*").eq("id", dayId).single<DeliveryDay>();
  if (!day || day.status !== "abierto" || day.orders_generated_at) return null;

  const { data: subsData, error: subsError } = await service
    .from("subscriptions")
    .select("customer_id, status, frequency, delivery_weekday, anchor_date")
    .eq("status", "activa")
    .eq("delivery_weekday", isoWeekday(day.date));
  if (subsError) throw subsError;
  const subs = (subsData ?? []).filter((s) => isDueOn(toCadence(s), day.date));
  const customerIds = subs.map((s) => s.customer_id);

  const [profiles, basket, shops, availability, settings] = await Promise.all([
    customerIds.length
      ? service.from("profiles").select("id, full_name, phone, address, postal_code").in("id", customerIds)
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? service.from("basket_items").select("customer_id, product_id, quantity").in("customer_id", customerIds)
      : Promise.resolve({ data: [] }),
    service.from("shops").select("id, active"),
    service
      .from("shop_availability")
      .select("shop_id, product_id, available")
      .in("shop_id", [day.fruteria_id, day.pescaderia_id].filter((id): id is string => Boolean(id))),
    service.from("settings").select("min_order_cents").single(),
  ]);

  const basketRows = (basket.data ?? []) as { customer_id: string; product_id: string; quantity: number }[];
  const productIds = [...new Set(basketRows.map((b) => b.product_id))];
  const { data: productsData } = productIds.length
    ? await service.from("products").select("id, name, category, shop_id, unit, price_cents, active").in("id", productIds)
    : { data: [] };

  const profileById = new Map(((profiles.data ?? []) as { id: string; full_name: string; phone: string | null; address: string | null; postal_code: string | null }[]).map((p) => [p.id, p]));

  const plan = planOrdersForDay({
    day: { id: day.id, date: day.date, fruteriaId: day.fruteria_id, pescaderiaId: day.pescaderia_id },
    customers: subs.map((s) => {
      const p = profileById.get(s.customer_id);
      return {
        customerId: s.customer_id,
        name: p?.full_name || "Cliente",
        phone: p?.phone ?? null,
        address: p?.address ?? null,
        postalCode: p?.postal_code ?? null,
        subscription: toCadence(s),
      };
    }),
    basket: basketRows.map((b) => ({ customerId: b.customer_id, productId: b.product_id, quantity: Number(b.quantity) })),
    products: ((productsData ?? []) as { id: string; name: string; category: ProductCategory; shop_id: string | null; unit: "kg" | "unidad" | "bandeja"; price_cents: number; active: boolean }[]).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      shopId: p.shop_id,
      unit: p.unit,
      priceCents: p.price_cents,
      active: p.active,
    })),
    availability: ((availability.data ?? []) as { shop_id: string; product_id: string; available: boolean }[]).map((a) => ({
      shopId: a.shop_id,
      productId: a.product_id,
      available: a.available,
    })),
    activeShopIds: ((shops.data ?? []) as { id: string; active: boolean }[]).filter((s) => s.active).map((s) => s.id),
    minOrderCents: settings.data?.min_order_cents ?? 0,
  });

  const report: GenerationReport = {
    orders: plan.orders.length,
    skippedCustomers: plan.skippedCustomers.map((s) => ({
      ...s,
      name: profileById.get(s.customerId)?.full_name || "Cliente",
    })),
  };

  const { data: created, error } = await service.rpc("create_orders_for_day", {
    p_day_id: day.id,
    p_orders: plan.orders.map(toOrderPayload),
    p_report: report,
  });
  if (error) throw error;
  return { date: day.date, orders: Number(created ?? 0), skipped: plan.skippedCustomers.length };
}

function toOrderPayload(o: PlannedOrder) {
  return {
    customer_id: o.customerId,
    customer_name: o.customerName,
    phone: o.phone,
    address: o.address,
    postal_code: o.postalCode,
    estimated_total_cents: o.estimatedTotalCents,
    skipped_items: o.skippedItems,
    shops: o.shops.map((s) => ({
      shop_id: s.shopId,
      items: s.items.map((i) => ({
        product_id: i.productId,
        product_name: i.productName,
        unit: i.unit,
        quantity: i.quantity,
        unit_price_cents: i.unitPriceCents,
      })),
    })),
  };
}

/** Cierra todos los días cuya hora de cierre ya ha pasado. Lo llama el cron. */
export async function closeDueDeliveryDays(service: SupabaseClient, now = new Date()): Promise<CloseResult[]> {
  const { data } = await service
    .from("delivery_days")
    .select("id")
    .eq("status", "abierto")
    .is("orders_generated_at", null)
    .lte("cutoff_at", now.toISOString())
    .order("date");
  const results: CloseResult[] = [];
  for (const { id } of data ?? []) {
    const result = await closeDeliveryDay(service, id);
    if (result) results.push(result);
  }
  return results;
}
