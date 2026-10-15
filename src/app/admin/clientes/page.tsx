import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Badge, Card, EmptyState, PageHeader, PageSkeleton, cx, type Tone } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { STATUS_LABELS, type SubscriptionStatus } from "@/lib/domain/subscription";
import { planDescription } from "@/lib/plans";
import { formatLongDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Subscription } from "@/lib/types";

export const metadata: Metadata = { title: "Clientes" };

const TONES: Record<SubscriptionStatus | "sin", Tone> = {
  activa: "success",
  pausada: "warning",
  impagada: "danger",
  incompleta: "neutral",
  cancelada: "neutral",
  sin: "neutral",
};
const FILTERS: { key: string; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "activa", label: "Activas" },
  { key: "pausada", label: "Pausadas" },
  { key: "impagada", label: "Pago pendiente" },
  { key: "sin", label: "Sin suscripción" },
];

export default function CustomersPage({ searchParams }: PageProps<"/admin/clientes">) {
  return (
    <>
      <BackLink href="/admin">Inicio</BackLink>
      <PageHeader title="Clientes" />
      <Suspense fallback={<PageSkeleton />}>
        <Customers searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Customers({ searchParams }: Pick<PageProps<"/admin/clientes">, "searchParams">) {
  await requireRole("admin");
  const { estado } = await searchParams;
  const filter = typeof estado === "string" ? estado : "todos";
  const supabase = await createClient();
  const [{ data: profiles }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "cliente").order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("*"),
  ]);
  const subByCustomer = new Map(((subs ?? []) as Subscription[]).map((s) => [s.customer_id, s]));
  const rows = ((profiles ?? []) as Profile[]).map((p) => ({ profile: p, sub: subByCustomer.get(p.id) ?? null }));
  const statusOf = (r: (typeof rows)[number]) =>
    !r.sub || r.sub.status === "incompleta" || r.sub.status === "cancelada" ? "sin" : r.sub.status;
  const visible = filter === "todos" ? rows : rows.filter((r) => statusOf(r) === filter);
  const now = new Date();

  return (
    <>
      <nav aria-label="Filtrar" className="-mx-4 mb-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {FILTERS.map((f) => (
            <li key={f.key}>
              <Link
                href={`/admin/clientes?estado=${f.key}`}
                scroll={false}
                className={cx(
                  "inline-flex whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold",
                  f.key === filter ? "bg-text text-bg" : "border border-border bg-surface",
                )}
              >
                {f.label} ({f.key === "todos" ? rows.length : rows.filter((r) => statusOf(r) === f.key).length})
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {visible.length === 0 ? (
        <EmptyState icon="👥" title="No hay clientes en este grupo" />
      ) : (
        <ul className="space-y-2">
          {visible.map(({ profile: p, sub }) => {
            const status = statusOf({ profile: p, sub });
            return (
              <li key={p.id}>
                <Card className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{p.full_name || p.email}</p>
                    <Badge tone={TONES[status]}>{status === "sin" ? "Sin suscripción" : STATUS_LABELS[status]}</Badge>
                  </div>
                  {sub && status !== "sin" && (
                    <p className="text-sm">
                      {planDescription(sub)}
                      {sub.status === "activa" &&
                        sub.trial_ends_at &&
                        new Date(sub.trial_ends_at) > now &&
                        ` · prueba gratis hasta el ${formatLongDate(sub.trial_ends_at)} (o su 2.º pedido)`}
                      {sub.cancel_at_period_end && " · se da de baja"}
                    </p>
                  )}
                  <p className="text-sm text-muted">
                    {p.email}
                    {p.phone && (
                      <>
                        {" · "}
                        <a href={`tel:${p.phone}`} className="text-primary underline">
                          {p.phone}
                        </a>
                      </>
                    )}
                  </p>
                  {p.address && (
                    <p className="text-sm text-muted">
                      {p.address} ({p.postal_code})
                    </p>
                  )}
                  <p className="text-xs text-muted">Alta: {formatLongDate(p.created_at)}</p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
