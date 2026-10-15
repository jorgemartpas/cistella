import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Card, PageHeader, PageSkeleton, SectionTitle, buttonStyles, cx } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { madridDate } from "@/lib/domain/dates";
import { formatEuros } from "@/lib/domain/money";
import { SHOP_TYPE_LABELS } from "@/lib/domain/orders";
import { formatMonth } from "@/lib/format";
import { monthRange, salesByShop } from "@/lib/sales";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ventas y comisiones" };

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default function SalesPage({ searchParams }: PageProps<"/admin/ventas">) {
  return (
    <>
      <BackLink href="/admin">Inicio</BackLink>
      <PageHeader
        title="Ventas y comisiones"
        subtitle="Lo que el reparto ha recogido en cada tienda, con el peso real. La comisión se factura a mano."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Sales searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Sales({ searchParams }: Pick<PageProps<"/admin/ventas">, "searchParams">) {
  await requireRole("admin");
  const { mes } = await searchParams;
  const current = madridDate(new Date()).slice(0, 7);
  const month = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : current;
  const supabase = await createClient();
  const { from, to } = monthRange(month);
  const [rows, { data: delivered }] = await Promise.all([
    salesByShop(supabase, month),
    supabase
      .from("orders")
      .select("final_total_cents, payment_status, delivery_days!inner(date)")
      .eq("status", "entregado")
      .gte("delivery_days.date", from)
      .lte("delivery_days.date", to),
  ]);
  const totalSales = rows.reduce((s, r) => s + r.salesCents, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commissionCents, 0);
  const charged = (delivered ?? [])
    .filter((o) => o.payment_status === "pagado")
    .reduce((s, o) => s + (o.final_total_cents ?? 0), 0);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={`/admin/ventas?mes=${shiftMonth(month, -1)}`} className={buttonStyles.small + " border border-border"} aria-label="Mes anterior">
          ←
        </Link>
        <p className="font-semibold first-letter:uppercase">{formatMonth(month)}</p>
        <Link
          href={`/admin/ventas?mes=${shiftMonth(month, 1)}`}
          className={cx(buttonStyles.small, "border border-border", month >= current && "pointer-events-none opacity-40")}
          aria-label="Mes siguiente"
        >
          →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm text-muted">Ventas de las tiendas</p>
          <p className="text-xl font-bold tabular-nums">{formatEuros(totalSales)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Comisión a facturar</p>
          <p className="text-xl font-bold tabular-nums">{formatEuros(totalCommission)}</p>
        </Card>
      </div>
      <p className="mt-2 text-sm text-muted">Cobrado a clientes por productos este mes: {formatEuros(charged)}.</p>

      <SectionTitle
        action={
          <a href={`/admin/ventas/csv?mes=${month}`} className={cx(buttonStyles.small, "text-primary")} download>
            Descargar CSV
          </a>
        }
      >
        Por tienda
      </SectionTitle>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.shop.id}>
            <Card className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{r.shop.name}</p>
                <p className="text-sm text-muted">
                  {SHOP_TYPE_LABELS[r.shop.type]} · {r.orders} {r.orders === 1 ? "pedido" : "pedidos"} ·{" "}
                  {String(r.shop.commission_pct).replace(".", ",")} %
                </p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-semibold">{formatEuros(r.salesCents)}</p>
                <p className="text-sm text-muted">comisión {formatEuros(r.commissionCents)}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
