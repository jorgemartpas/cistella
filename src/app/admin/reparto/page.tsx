import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmButton, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, PageHeader, PageSkeleton, SectionTitle, cx } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getShops } from "@/lib/catalog";
import { closeDueDeliveryDays } from "@/lib/delivery";
import { addDays, madridDate } from "@/lib/domain/dates";
import { formatEuros } from "@/lib/domain/money";
import { finalTotalCents } from "@/lib/domain/orders";
import { capitalize, formatDay, formatShortDay } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_STATUS, SHOP_ORDER_STATUS } from "@/lib/labels";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { DeliveryDay, Order, OrderItem, Shop, ShopOrder } from "@/lib/types";
import { chargeAgain, markDelivered, markNotDelivered, markShopPickedUp } from "./actions";

export const metadata: Metadata = { title: "Reparto del día" };

type FullOrder = Order & { shop_orders: (ShopOrder & { order_items: OrderItem[] })[] };

export default function DeliveryPage({ searchParams }: PageProps<"/admin/reparto">) {
  return (
    <>
      <PageHeader title="Reparto" subtitle="Recogidas en las tiendas y entregas en casa de los clientes." />
      <Suspense fallback={<PageSkeleton />}>
        <Delivery searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Delivery({ searchParams }: Pick<PageProps<"/admin/reparto">, "searchParams">) {
  await requireRole("admin");
  await closeDueDeliveryDays(createServiceClient());
  const { dia } = await searchParams;
  const supabase = await createClient();
  const today = madridDate(new Date());
  const { data: daysData } = await supabase
    .from("delivery_days")
    .select("*")
    .eq("status", "cerrado")
    .gte("date", addDays(today, -14))
    .order("date");
  const days = (daysData ?? []) as DeliveryDay[];
  const selected = days.find((d) => d.id === dia) ?? days.find((d) => d.date >= today) ?? days.at(-1);

  if (!selected) {
    return (
      <EmptyState icon="🚐" title="No hay repartos con pedidos">
        Cuando cierre el próximo reparto, aquí tendrás las recogidas y las entregas.{" "}
        <Link href="/admin/dias" className="underline">
          Ver días de reparto
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <nav aria-label="Días" className="-mx-4 mb-2 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {days.map((d) => (
            <li key={d.id}>
              <Link
                href={`/admin/reparto?dia=${d.id}`}
                scroll={false}
                aria-current={d.id === selected.id ? "page" : undefined}
                className={cx(
                  "inline-flex whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold first-letter:uppercase",
                  d.id === selected.id ? "bg-text text-bg" : "border border-border bg-surface",
                  d.date === today && d.id !== selected.id && "border-primary text-primary",
                )}
              >
                {d.date === today ? "Hoy" : capitalize(formatShortDay(d.date))}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <DayDelivery day={selected} />
    </>
  );
}

async function DayDelivery({ day }: { day: DeliveryDay }) {
  const supabase = await createClient();
  const [{ data: ordersData }, shops] = await Promise.all([
    supabase.from("orders").select("*, shop_orders(*, order_items(*))").eq("delivery_day_id", day.id).order("address"),
    getShops(supabase),
  ]);
  const orders = (ordersData ?? []) as FullOrder[];
  const shopById = new Map(shops.map((s) => [s.id, s]));
  const parts = orders.flatMap((o) => o.shop_orders);
  const byShop = Map.groupBy(parts, (p) => p.shop_id);
  const delivered = orders.filter((o) => !["pendiente", "preparado", "en_reparto"].includes(o.status)).length;

  return (
    <>
      <div className="mb-1 mt-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{capitalize(formatDay(day.date))}</h2>
        <Badge tone={delivered === orders.length ? "success" : "info"}>
          {delivered}/{orders.length} {orders.length === 1 ? "entrega cerrada" : "entregas cerradas"}
        </Badge>
      </div>

      <SectionTitle>1 · Recogidas</SectionTitle>
      <ul className="space-y-2">
        {[...byShop.entries()].map(([shopId, shopParts]) => (
          <li key={shopId}>
            <PickupCard day={day} shop={shopById.get(shopId)} parts={shopParts} />
          </li>
        ))}
      </ul>

      <SectionTitle>2 · Entregas</SectionTitle>
      {orders.length === 0 ? (
        <p className="text-sm text-muted">Este reparto no tiene pedidos.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <DeliveryCard order={o} shopById={shopById} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PickupCard({ day, shop, parts }: { day: DeliveryDay; shop: Shop | undefined; parts: ShopOrder[] }) {
  const prepared = parts.filter((p) => p.status === "preparado").length;
  const picked = parts.filter((p) => p.status === "recogido").length;
  const allPicked = picked === parts.length;
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{shop?.name ?? "Tienda"}</p>
          {shop?.address && <p className="text-sm text-muted">{shop.address}</p>}
          {shop?.phone && (
            <a href={`tel:${shop.phone}`} className="text-sm text-primary underline">
              {shop.phone}
            </a>
          )}
        </div>
        <Badge tone={allPicked ? "neutral" : prepared + picked === parts.length ? "success" : "warning"}>
          {allPicked ? "Recogido" : `${prepared + picked}/${parts.length} preparados`}
        </Badge>
      </div>
      <p className="text-sm text-muted">
        {parts.length} {parts.length === 1 ? "bolsa" : "bolsas"}: {parts.map((p) => p.customer_label).join(", ")}
      </p>
      {!allPicked && (
        <form action={markShopPickedUp.bind(null, day.id, shop?.id ?? "")}>
          {prepared + picked === parts.length ? (
            <SubmitButton variant="secondary" className="w-full">
              <Icon name="check" /> Recogido en la tienda
            </SubmitButton>
          ) : (
            <ConfirmButton
              className="w-full"
              message="Hay pedidos que la tienda aún no ha marcado como preparados. ¿Marcar todo como recogido igualmente?"
            >
              <Icon name="check" /> Recogido en la tienda
            </ConfirmButton>
          )}
        </form>
      )}
    </Card>
  );
}

function DeliveryCard({ order, shopById }: { order: FullOrder; shopById: Map<string, Shop> }) {
  const status = ORDER_STATUS[order.status];
  const payment = PAYMENT_STATUS[order.payment_status];
  const open = ["pendiente", "preparado", "en_reparto"].includes(order.status);
  const total =
    order.final_total_cents ??
    finalTotalCents(
      order.shop_orders.flatMap((so) =>
        so.order_items.map((i) => ({
          quantityOrdered: Number(i.quantity_ordered),
          quantityActual: i.quantity_actual === null ? null : Number(i.quantity_actual),
          unitPriceCents: i.unit_price_cents,
        })),
      ),
    );
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address}, ${order.postal_code ?? ""} Alzira`)}`;

  return (
    <Card className={cx("space-y-3", !open && "opacity-80")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{order.customer_name}</p>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-start gap-1 text-sm text-primary underline">
            <Icon name="pin" className="mt-0.5 size-4 shrink-0" />
            {order.address}
          </a>
          {order.phone && (
            <a href={`tel:${order.phone}`} className="flex items-center gap-1 text-sm text-primary underline">
              <Icon name="phone" className="size-4" />
              {order.phone}
            </a>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={status.tone}>{status.label}</Badge>
          {!open && <Badge tone={payment.tone}>{payment.label}</Badge>}
        </div>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {order.shop_orders.map((so) => (
          <li key={so.id}>
            <Badge tone={SHOP_ORDER_STATUS[so.status].tone}>
              {shopById.get(so.shop_id)?.name}: {SHOP_ORDER_STATUS[so.status].label.toLowerCase()}
            </Badge>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        {order.payment_status === "pagado" ? "Cobrado" : "A cobrar"}: <strong>{formatEuros(total)}</strong>
        {order.final_total_cents === null && order.estimated_total_cents !== total && (
          <span className="text-muted"> (estimado {formatEuros(order.estimated_total_cents)})</span>
        )}
      </p>
      {order.payment_error && <p className="text-sm text-danger">{order.payment_error}</p>}

      {open ? (
        <div className="grid grid-cols-2 gap-2">
          <form action={markDelivered.bind(null, order.id)}>
            <SubmitButton className="w-full" pendingText="Cobrando…">
              Entregado
            </SubmitButton>
          </form>
          <form action={markNotDelivered.bind(null, order.id)}>
            <ConfirmButton className="w-full" message={`¿${order.customer_name} no estaba? No se le cobrará el pedido.`}>
              No estaba
            </ConfirmButton>
          </form>
        </div>
      ) : (
        ["fallido", "pendiente"].includes(order.payment_status) &&
        order.status !== "cancelado" && (
          <form action={chargeAgain.bind(null, order.id)}>
            {order.status === "no_entregado" ? (
              <ConfirmButton className="w-full" message="¿Cobrar este pedido aunque no se entregó?">
                Cobrar igualmente
              </ConfirmButton>
            ) : (
              <SubmitButton variant="secondary" className="w-full" pendingText="Cobrando…">
                Reintentar cobro
              </SubmitButton>
            )}
          </form>
        )
      )}
    </Card>
  );
}
