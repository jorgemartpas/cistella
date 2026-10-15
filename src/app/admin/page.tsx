import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Badge, ButtonLink, Card, Notice, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { closeDueDeliveryDays, dayDemand, ensureDeliveryDays } from "@/lib/delivery";
import { madridDate } from "@/lib/domain/dates";
import { formatEuros } from "@/lib/domain/money";
import { capitalize, formatCutoff, formatDay, plural } from "@/lib/format";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { DeliveryFrequency } from "@/lib/domain/subscription";
import { monthlyPriceCents } from "@/lib/plans";
import { loadChanges, pendingChangesCount } from "@/lib/product-changes";
import type { DeliveryDay, Settings } from "@/lib/types";

export const metadata: Metadata = { title: "Admin" };

const links: { href: string; label: string; icon: IconName; text: string }[] = [
  { href: "/admin/clientes", label: "Clientes", icon: "users", text: "Suscripciones y datos de contacto" },
  { href: "/admin/ventas", label: "Ventas y comisiones", icon: "chart", text: "Lo vendido por cada tienda, por meses" },
  { href: "/admin/ajustes", label: "Ajustes", icon: "sliders", text: "Pedido mínimo, zona de reparto, comisión" },
];

export default function AdminHome() {
  return (
    <>
      <PageHeader title="Hola, equipo" />
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard />
      </Suspense>
      <SectionTitle>Más</SectionTitle>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>
              <Card className="flex items-center gap-3 hover:bg-surface-2">
                <Icon name={l.icon} className="size-6 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">{l.label}</p>
                  <p className="text-sm text-muted">{l.text}</p>
                </div>
                <Icon name="chevron" className="size-5 text-muted" />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

async function Dashboard() {
  await requireRole("admin");
  const service = createServiceClient();
  await ensureDeliveryDays(service);
  await closeDueDeliveryDays(service);

  const supabase = await createClient();
  const today = madridDate(new Date());
  const [{ data: subs }, { data: days }, { data: failed }, { data: settings }, pendingCount, pendingChanges] =
    await Promise.all([
      supabase.from("subscriptions").select("status, frequency"),
      supabase.from("delivery_days").select("*").gte("date", today).neq("status", "cancelado").order("date").limit(4),
      supabase.from("orders").select("id").eq("payment_status", "fallido"),
      supabase.from("settings").select("*").single<Settings>(),
      pendingChangesCount(supabase),
      loadChanges(supabase, { pending: true, limit: 3 }),
    ]);
  const count = (status: string) => (subs ?? []).filter((s) => s.status === status).length;
  const activeSubs = (subs ?? []).filter((s) => s.status === "activa");
  const active = activeSubs.length;
  const perDelivery = activeSubs.filter((s) => s.frequency === "por_envio").length;
  const monthly = settings
    ? activeSubs.reduce((sum, s) => sum + monthlyPriceCents(settings, s.frequency as DeliveryFrequency), 0)
    : 0;
  const upcoming = (days ?? []) as DeliveryDay[];
  const nextClosed = upcoming.find((d) => d.status === "cerrado");
  const nextOpen = upcoming.find((d) => d.status === "abierto");

  const demand = nextOpen ? await dayDemand(supabase, nextOpen) : { confirmed: 0, automatic: 0 };

  let progress: { orders: number; delivered: number } | null = null;
  if (nextClosed) {
    const { data: orders } = await supabase.from("orders").select("status").eq("delivery_day_id", nextClosed.id);
    progress = {
      orders: orders?.length ?? 0,
      delivered: (orders ?? []).filter((o) => !["pendiente", "preparado", "en_reparto"].includes(o.status)).length,
    };
  }

  return (
    <>
      {pendingCount > 0 && (
        <div className="mb-3">
          <Notice
            tone="warning"
            title={pendingCount === 1 ? "1 cambio pendiente de revisión" : `${pendingCount} cambios pendientes de revisión`}
          >
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {pendingChanges.map((c) => (
                <li key={c.id}>{c.title}</li>
              ))}
            </ul>
            <Link href="/admin/revisiones" className="mt-2 inline-block font-semibold underline underline-offset-2">
              Revisar
            </Link>
          </Notice>
        </div>
      )}
      {nextClosed && progress && (
        <Card className="mb-3 border-transparent bg-primary-soft">
          <p className="text-sm text-primary">{nextClosed.date === today ? "Reparto de hoy" : "Próximo reparto"}</p>
          <p className="text-xl font-bold">{capitalize(formatDay(nextClosed.date))}</p>
          <p className="mt-1 text-sm">
            {plural(progress.orders, "pedido")} · {plural(progress.delivered, "entrega cerrada", "entregas cerradas")}
          </p>
          <ButtonLink href={`/admin/reparto?dia=${nextClosed.id}`} className="mt-3 w-full">
            <Icon name="truck" /> Ir al reparto
          </ButtonLink>
        </Card>
      )}
      {nextOpen && (
        <Card className="mb-3">
          <p className="text-sm text-muted">Siguiente cierre de pedidos</p>
          <p className="font-semibold first-letter:uppercase">{formatCutoff(nextOpen.cutoff_at)}</p>
          <p className="text-sm text-muted">
            Para el reparto del {formatDay(nextOpen.date)} · {plural(demand.confirmed, "pedido confirmado", "pedidos confirmados")}
            {demand.automatic > 0 && ` · ${demand.automatic} con envío automático`}
          </p>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm text-muted">Clientes activos</p>
          <p className="text-2xl font-bold tabular-nums">{active}</p>
          <p className="text-xs text-muted">
            {perDelivery} por envío · {count("pausada")} pausadas · {count("impagada")} con pago pendiente
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Cuotas al mes</p>
          <p className="text-2xl font-bold tabular-nums">{formatEuros(monthly)}</p>
          <p className="text-xs text-muted">IVA incluido</p>
        </Card>
      </div>
      {(failed?.length ?? 0) > 0 && (
        <Link href="/admin/reparto" className="mt-3 block">
          <Card className="flex items-center justify-between border-transparent bg-danger-soft text-danger">
            <span className="font-semibold">{plural(failed!.length, "cobro fallido", "cobros fallidos")}</span>
            <Badge tone="danger">Revisar</Badge>
          </Card>
        </Link>
      )}
    </>
  );
}
