import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, Input, PageHeader, PageSkeleton, SectionTitle, Select } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getShops } from "@/lib/catalog";
import { closeDueDeliveryDays, ensureDeliveryDays, getScheduleRules } from "@/lib/delivery";
import { addDays, madridDate } from "@/lib/domain/dates";
import { WEEKDAY_NAMES } from "@/lib/domain/schedule";
import { capitalize, formatCutoff, formatDay, plural } from "@/lib/format";
import { DAY_STATUS } from "@/lib/labels";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { DeliveryDay } from "@/lib/types";
import { generateDays, saveSchedule } from "./actions";

export const metadata: Metadata = { title: "Días de reparto" };

export default function DaysPage() {
  return (
    <>
      <PageHeader title="Días de reparto" subtitle="Calendario, hora de cierre y tienda de turno de cada reparto." />
      <Suspense fallback={<PageSkeleton />}>
        <Days />
      </Suspense>
    </>
  );
}

async function Days() {
  await requireRole("admin");
  // Mantenimiento idempotente: por si el cron no ha pasado todavía
  const service = createServiceClient();
  await ensureDeliveryDays(service);
  await closeDueDeliveryDays(service);

  const supabase = await createClient();
  const today = madridDate(new Date());
  const [rules, shops, { data: daysData }] = await Promise.all([
    getScheduleRules(supabase),
    getShops(supabase),
    supabase.from("delivery_days").select("*").gte("date", addDays(today, -14)).order("date"),
  ]);
  const days = (daysData ?? []) as DeliveryDay[];
  const { data: orderCounts } = await supabase
    .from("orders")
    .select("delivery_day_id")
    .in("delivery_day_id", days.map((d) => d.id));
  const shopName = new Map(shops.map((s) => [s.id, s.name]));
  const ordersByDay = new Map<string, number>();
  for (const o of orderCounts ?? []) ordersByDay.set(o.delivery_day_id, (ordersByDay.get(o.delivery_day_id) ?? 0) + 1);
  const upcoming = days.filter((d) => d.date >= today);
  const past = days.filter((d) => d.date < today).reverse();

  return (
    <>
      <SectionTitle
        action={
          <form action={generateDays}>
            <SubmitButton variant="ghost" className="min-h-10 px-3 py-1 text-sm" pendingText="Generando…">
              Generar días
            </SubmitButton>
          </form>
        }
      >
        Próximos repartos
      </SectionTitle>
      {upcoming.length === 0 ? (
        <EmptyState icon="📅" title="No hay repartos programados">
          Activa algún día en el calendario de abajo.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((d) => (
            <DayRow key={d.id} day={d} shopName={shopName} orders={ordersByDay.get(d.id) ?? 0} />
          ))}
        </ul>
      )}

      <SectionTitle>Calendario semanal</SectionTitle>
      <ActionForm action={saveSchedule}>
        <Card className="divide-y divide-border p-0">
          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => {
            const rule = rules.find((r) => r.weekday === weekday);
            return (
              <div key={weekday} className="space-y-2 px-4 py-3">
                <label className="flex items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    name={`active_${weekday}`}
                    defaultChecked={rule?.active ?? false}
                    className="size-5 accent-[var(--primary)]"
                  />
                  {capitalize(WEEKDAY_NAMES[weekday])}
                </label>
                <div className="flex items-center gap-2 pl-8 text-sm">
                  <Select
                    name={`days_${weekday}`}
                    defaultValue={rule?.cutoffDaysBefore ?? 1}
                    className="min-w-0 flex-1 py-2"
                    aria-label={`Días antes, ${WEEKDAY_NAMES[weekday]}`}
                  >
                    <option value={0}>Cierre el mismo día</option>
                    <option value={1}>Cierre la víspera</option>
                    <option value={2}>Cierre 2 días antes</option>
                    <option value={3}>Cierre 3 días antes</option>
                  </Select>
                  <Input
                    type="time"
                    name={`time_${weekday}`}
                    defaultValue={rule?.cutoffTime ?? "20:00"}
                    className="w-28 py-2"
                    aria-label={`Hora de cierre, ${WEEKDAY_NAMES[weekday]}`}
                  />
                </div>
              </div>
            );
          })}
        </Card>
        <p className="text-sm text-muted">
          La tienda de turno alterna en cada reparto según el <Link href="/admin/tiendas" className="underline">orden de rotación</Link>{" "}
          de cada tienda. En cada día puedes cambiarla a mano.
        </p>
        <SubmitButton variant="secondary" className="w-full">
          Guardar calendario
        </SubmitButton>
      </ActionForm>

      {past.length > 0 && (
        <>
          <SectionTitle>Últimos repartos</SectionTitle>
          <ul className="space-y-2">
            {past.map((d) => (
              <DayRow key={d.id} day={d} shopName={shopName} orders={ordersByDay.get(d.id) ?? 0} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function DayRow({ day, shopName, orders }: { day: DeliveryDay; shopName: Map<string, string>; orders: number }) {
  const status = DAY_STATUS[day.status];
  return (
    <li>
      <Link href={`/admin/dias/${day.id}`}>
        <Card className="flex items-center gap-3 hover:bg-surface-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold first-letter:uppercase">{formatDay(day.date)}</p>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted">
              {day.status === "abierto" && <>Cierre {formatCutoff(day.cutoff_at)} · </>}
              {day.status === "cerrado" && <>{plural(orders, "pedido")} · </>}
              🍊 {day.fruteria_id ? shopName.get(day.fruteria_id) : "sin frutería"} · 🐟{" "}
              {day.pescaderia_id ? shopName.get(day.pescaderia_id) : "sin pescadería"}
            </p>
          </div>
          <Icon name="chevron" className="size-5 text-muted" />
        </Card>
      </Link>
    </li>
  );
}
