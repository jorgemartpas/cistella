import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Badge, EmptyState, PageHeader, PageSkeleton, SectionTitle, buttonStyles } from "@/components/ui";
import { openBillingPortal } from "@/lib/actions/subscription";
import { requireRole } from "@/lib/auth";
import { formatEuros } from "@/lib/domain/money";
import { capitalize, formatDay, formatLongDate } from "@/lib/format";
import { PAYMENT_STATUS } from "@/lib/labels";
import { getStripe, paymentsDemoMode } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { getTrial } from "@/lib/trial";
import type { PaymentStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Facturas" };

export default function InvoicesPage() {
  return (
    <>
      <PageHeader title="Facturas" subtitle="Lo que te hemos cobrado por tus pedidos y por la cuota de tu plan." />
      <Suspense fallback={<PageSkeleton />}>
        <Invoices />
      </Suspense>
    </>
  );
}

type DeliveredOrder = {
  id: string;
  payment_status: PaymentStatus;
  final_total_cents: number | null;
  estimated_total_cents: number;
  delivery_fee_cents: number;
  delivery_days: { date: string };
};

async function Invoices() {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const [{ data }, { data: sub }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, payment_status, final_total_cents, estimated_total_cents, delivery_fee_cents, delivery_days(date)")
      .eq("customer_id", profile.id)
      .eq("status", "entregado")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("subscriptions")
      .select("customer_id, status, stripe_customer_id, trial_started_at, trial_ends_at")
      .eq("customer_id", profile.id)
      .maybeSingle(),
  ]);
  const trial = sub?.status === "activa" ? await getTrial(supabase, sub) : null;
  const orders = ((data ?? []) as unknown as DeliveredOrder[]).sort((a, b) =>
    b.delivery_days.date.localeCompare(a.delivery_days.date),
  );
  const hasStripe = Boolean(getStripe() && sub?.stripe_customer_id);

  return (
    <>
      <SectionTitle>Pedidos</SectionTitle>
      {orders.length === 0 ? (
        <EmptyState icon="🧾" title="Aún no tienes facturas">
          Cuando te entreguemos un pedido, aquí verás lo que se te ha cobrado.
        </EmptyState>
      ) : (
        <ul className="card-surface divide-y divide-border">
          {orders.map((order) => {
            const status = PAYMENT_STATUS[order.payment_status];
            const total = order.final_total_cents ?? order.estimated_total_cents + order.delivery_fee_cents;
            return (
              <li key={order.id}>
                <Link href={`/pedidos/${order.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
                  <Icon name="file" className="size-5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Pedido del {capitalize(formatDay(order.delivery_days.date))}</p>
                    <div className="mt-1">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </div>
                  <p className="font-bold tabular-nums">{formatEuros(total)}</p>
                  <Icon name="chevron" className="size-5 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <SectionTitle>Cuota del plan</SectionTitle>
      <div className="card-surface p-5 text-sm">
        {trial && (
          <p className="mb-3 font-semibold text-primary">
            🎁 Estás en tu prueba gratis: aún no se ha cobrado ninguna cuota. La primera se cobra el{" "}
            {formatLongDate(trial.endsAt)} o con tu 2.º pedido, lo que llegue antes.
          </p>
        )}
        {hasStripe ? (
          <>
            <p className="text-muted">
              Las facturas de tu cuota las emite Stripe, nuestro procesador de pagos. Desde allí las ves y las descargas.
            </p>
            <form action={openBillingPortal} className="mt-3">
              <button type="submit" className={`${buttonStyles.outline} w-full sm:w-auto sm:px-6`}>
                Ver las facturas de la cuota
              </button>
            </form>
          </>
        ) : paymentsDemoMode() ? (
          <p className="text-muted">Ahora mismo Cistella está en modo de prueba: no se cobra ninguna cuota.</p>
        ) : (
          <p className="text-muted">Cuando tengas un plan con cuota, aquí podrás ver sus facturas.</p>
        )}
      </div>
    </>
  );
}
