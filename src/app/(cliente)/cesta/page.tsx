import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { ConfirmOrder } from "@/components/confirm-order";
import { DeliveryRequestToggle } from "@/components/delivery-request-toggle";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageSkeleton, SectionTitle, cx } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { CATEGORY_ORDER, getProducts, getShops } from "@/lib/catalog";
import {
  closingDayFor,
  ensureDeliveryDays,
  getScheduleRules,
  nextDeliveryFor,
  requestableDays,
  type RequestableDay,
  type UpcomingDelivery,
} from "@/lib/delivery";
import { formatEuros, formatUnitPrice, lineTotalCents } from "@/lib/domain/money";
import { CATEGORY_LABELS, type ProductCategory } from "@/lib/domain/orders";
import { WEEKDAY_NAMES } from "@/lib/domain/schedule";
import { FREQUENCY_LABELS, usesDayBaskets } from "@/lib/domain/subscription";
import { formatCutoff, formatDay } from "@/lib/format";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { DeliveryDay, Product, Settings, Subscription } from "@/lib/types";

export const metadata: Metadata = { title: "Mi cesta" };

type View = "cesta" | ProductCategory;
const ICONS: Record<ProductCategory, string> = { fruta: "🍊", verdura: "🥬", pescado: "🐟", carne: "🥩" };

export default function BasketPage({ searchParams }: PageProps<"/cesta">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Basket searchParams={searchParams} />
    </Suspense>
  );
}

