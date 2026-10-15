import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, Input, Notice, PageSkeleton, SectionTitle, cx } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { closeDueDeliveryDays } from "@/lib/delivery";
import { addDays, madridDate } from "@/lib/domain/dates";
import { formatQuantity } from "@/lib/domain/money";
import { SHOP_TYPE_LABELS } from "@/lib/domain/orders";
import { capitalize, formatCutoff, formatDay, formatShortDay } from "@/lib/format";
import { SHOP_ORDER_STATUS } from "@/lib/labels";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { DeliveryDay, OrderItem, Shop, ShopOrder } from "@/lib/types";
import { prepareShopOrder, reopenShopOrder } from "./actions";

export const metadata: Metadata = { title: "Pedidos de la tienda" };

type Part = ShopOrder & { order_items: OrderItem[] };

export default function ShopOrdersPage({ searchParams }: PageProps<"/tienda">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopOrders searchParams={searchParams} />
    </Suspense>
  );
}

async function ShopOrders({ searchParams }: Pick<PageProps<"/tienda">, "searchParams">) {
  const { shopId } = await requireShop();
  // Si ya ha pasado la hora de cierre y el cron no ha corrido, se generan ahora
  await closeDueDeliveryDays(createServiceClient());

  const { dia } = await searchParams;
  const supabase = await createClient();
  const today = madridDate(new Date());
  const [{ data: shop }, { data: daysData }] = await Promise.all([
    supabase.from("shops").select("*").eq("id", shopId).single<Shop>(),
    supabase.from("delivery_days").select("*").gte("date", addDays(today, -21)).neq("status", "cancelado").order("date"),
  ]);
  if (!shop) return null;
  const days = (daysData ?? []) as DeliveryDay[];

  const closedIds = days.filter((d) => d.status === "cerrado").map((d) => d.id);
  const { data: partsData } = await supabase
    .from("shop_orders")
    .select("delivery_day_id, status")
    .in("delivery_day_id", closedIds);
  const countByDay = new Map<string, { total: number; done: number }>();
  for (const p of partsData ?? []) {
    const c = countByDay.get(p.delivery_day_id) ?? { total: 0, done: 0 };
    c.total += 1;
    if (p.status !== "pendiente") c.done += 1;
    countByDay.set(p.delivery_day_id, c);
  }
  const daysWithOrders = days.filter((d) => countByDay.has(d.id));
  const selected =
    daysWithOrders.find((d) => d.id === dia) ??
    daysWithOrders.find((d) => d.date >= today && countByDay.get(d.id)!.done < countByDay.get(d.id)!.total) ??
    daysWithOrders.find((d) => d.date >= today) ??
    daysWithOrders.at(-1);

  const isOnDuty = (d: DeliveryDay) =>
    shop.type === "carniceria" || d.fruteria_id === shop.id || d.pescaderia_id === shop.id;
  const nextOpen = days.find((d) => d.status === "abierto" && d.date >= today && isOnDuty(d));

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{shop.name}</h1>
      <p className="mb-4 text-muted">{SHOP_TYPE_LABELS[shop.type]}</p>

      {nextOpen && (
        <Notice tone="info">
          Próximo reparto: <strong>{formatDay(nextOpen.date)}</strong>. Los pedidos se cierran el{" "}
          {formatCutoff(nextOpen.cutoff_at)} y entonces aparecen aquí.
        </Notice>
      )}

      {daysWithOrders.length === 0 || !selected ? (
        <div className="mt-6">
          <EmptyState icon="🧺" title="No tienes pedidos por preparar">
            Cuando cierre un reparto en el que te toque, verás aquí lo que tienes que preparar.
          </EmptyState>
        </div>
      ) : (
        <>
          <nav aria-label="Días de reparto" className="-mx-4 mt-5 overflow-x-auto px-4">
            <ul className="flex gap-2">
              {daysWithOrders.map((d) => {
                const c = countByDay.get(d.id)!;
                return (
                  <li key={d.id}>
                    <Link
                      href={`/tienda?dia=${d.id}`}
                      scroll={false}
                      aria-current={d.id === selected.id ? "page" : undefined}
                      className={cx(
                        "inline-flex flex-col whitespace-nowrap rounded-lg px-4 py-2 text-sm",
                        d.id === selected.id ? "bg-text text-bg" : "border border-border bg-surface",
                      )}
                    >
                      <span className="font-semibold first-letter:uppercase">{formatShortDay(d.date)}</span>
                      <span className={d.id === selected.id ? "opacity-80" : "text-muted"}>
                        {c.done}/{c.total} listos
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <DayParts day={selected} />
        </>
      )}
    </>
  );
}

async function DayParts({ day }: { day: DeliveryDay }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_orders")
    .select("*, order_items(*)")
    .eq("delivery_day_id", day.id)
    .order("customer_label");
  const parts = (data ?? []) as Part[];
  const done = parts.filter((p) => p.status !== "pendiente").length;

  // Lista de preparación: lo que hay que sacar en total de cada producto
  const totals = new Map<string, { name: string; unit: OrderItem["unit"]; quantity: number; customers: number }>();
  for (const item of parts.flatMap((p) => p.order_items)) {
    const key = `${item.product_name}|${item.unit}`;
    const t = totals.get(key) ?? { name: item.product_name, unit: item.unit, quantity: 0, customers: 0 };
    t.quantity += Number(item.quantity_ordered);
    t.customers += 1;
    totals.set(key, t);
  }

  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{capitalize(formatDay(day.date))}</h2>
        <Badge tone={done === parts.length ? "success" : "warning"}>
          {done}/{parts.length} preparados
        </Badge>
      </div>

      <SectionTitle>Lista de preparación</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {[...totals.values()]
          .sort((a, b) => a.name.localeCompare(b.name, "es"))
          .map((t) => (
            <div key={`${t.name}|${t.unit}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span>{t.name}</span>
              <span className="text-right font-semibold tabular-nums">
                {formatQuantity(Math.round(t.quantity * 1000) / 1000, t.unit)}
                <span className="block text-xs font-normal text-muted">
                  {t.customers} {t.customers === 1 ? "cliente" : "clientes"}
                </span>
              </span>
            </div>
          ))}
      </Card>

      <SectionTitle>Por cliente</SectionTitle>
      <ul className="space-y-3">
        {parts.map((part) => (
          <li key={part.id}>
            <PartCard part={part} />
          </li>
        ))}
      </ul>
    </>
  );
}

function PartCard({ part }: { part: Part }) {
  const status = SHOP_ORDER_STATUS[part.status];
  const header = (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="font-semibold">{part.customer_label}</p>
      <Badge tone={status.tone}>{status.label}</Badge>
    </div>
  );

  if (part.status !== "pendiente") {
    return (
      <Card>
        {header}
        <ul className="space-y-1 text-sm">
          {part.order_items.map((item) => {
            const ordered = Number(item.quantity_ordered);
            const actual = item.quantity_actual === null ? null : Number(item.quantity_actual);
            return (
              <li key={item.id} className="flex justify-between gap-3">
                <span>{item.product_name}</span>
                <span className="tabular-nums">
                  {formatQuantity(actual ?? ordered, item.unit)}
                  {actual !== null && actual !== ordered && (
                    <span className="text-muted"> (pedido {formatQuantity(ordered, item.unit)})</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {part.status === "preparado" && (
          <form action={reopenShopOrder.bind(null, part.id)} className="mt-3">
            <SubmitButton variant="ghost" className="w-full min-h-10 py-2 text-sm">
              Corregir
            </SubmitButton>
          </form>
        )}
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <ActionForm action={prepareShopOrder} className="space-y-3">
        <input type="hidden" name="shop_order_id" value={part.id} />
        {part.order_items.map((item) => {
          const ordered = Number(item.quantity_ordered);
          return (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium leading-tight">{item.product_name}</p>
                <p className="text-sm text-muted">Pedido: {formatQuantity(ordered, item.unit)}</p>
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-sm">
                <span className="text-xs text-muted">Real</span>
                <Input
                  name={`real_${item.id}`}
                  inputMode="decimal"
                  placeholder={String(ordered).replace(".", ",")}
                  defaultValue={item.quantity_actual === null ? "" : String(item.quantity_actual).replace(".", ",")}
                  className="w-20 px-2.5 py-2 text-right"
                  aria-label={`Cantidad real de ${item.product_name} (${item.unit})`}
                />
                <span className="w-9 text-xs text-muted">{item.unit === "kg" ? "kg" : item.unit === "unidad" ? "ud." : "band."}</span>
              </label>
            </div>
          );
        })}
        <p className="text-xs text-muted">Deja «Real» vacío si coincide con lo pedido.</p>
        <SubmitButton className="w-full" pendingText="Guardando…">
          Marcar preparado
        </SubmitButton>
      </ActionForm>
    </Card>
  );
}
