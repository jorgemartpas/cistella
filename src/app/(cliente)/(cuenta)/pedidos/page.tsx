import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { nextDeliveryFor, requestableDays } from "@/lib/delivery";
import { formatEuros } from "@/lib/domain/money";
import { capitalize, formatCutoff, formatDay } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Order, Subscription } from "@/lib/types";

export const metadata: Metadata = { title: "Mis pedidos" };

type OrderWithDay = Order & { delivery_days: { date: string } };

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Mis pedidos" />
      <Suspense fallback={<PageSkeleton />}>
        <Orders />
      </Suspense>
    </>
  );
}

async function Orders() {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const [{ data: sub }, { data: ordersData }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("customer_id", profile.id).maybeSingle<Subscription>(),
    supabase
      .from("orders")
      .select("*, delivery_days(date)")
      .eq("customer_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const orders = ((ordersData ?? []) as OrderWithDay[]).sort((a, b) =>
    b.delivery_days.date.localeCompare(a.delivery_days.date),
  );
  const inProgress = orders.filter((o) => ["pendiente", "preparado", "en_reparto"].includes(o.status));
  const history = orders.filter((o) => !inProgress.includes(o));
  const perDelivery = sub?.frequency === "por_envio";
  let next: { date: string; cutoffAt: Date; confirmed: boolean } | null = null;
  if (sub?.status === "activa" && perDelivery) {
    const requested = (await requestableDays(supabase, profile.id, new Date())).find((d) => d.requested);
    next = requested ? { date: requested.day.date, cutoffAt: new Date(requested.day.cutoff_at), confirmed: true } : null;
  } else if (sub?.status === "activa") {
    next = await nextDeliveryFor(supabase, sub, new Date());
  }

  return (
    <>
      <SectionTitle>Próximo pedido</SectionTitle>
      {next ? (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold first-letter:uppercase">{formatDay(next.date)}</p>
            <Badge tone={next.confirmed ? "success" : "warning"}>{next.confirmed ? "Confirmado" : "Sin confirmar"}</Badge>
          </div>
          <p className="text-sm text-muted">
            {next.confirmed
              ? `Se prepara con tu cesta tal y como esté el ${formatCutoff(next.cutoffAt)}.`
              : `Confírmalo antes del ${formatCutoff(next.cutoffAt)}; si no, ese día no te llevamos nada.`}
          </p>
          <ButtonLink
            href={next.confirmed ? "/cesta?ver=cesta" : "/cesta?ver=cesta#confirmar"}
            variant={next.confirmed ? "secondary" : "primary"}
            className="mt-3 w-full"
          >
            {next.confirmed ? "Revisar mi cesta" : "Revisar y confirmar"}
          </ButtonLink>
        </Card>
      ) : (
        <p className="text-sm text-muted">
          {sub?.status === "pausada"
            ? "Tu suscripción está pausada."
            : perDelivery && sub?.status === "activa"
              ? "No tienes ningún reparto pedido. Pídelo desde tu cesta."
              : sub?.status === "activa"
              ? "No hay repartos programados ahora mismo."
              : "Cuando te suscribas, aquí verás tu próximo pedido."}
        </p>
      )}

      {inProgress.length > 0 && (
        <>
          <SectionTitle>En curso</SectionTitle>
          <ul className="space-y-2">
            {inProgress.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        </>
      )}

      <SectionTitle>Historial</SectionTitle>
      {orders.length === 0 ? (
        <EmptyState icon="🧾" title="Aún no has hecho tu primer pedido">
          <p>Aquí podrás ver el listado de los pedidos que recibas.</p>
          <ButtonLink href="/categorias" variant="outline" className="mt-5 min-h-10 px-5 py-2 text-[15px]">
            Inicia tu compra
          </ButtonLink>
        </EmptyState>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted">Aún no tienes pedidos entregados.</p>
      ) : (
        <ul className="space-y-2">
          {history.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </ul>
      )}
    </>
  );
}

function OrderRow({ order }: { order: OrderWithDay }) {
  const status = ORDER_STATUS[order.status];
  const total = order.final_total_cents ?? order.estimated_total_cents + order.delivery_fee_cents;
  return (
    <li>
      <Link href={`/pedidos/${order.id}`}>
        <Card className="flex items-center gap-3 hover:bg-surface-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{capitalize(formatDay(order.delivery_days.date))}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone={status.tone}>{status.label}</Badge>
              {order.status === "entregado" && (
                <Badge tone={PAYMENT_STATUS[order.payment_status].tone}>{PAYMENT_STATUS[order.payment_status].label}</Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold">{formatEuros(total)}</p>
            {order.final_total_cents === null && <p className="text-xs text-muted">estimado</p>}
          </div>
          <Icon name="chevron" className="size-5 text-muted" />
        </Card>
      </Link>
    </li>
  );
}