async function Basket({ searchParams }: Pick<PageProps<"/cesta">, "searchParams">) {
  const profile = await requireRole("cliente");
  const { ver, dia } = await searchParams;
  const supabase = await createClient();
  const now = new Date();

  const [{ data: sub }, products, shops, rules, { data: basketRows }, { data: settings }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("customer_id", profile.id).maybeSingle<Subscription>(),
    getProducts(supabase, { onlyActive: true }),
    getShops(supabase),
    getScheduleRules(supabase),
    supabase.from("basket_items").select("product_id, quantity, slot").eq("customer_id", profile.id),
    supabase.from("settings").select("*").single<Settings>(),
  ]);

  const plan = sub?.frequency ?? "semanal";
  const isActive = sub?.status === "activa";
  const perDelivery = plan === "por_envio";
  // Plan de 2 veces por semana: una cesta para cada día de reparto
  const dayBaskets = usesDayBaskets(plan);
  const weekdays = rules.filter((r) => r.active).map((r) => r.weekday);
  const slot = dayBaskets ? (weekdays.includes(Number(dia)) ? Number(dia) : (weekdays[0] ?? 0)) : 0;

  let next: UpcomingDelivery | null = null;
  let requestable: RequestableDay[] = [];
  if (isActive && perDelivery) {
    await ensureDeliveryDays(createServiceClient(), now);
    requestable = await requestableDays(supabase, profile.id, now);
  } else if (isActive) {
    next = await nextDeliveryFor(supabase, sub, now, dayBaskets ? slot : undefined);
    // Para poder confirmarlo, el día de reparto tiene que existir
    if (next && !next.day) {
      await ensureDeliveryDays(createServiceClient(), now);
      next = await nextDeliveryFor(supabase, sub, now, dayBaskets ? slot : undefined);
    }
  }
  const closing = isActive ? await closingDayFor(supabase, sub, now) : null;
  const firstRequested = requestable.find((r) => r.requested);
  const upcomingDay = next?.day ?? firstRequested?.day ?? null;
  // Reparto que se confirma desde la cesta: el próximo que le toca o, en pago por envío,
  // el primero que ha pedido (o el primero abierto, para pedirlo)
  const firstRequestable = firstRequested ?? requestable[0];
  const toConfirm: ToConfirm | null = !isActive
    ? null
    : perDelivery
      ? firstRequestable
        ? { day: firstRequestable.day, confirmed: firstRequestable.requested }
        : null
      : next?.day
        ? { day: next.day, confirmed: next.confirmed }
        : null;
  const { data: unavailableIds } = upcomingDay
    ? await supabase.rpc("unavailable_on_day", { p_day_id: upcomingDay.id })
    : { data: [] };
  const unavailable = new Set<string>((unavailableIds as string[] | null) ?? []);

  const basket = new Map(
    (basketRows ?? []).filter((b) => b.slot === slot).map((b) => [b.product_id as string, Number(b.quantity)]),
  );
  const shopName = new Map(shops.map((s) => [s.id, s.name]));
  const view: View =
    ver === "cesta" || CATEGORY_ORDER.includes(ver as ProductCategory)
      ? (ver as View)
      : basket.size > 0
        ? "cesta"
        : "fruta";
  const href = (v: View, s = slot) => `/cesta?ver=${v}${dayBaskets ? `&dia=${s}` : ""}`;

  return (
    <>
      {dayBaskets && (
        <nav aria-label="Cesta de cada día" className="mb-3 grid grid-cols-2 gap-2">
          {weekdays.map((w) => (
            <Link
              key={w}
              href={href(view, w)}
              scroll={false}
              aria-current={w === slot ? "page" : undefined}
              className={cx(
                "rounded-xl px-3 py-2.5 text-center text-sm font-semibold",
                w === slot ? "bg-primary text-primary-ink" : "border border-border bg-surface",
              )}
            >
              Cesta del {WEEKDAY_NAMES[w]}
            </Link>
          ))}
        </nav>
      )}

      {perDelivery && isActive ? (
        <RequestBanner
          days={requestable}
          feeCents={settings?.delivery_fee_cents ?? 0}
          closingDate={closing?.date ?? null}
        />
      ) : (
        <DeliveryBanner
          sub={sub}
          next={next}
          closingDate={closing?.date ?? null}
          confirmHref={`${href("cesta")}#confirmar`}
        />
      )}

      <nav aria-label="Secciones de la cesta" className="-mx-4 mb-4 mt-5 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {(["cesta", ...CATEGORY_ORDER] as View[]).map((v) => (
            <li key={v}>
              <Link
                href={href(v)}
                scroll={false}
                aria-current={v === view ? "page" : undefined}
                className={cx(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold",
                  v === view ? "bg-text text-bg" : "border border-border bg-surface",
                )}
              >
                {v === "cesta" ? (
                  <>
                    <Icon name="basket" className="size-4" /> {dayBaskets ? `Cesta del ${WEEKDAY_NAMES[slot]}` : "Mi cesta"}
                    {basket.size > 0 && ` (${basket.size})`}
                  </>
                ) : (
                  <>
                    <span aria-hidden>{ICONS[v]}</span> {CATEGORY_LABELS[v]}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {view === "cesta" ? (
        <BasketView
          products={products}
          basket={basket}
          slot={slot}
          shopName={shopName}
          unavailable={unavailable}
          minOrderCents={settings?.min_order_cents ?? 0}
          deliveryFeeCents={perDelivery ? (settings?.delivery_fee_cents ?? 0) : 0}
          toConfirm={toConfirm}
        />
      ) : (
        <CategoryView
          category={view}
          products={products.filter((p) => p.category === view)}
          basket={basket}
          slot={slot}
          shopName={shopName}
          unavailable={unavailable}
        />
      )}
    </>
  );
}

function DeliveryBanner({
  sub,
  next,
  closingDate,
  confirmHref,
}: {
  sub: Subscription | null;
  next: UpcomingDelivery | null;
  closingDate: string | null;
  confirmHref: string;
}) {
  if (!sub || sub.status === "incompleta" || sub.status === "cancelada") {
    return (
      <Card className="bg-accent-soft border-transparent">
        <p className="font-semibold">Aún no tienes un plan activo</p>
        <p className="mt-1 text-sm">Puedes ir montando la cesta. Para recibirla, elige tu plan.</p>
        <ButtonLink href="/bienvenida" className="mt-3 w-full">
          Elegir plan
        </ButtonLink>
      </Card>
    );
  }
  if (sub.status === "pausada") {
    return (
      <Notice tone="warning" title="Tu suscripción está pausada">
        No recibirás repartos hasta que la reanudes. <Link href="/cuenta" className="font-semibold underline">Ir a mi cuenta</Link>
      </Notice>
    );
  }
  if (sub.status === "impagada") {
    return (
      <Notice tone="danger" title="No hemos podido cobrar la cuota">
        Revisa tu tarjeta para seguir recibiendo repartos.{" "}
        <Link href="/cuenta" className="font-semibold underline">Ir a mi cuenta</Link>
      </Notice>
    );
  }
  return (
    <Card className="border-transparent bg-primary-soft">
      {closingDate && (
        <p className="mb-2 text-sm font-medium text-warning">
          Estamos preparando el reparto del {formatDay(closingDate)}.
        </p>
      )}
      {next ? (
        <>
          <p className="text-sm text-primary">Próximo reparto · {FREQUENCY_LABELS[sub.frequency].toLowerCase()}</p>
          <p className="text-xl font-bold first-letter:uppercase">{formatDay(next.date)}</p>
          {next.confirmed ? (
            <p className="mt-1 flex items-start gap-1.5 text-sm">
              <Icon name="check" className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <strong>Pedido confirmado.</strong> Puedes cambiar la cesta hasta el{" "}
                <strong>{formatCutoff(next.cutoffAt)}</strong>.
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm">
              <strong className="text-warning">Sin confirmar.</strong> Revisa tu cesta y confirma el pedido antes del{" "}
              <strong>{formatCutoff(next.cutoffAt)}</strong>; si no, ese día no te llevamos nada.{" "}
              <Link href={confirmHref} className="font-semibold underline">
                Confirmar
              </Link>
            </p>
          )}
        </>
      ) : (
        <p>Ahora mismo no hay repartos programados para tu día. Te avisaremos.</p>
      )}
    </Card>
  );
}

/** Pago por envío: elegir qué repartos se quieren */
function RequestBanner({
  days,
  feeCents,
  closingDate,
}: {
  days: RequestableDay[];
  feeCents: number;
  closingDate: string | null;
}) {
  return (
    <Card className="border-transparent bg-primary-soft">
      {closingDate && (
        <p className="mb-2 text-sm font-medium text-warning">Estamos preparando el reparto del {formatDay(closingDate)}.</p>
      )}
      <p className="text-sm text-primary">Pago por envío · {formatEuros(feeCents)} por reparto</p>
      <p className="font-semibold">¿Qué días quieres tu cesta?</p>
      <p className="mt-1 text-sm">Pide los repartos que quieras. Puedes pedir o anular hasta la hora de cierre de cada uno.</p>
      {days.length === 0 ? (
        <p className="mt-3 text-sm">Ahora mismo no hay repartos abiertos.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-xl bg-surface">
          {days.map(({ day, requested }) => (
            <li key={day.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div>
                <p className="font-semibold first-letter:uppercase">{formatDay(day.date)}</p>
                <p className="text-xs text-muted">Cierre {formatCutoff(day.cutoff_at)}</p>
              </div>
              <DeliveryRequestToggle dayId={day.id} requested={requested} label={formatDay(day.date)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProductRow({
  product,
  quantity,
  slot,
  subtitle,
  warning,
}: {
  product: Product;
  quantity: number;
  slot: number;
  subtitle?: string;
  warning?: string;
}) {
  return (
    <li>
      <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <ProductImage product={product} className="size-16" />
        <div className="min-w-0 flex-1 basis-32">
          <p className="font-semibold leading-tight">{product.name}</p>
          <p className="text-sm text-muted">{formatUnitPrice(product.price_cents, product.unit)}</p>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          {product.description && <p className="truncate text-xs text-muted">{product.description}</p>}
          {warning && (
            <p className="mt-1">
              <Badge tone="warning">{warning}</Badge>
            </p>
          )}
        </div>
        <div className="ml-auto">
          <QuantityStepper
            productId={product.id}
            productName={product.name}
            unit={product.unit}
            quantity={quantity}
            slot={slot}
          />
        </div>
      </Card>
    </li>
  );
}

/** Reparto que se confirma desde la cesta */
type ToConfirm = { day: DeliveryDay; confirmed: boolean };

function BasketView({
  products,
  basket,
  slot,
  shopName,
  unavailable,
  minOrderCents,
  deliveryFeeCents,
  toConfirm,
}: {
  products: Product[];
  basket: Map<string, number>;
  slot: number;
  shopName: Map<string, string>;
  unavailable: Set<string>;
  minOrderCents: number;
  deliveryFeeCents: number;
  toConfirm: ToConfirm | null;
}) {
  const inBasket = products.filter((p) => basket.has(p.id));
  const retired = basket.size - inBasket.length;
  if (inBasket.length === 0) {
    return (
      <EmptyState icon="🧺" title="Tu cesta está vacía">
        Añade fruta, verdura, pescado o carne desde las pestañas de arriba y después confirma el pedido. La cesta se
        guarda para los siguientes repartos.
      </EmptyState>
    );
  }
  const total = inBasket.reduce((sum, p) => sum + lineTotalCents(basket.get(p.id)!, p.price_cents), 0);

  return (
    <>
      <ul className="space-y-2">
        {CATEGORY_ORDER.flatMap((c) => inBasket.filter((p) => p.category === c)).map((p) => (
          <ProductRow
            key={p.id}
            product={p}
            quantity={basket.get(p.id)!}
            slot={slot}
            subtitle={p.shop_id ? shopName.get(p.shop_id) : undefined}
            warning={unavailable.has(p.id) ? "No lo tiene la tienda de turno del próximo reparto" : undefined}
          />
        ))}
      </ul>
      {retired > 0 && (
        <p className="mt-3 text-sm text-muted">
          {retired === 1 ? "Un producto de tu cesta ya no está" : `${retired} productos de tu cesta ya no están`} a la venta
          y no se incluirá.
        </p>
      )}
      <Card className="mt-4 space-y-1">
        {deliveryFeeCents > 0 && (
          <>
            <div className="flex items-baseline justify-between text-sm">
              <span>Productos</span>
              <span>{formatEuros(total)}</span>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span>Envío</span>
              <span>{formatEuros(deliveryFeeCents)}</span>
            </div>
          </>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Total estimado por reparto</span>
          <span className="text-xl font-bold">{formatEuros(total + deliveryFeeCents)}</span>
        </div>
        <p className="text-sm text-muted">
          IVA incluido. Lo que va al peso se cobra con el peso real cuando te lo entregamos.
          {deliveryFeeCents === 0 && " La cuota de tu plan va aparte."}
        </p>
        {total < minOrderCents && (
          <p className="text-sm font-medium text-warning">
            El pedido mínimo es de {formatEuros(minOrderCents)}. Con menos, ese reparto no se prepara.
          </p>
        )}
      </Card>
      {toConfirm && (
        <ConfirmOrder
          key={toConfirm.day.id}
          dayId={toConfirm.day.id}
          confirmed={toConfirm.confirmed}
          dayLabel={formatDay(toConfirm.day.date)}
          cutoffLabel={formatCutoff(toConfirm.day.cutoff_at)}
          note={deliveryFeeCents > 0 ? `Se suman ${formatEuros(deliveryFeeCents)} de envío.` : undefined}
        />
      )}
    </>
  );
}

function CategoryView({
  category,
  products,
  basket,
  slot,
  shopName,
  unavailable,
}: {
  category: ProductCategory;
  products: Product[];
  basket: Map<string, number>;
  slot: number;
  shopName: Map<string, string>;
  unavailable: Set<string>;
}) {
  if (products.length === 0) {
    return <EmptyState icon={ICONS[category]} title={`Ahora mismo no hay ${CATEGORY_LABELS[category].toLowerCase()} a la venta`} />;
  }
  const warning = (p: Product) => (unavailable.has(p.id) ? "No disponible en el próximo reparto" : undefined);

  if (category !== "carne") {
    return (
      <ul className="space-y-2">
        {products.map((p) => (
          <ProductRow key={p.id} product={p} quantity={basket.get(p.id) ?? 0} slot={slot} warning={warning(p)} />
        ))}
      </ul>
    );
  }
  // La carne se elige por carnicería
  const byShop = Map.groupBy(products, (p) => p.shop_id!);
  return [...byShop.entries()].map(([shopId, items]) => (
    <section key={shopId}>
      <SectionTitle>{shopName.get(shopId)}</SectionTitle>
      <ul className="space-y-2">
        {items.map((p) => (
          <ProductRow key={p.id} product={p} quantity={basket.get(p.id) ?? 0} slot={slot} />
        ))}
      </ul>
    </section>
  ));
}
