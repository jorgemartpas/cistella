import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Card, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { madridDate } from "@/lib/domain/dates";
import { earningsByMonth, monthEarnings, type MonthEarnings, type ShopSale } from "@/lib/domain/earnings";
import { formatEuros } from "@/lib/domain/money";
import { capitalize, formatDay, formatMonth } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ventas y ganancias" };

export default function ShopSalesPage() {
  return (
    <>
      <PageHeader
        title="Ventas y ganancias"
        subtitle="Lo que ha recogido el reparto en tu tienda, con el peso real e IVA incluido. Tus ganancias son tus ventas menos la comisión de Cistella."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Sales />
      </Suspense>
    </>
  );
}

async function Sales() {
  const { shopId } = await requireShop();
  const supabase = await createClient();
  const [{ data: shop }, { data: sales }, { data: shopOrders }] = await Promise.all([
    supabase.from("shops").select("commission_pct").eq("id", shopId).single(),
    supabase.from("shop_sales").select("shop_order_id, delivery_date, total_cents").eq("shop_id", shopId),
    supabase.from("shop_orders").select("id, customer_label").eq("shop_id", shopId).eq("status", "recogido"),
  ]);
  const pct = Number(shop?.commission_pct ?? 0);
  const customer = new Map((shopOrders ?? []).map((o) => [o.id as string, o.customer_label as string]));
  const rows: ShopSale[] = (sales ?? []).map((s) => ({
    shopOrderId: s.shop_order_id,
    date: String(s.delivery_date),
    customer: customer.get(s.shop_order_id) ?? "Cliente",
    totalCents: Number(s.total_cents),
  }));

  const thisMonth = madridDate(new Date()).slice(0, 7);
  const months = earningsByMonth(rows, pct);
  const current = months.find((m) => m.month === thisMonth) ?? monthEarnings(thisMonth, [], pct);
  // Todos los demás meses (nunca se esconde una venta, aunque su día de reparto fuera de otro mes)
  const past = months.filter((m) => m.month !== thisMonth);
  const pctLabel = `${String(pct).replace(".", ",")}\u00a0%`;

  return (
    <>
      <section aria-labelledby="este-mes">
        <Card className="p-5 sm:p-6">
          <p className="text-sm font-semibold text-muted">{capitalize(formatMonth(current.month))}</p>
          <h2 id="este-mes" className="mt-1 font-bold">
            Tus ganancias de este mes
          </h2>
          <p className="text-4xl font-extrabold tracking-tight text-primary tabular-nums">
            {formatEuros(current.earningsCents)}
          </p>
          <Totals month={current} pctLabel={pctLabel} />
        </Card>

        <SectionTitle>Pedidos realizados este mes</SectionTitle>
        {current.orders.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay pedidos este mes. Aparecen cuando el reparto los recoge.</p>
        ) : (
          <OrderList orders={current.orders} />
        )}
      </section>

      <SectionTitle>Meses anteriores</SectionTitle>
      {past.length === 0 ? (
        <p className="text-sm text-muted">Cuando termine el mes, aquí tendrás su resumen con sus pedidos.</p>
      ) : (
        <ul className="space-y-3">
          {past.map((m) => (
            <li key={m.month}>
              <Card>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-bold">{capitalize(formatMonth(m.month))}</h3>
                  <p className="text-right">
                    <span className="block text-xs text-muted">Ganancias</span>
                    <span className="text-xl font-extrabold text-primary tabular-nums">{formatEuros(m.earningsCents)}</span>
                  </p>
                </div>
                <Totals month={m} pctLabel={pctLabel} />
                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-primary">
                    Ver {m.orders.length === 1 ? "el pedido" : `los ${m.orders.length} pedidos`}
                    <Icon name="chevron" className="size-4 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="mt-2">
                    <OrderList orders={m.orders} />
                  </div>
                </details>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Cómo se calcula</SectionTitle>
      <p className="text-sm text-muted">
        Cuenta como venta cada pedido que el reparto recoge en tu tienda, con la cantidad real que indicaste y el precio de
        Cistella (IVA incluido), aunque luego el cliente no estuviera en casa. La comisión acordada es el {pctLabel} de lo
        vendido en el mes; el resto son tus ganancias.
      </p>
    </>
  );
}

function Totals({ month, pctLabel }: { month: MonthEarnings; pctLabel: string }) {
  return (
    <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
      <div>
        <dt className="text-muted">Pedidos</dt>
        <dd className="text-lg font-semibold tabular-nums">{month.orders.length}</dd>
      </div>
      <div>
        <dt className="text-muted">Ventas</dt>
        <dd className="text-lg font-semibold tabular-nums">{formatEuros(month.salesCents)}</dd>
      </div>
      <div>
        <dt className="text-muted">Comisión ({pctLabel})</dt>
        <dd className="text-lg font-semibold tabular-nums">−{formatEuros(month.commissionCents)}</dd>
      </div>
    </dl>
  );
}

function OrderList({ orders }: { orders: ShopSale[] }) {
  return (
    <ul className="card-surface divide-y divide-border">
      {orders.map((o) => (
        <li key={o.shopOrderId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="min-w-0">
            <span className="block font-semibold">{o.customer}</span>
            <span className="block text-muted">{capitalize(formatDay(o.date))}</span>
          </span>
          <span className="font-semibold tabular-nums">{formatEuros(o.totalCents)}</span>
        </li>
      ))}
    </ul>
  );
}
