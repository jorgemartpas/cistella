import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Card, Field, Input, Notice, PageHeader, PageSkeleton, SectionTitle, Select } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getShops } from "@/lib/catalog";
import { TIME_ZONE } from "@/lib/domain/dates";
import { formatEuros } from "@/lib/domain/money";
import { capitalize, formatCutoff, formatDateTime, formatDay, plural } from "@/lib/format";
import { DAY_STATUS, SKIP_REASONS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { DeliveryDay } from "@/lib/types";
import { closeDayNow, setDayCancelled, updateDay } from "../actions";

export const metadata: Metadata = { title: "Día de reparto" };

/** Valor para <input type="datetime-local"> en hora de Madrid */
function toLocalInput(instant: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export default function DayPage({ params }: PageProps<"/admin/dias/[id]">) {
  return (
    <>
      <BackLink href="/admin/dias">Días de reparto</BackLink>
      <Suspense fallback={<PageSkeleton />}>
        <Day params={params} />
      </Suspense>
    </>
  );
}

async function Day({ params }: Pick<PageProps<"/admin/dias/[id]">, "params">) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: day }, shops] = await Promise.all([
    supabase.from("delivery_days").select("*").eq("id", id).maybeSingle<DeliveryDay>(),
    getShops(supabase),
  ]);
  if (!day) notFound();

  const status = DAY_STATUS[day.status];
  const shopName = new Map(shops.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader
        title={capitalize(formatDay(day.date))}
        subtitle={<Badge tone={status.tone}>{status.label}</Badge>}
      />
      {day.status === "abierto" && <OpenDay day={day} shops={shops} />}
      {day.status === "cancelado" && (
        <Card className="space-y-3">
          <p>Este reparto está cancelado: no se generarán pedidos y los clientes pasan al siguiente.</p>
          <form action={setDayCancelled.bind(null, day.id, false)}>
            <SubmitButton variant="secondary" className="w-full">
              Volver a abrirlo
            </SubmitButton>
          </form>
        </Card>
      )}
      {day.status === "cerrado" && <ClosedDay day={day} shopName={shopName} />}
    </>
  );
}

async function OpenDay({ day, shops }: { day: DeliveryDay; shops: Awaited<ReturnType<typeof getShops>> }) {
  const fruterias = shops.filter((s) => s.type === "fruteria");
  const pescaderias = shops.filter((s) => s.type === "pescaderia");
  const supabase = await createClient();
  const { count: confirmed } = await supabase
    .from("delivery_requests")
    .select("customer_id", { count: "exact", head: true })
    .eq("delivery_day_id", day.id);
  return (
    <>
      <p className="mb-2 text-muted">
        Los clientes pueden cambiar su cesta y confirmar el pedido hasta el{" "}
        <strong className="text-text">{formatCutoff(day.cutoff_at)}</strong>. A esa hora se generan los pedidos de cada
        tienda con las cestas confirmadas.
      </p>
      <p className="mb-4 font-semibold">Pedidos confirmados hasta ahora: {confirmed ?? 0}</p>
      <ActionForm action={updateDay}>
        <input type="hidden" name="id" value={day.id} />
        <Field label="Cierre de pedidos (hora de Alzira)">
          <Input type="datetime-local" name="cutoff" defaultValue={toLocalInput(day.cutoff_at)} required />
        </Field>
        <Field label="Frutería de turno" hint="Sirve la fruta y la verdura de este reparto">
          <Select name="fruteria_id" defaultValue={day.fruteria_id ?? ""}>
            <option value="">Ninguna (no se sirve fruta ni verdura)</option>
            {fruterias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {!s.active && " (inactiva)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pescadería de turno">
          <Select name="pescaderia_id" defaultValue={day.pescaderia_id ?? ""}>
            <option value="">Ninguna (no se sirve pescado)</option>
            {pescaderias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {!s.active && " (inactiva)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notas internas (opcional)">
          <Input name="notes" defaultValue={day.notes ?? ""} maxLength={200} />
        </Field>
        <SubmitButton className="w-full">Guardar cambios</SubmitButton>
      </ActionForm>

      <SectionTitle>Acciones</SectionTitle>
      <div className="grid gap-2">
        <form action={closeDayNow.bind(null, day.id)}>
          <ConfirmButton
            className="w-full"
            message="Se generan ya los pedidos de los clientes que lo han confirmado; los demás ya no podrán confirmar. ¿Seguir?"
            pendingText="Generando pedidos…"
          >
            Cerrar ahora y generar pedidos
          </ConfirmButton>
        </form>
        <form action={setDayCancelled.bind(null, day.id, true)}>
          <ConfirmButton
            variant="danger"
            className="w-full"
            message="Nadie recibirá pedido este día (por ejemplo, un festivo). ¿Cancelar el reparto?"
          >
            Cancelar este reparto
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}

async function ClosedDay({ day, shopName }: { day: DeliveryDay; shopName: Map<string, string> }) {
  const supabase = await createClient();
  const { data: shopOrders } = await supabase
    .from("shop_orders")
    .select("shop_id, status")
    .eq("delivery_day_id", day.id);
  const { data: orders } = await supabase
    .from("orders")
    .select("estimated_total_cents, delivery_fee_cents")
    .eq("delivery_day_id", day.id);
  const byShop = new Map<string, { total: number; prepared: number }>();
  for (const so of shopOrders ?? []) {
    const entry = byShop.get(so.shop_id) ?? { total: 0, prepared: 0 };
    entry.total += 1;
    if (so.status !== "pendiente") entry.prepared += 1;
    byShop.set(so.shop_id, entry);
  }
  const estimated = (orders ?? []).reduce((sum, o) => sum + o.estimated_total_cents + o.delivery_fee_cents, 0);
  const report = day.generation_report;

  return (
    <>
      <Card className="space-y-1">
        <p>
          <strong>{plural(orders?.length ?? 0, "pedido")}</strong> · generados el {formatDateTime(day.orders_generated_at!)}
        </p>
        <p className="text-sm text-muted">Importe estimado: {formatEuros(estimated)}</p>
        <p className="text-sm text-muted">
          🍊 {day.fruteria_id ? shopName.get(day.fruteria_id) : "sin frutería"} · 🐟{" "}
          {day.pescaderia_id ? shopName.get(day.pescaderia_id) : "sin pescadería"}
        </p>
      </Card>
      <ButtonLink href={`/admin/reparto?dia=${day.id}`} className="mt-3 w-full">
        Ver el reparto de este día
      </ButtonLink>

      <SectionTitle>Por tienda</SectionTitle>
      <ul className="space-y-2">
        {[...byShop.entries()].map(([shopId, { total, prepared }]) => (
          <li key={shopId}>
            <Card className="flex items-center justify-between py-3">
              <span className="font-medium">{shopName.get(shopId)}</span>
              <Badge tone={prepared === total ? "success" : "warning"}>
                {prepared}/{total} preparados
              </Badge>
            </Card>
          </li>
        ))}
      </ul>

      {report && report.skippedCustomers.length > 0 && (
        <>
          <SectionTitle>Clientes sin pedido</SectionTitle>
          <Notice tone="warning">
            <ul className="space-y-1">
              {report.skippedCustomers.map((s) => (
                <li key={s.customerId}>
                  {s.name}: {SKIP_REASONS[s.reason] ?? s.reason}
                  {s.totalCents !== undefined && ` (${formatEuros(s.totalCents)})`}
                </li>
              ))}
            </ul>
          </Notice>
        </>
      )}
    </>
  );
}
