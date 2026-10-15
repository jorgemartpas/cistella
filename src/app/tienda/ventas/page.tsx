import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, EmptyState, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { commissionCents, formatEuros } from "@/lib/domain/money";
import { formatMonth } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ventas" };

export default function ShopSalesPage() {
  return (
    <>
      <PageHeader
        title="Ventas y comisión"
        subtitle="Lo que ha recogido el reparto en tu tienda, con el peso real. La comisión se factura a mano a final de mes."
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
  const [{ data: shop }, { data: sales }] = await Promise.all([
    supabase.from("shops").select("commission_pct").eq("id", shopId).single(),
    supabase.from("shop_sales").select("delivery_date, total_cents").eq("shop_id", shopId).order("delivery_date", { ascending: false }),
  ]);
  const pct = Number(shop?.commission_pct ?? 0);
  if (!sales || sales.length === 0) {
    return <EmptyState icon="📊" title="Aún no hay ventas">Aparecerán cuando el reparto recoja tus primeros pedidos.</EmptyState>;
  }

  const months = new Map<string, { orders: number; total: number }>();
  for (const s of sales) {
    const month = String(s.delivery_date).slice(0, 7);
    const m = months.get(month) ?? { orders: 0, total: 0 };
    m.orders += 1;
    m.total += Number(s.total_cents);
    months.set(month, m);
  }

  return (
    <>
      <p className="mb-3 text-sm text-muted">Comisión acordada: {String(pct).replace(".", ",")} % de lo vendido.</p>
      <ul className="space-y-3">
        {[...months.entries()].map(([month, m]) => {
          const commission = commissionCents(m.total, pct);
          return (
            <li key={month}>
              <Card>
                <p className="font-semibold first-letter:uppercase">{formatMonth(month)}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-muted">Pedidos</dt>
                    <dd className="text-lg font-semibold tabular-nums">{m.orders}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Ventas</dt>
                    <dd className="text-lg font-semibold tabular-nums">{formatEuros(m.total)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Comisión</dt>
                    <dd className="text-lg font-semibold tabular-nums">{formatEuros(commission)}</dd>
                  </div>
                </dl>
              </Card>
            </li>
          );
        })}
      </ul>
      <SectionTitle>Qué cuenta como venta</SectionTitle>
      <p className="text-sm text-muted">
        Cada pedido que el reparto recoge en tu tienda, con la cantidad real que indicaste y el precio de Cistella (IVA
        incluido).
      </p>
    </>
  );
}
