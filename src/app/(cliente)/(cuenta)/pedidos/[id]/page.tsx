import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Badge, Card, Notice, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatEuros, formatQuantity, lineTotalCents } from "@/lib/domain/money";
import { finalTotalCents } from "@/lib/domain/orders";
import { capitalize, formatDay } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_STATUS, SKIP_REASONS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, ShopOrder } from "@/lib/types";

export const metadata: Metadata = { title: "Pedido" };

type Detail = Order & {
  delivery_days: { date: string };
  shop_orders: (ShopOrder & { shops: { name: string }; order_items: OrderItem[] })[];
};

export default function OrderPage({ params }: PageProps<"/pedidos/[id]">) {
  return (
    <>
      <BackLink href="/pedidos">Mis pedidos</BackLink>
      <Suspense fallback={<PageSkeleton />}>
        <OrderDetail params={params} />
      </Suspense>
    </>
  );
}

async function OrderDetail({ params }: Pick<PageProps<"/pedidos/[id]">, "params">) {
  const profile = await requireRole("cliente");
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*, delivery_days(date), shop_orders(*, shops(name), order_items(*))")
    .eq("id", id)
    .eq("customer_id", profile.id)
    .maybeSingle<Detail>();
  if (!order) notFound();

  const status = ORDER_STATUS[order.status];
  const items = order.shop_orders.flatMap((so) => so.order_items);
  const current = finalTotalCents(
    items.map((i) => ({
      quantityOrdered: Number(i.quantity_ordered),
      quantityActual: i.quantity_actual === null ? null : Number(i.quantity_actual),
      unitPriceCents: i.unit_price_cents,
    })),
  );
  const total = order.final_total_cents ?? current + order.delivery_fee_cents;

  return (
    <>
      <PageHeader
        title={capitalize(formatDay(order.delivery_days.date))}
        subtitle={
          <span className="flex flex-wrap gap-1.5">
            <Badge tone={status.tone}>{status.label}</Badge>
            {order.status === "entregado" && (
              <Badge tone={PAYMENT_STATUS[order.payment_status].tone}>{PAYMENT_STATUS[order.payment_status].label}</Badge>
            )}
          </span>
        }
      />

      {order.status === "no_entregado" && (
        <Notice tone="warning" title="No pudimos entregarte este pedido">
          Si tienes dudas, escríbenos y lo vemos.
        </Notice>
      )}
      {order.payment_status === "fallido" && (
        <Notice tone="danger" title="No se ha podido cobrar este pedido">
          Revisa tu tarjeta en tu cuenta; volveremos a intentarlo.
        </Notice>
      )}

      {order.shop_orders.map((so) => (
        <section key={so.id}>
          <SectionTitle>{so.shops.name}</SectionTitle>
          <Card className="divide-y divide-border p-0">
            {so.order_items.map((item) => {
              const actual = item.quantity_actual === null ? null : Number(item.quantity_actual);
              const ordered = Number(item.quantity_ordered);
              return (
                <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted">
                      {formatQuantity(ordered, item.unit)}
                      {actual !== null && actual !== ordered && ` → ${formatQuantity(actual, item.unit)} reales`}
                    </p>
                  </div>
                  <p className="font-medium tabular-nums">{formatEuros(lineTotalCents(actual ?? ordered, item.unit_price_cents))}</p>
                </div>
              );
            })}
          </Card>
        </section>
      ))}

      {order.skipped_items.length > 0 && (
        <>
          <SectionTitle>No incluido esta vez</SectionTitle>
          <ul className="space-y-1 text-sm text-muted">
            {order.skipped_items.map((s) => (
              <li key={s.productId}>
                {s.productName}: {SKIP_REASONS[s.reason] ?? s.reason}
              </li>
            ))}
          </ul>
        </>
      )}

      <Card className="mt-6 space-y-1">
        {order.delivery_fee_cents > 0 && (
          <div className="flex items-baseline justify-between text-sm">
            <span>Envío</span>
            <span>{formatEuros(order.delivery_fee_cents)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">
            {order.payment_status === "pagado"
              ? "Total cobrado"
              : order.final_total_cents !== null
                ? "Total con el peso real"
                : "Total"}
          </span>
          <span className="text-xl font-bold">{formatEuros(total)}</span>
        </div>
        {order.final_total_cents === null && (
          <p className="text-sm text-muted">
            Estimado al hacer el pedido: {formatEuros(order.estimated_total_cents + order.delivery_fee_cents)}. Se cobra con el peso real al
            entregarlo. IVA incluido.
          </p>
        )}
      </Card>
    </>
  );
}
