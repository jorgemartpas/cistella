import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageSkeleton, SectionTitle, cx } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { CATEGORY_ORDER, getProducts, getShops } from "@/lib/catalog";
import { closingDayFor, nextDeliveryFor } from "@/lib/delivery";
import { formatEuros, formatUnitPrice, lineTotalCents } from "@/lib/domain/money";
import { CATEGORY_LABELS, type ProductCategory } from "@/lib/domain/orders";
import { FREQUENCY_LABELS } from "@/lib/domain/subscription";
import { formatCutoff, formatDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Product, Subscription } from "@/lib/types";

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
  const { ver } = await searchParams;
  const supabase = await createClient();
  const now = new Date();

  const [{ data: sub }, products, shops, { data: basketRows }, { data: settings }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("customer_id", profile.id).maybeSingle<Subscription>(),
    getProducts(supabase, { onlyActive: true }),
    getShops(supabase),
    supabase.from("basket_items").select("product_id, quantity").eq("customer_id", profile.id),
    supabase.from("settings").select("min_order_cents").single(),
  ]);

  const isActive = sub?.status === "activa";
  const [next, closing] = isActive
    ? await Promise.all([nextDeliveryFor(supabase, sub, now), closingDayFor(supabase, sub, now)])
    : [null, null];
  const { data: unavailableIds } = next?.day
    ? await supabase.rpc("unavailable_on_day", { p_day_id: next.day.id })
    : { data: [] };
  const unavailable = new Set<string>((unavailableIds as string[] | null) ?? []);

  const basket = new Map((basketRows ?? []).map((b) => [b.product_id as string, Number(b.quantity)]));
  const shopName = new Map(shops.map((s) => [s.id, s.name]));
  const view: View =
    ver === "cesta" || CATEGORY_ORDER.includes(ver as ProductCategory)
      ? (ver as View)
      : basket.size > 0
        ? "cesta"
        : "fruta";

  return (
    <>
      <DeliveryBanner sub={sub} next={next} closingDate={closing?.date ?? null} />

      <nav aria-label="Secciones de la cesta" className="-mx-4 mb-4 mt-5 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {(["cesta", ...CATEGORY_ORDER] as View[]).map((v) => (
            <li key={v}>
              <Link
                href={`/cesta?ver=${v}`}
                scroll={false}
                aria-current={v === view ? "page" : undefined}
                className={cx(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold",
                  v === view ? "bg-text text-bg" : "border border-border bg-surface",
                )}
              >
                {v === "cesta" ? (
                  <>
                    <Icon name="basket" className="size-4" /> Mi cesta{basket.size > 0 && ` (${basket.size})`}
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
          shopName={shopName}
          unavailable={unavailable}
          minOrderCents={settings?.min_order_cents ?? 0}
        />
      ) : (
        <CategoryView
          category={view}
          products={products.filter((p) => p.category === view)}
          basket={basket}
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
}: {
  sub: Subscription | null;
  next: Awaited<ReturnType<typeof nextDeliveryFor>>;
  closingDate: string | null;
}) {
  if (!sub || sub.status === "incompleta" || sub.status === "cancelada") {
    return (
      <Card className="bg-accent-soft border-transparent">
        <p className="font-semibold">Aún no tienes la suscripción activa</p>
        <p className="mt-1 text-sm">Puedes ir montando la cesta. Para recibirla, completa el alta.</p>
        <ButtonLink href="/bienvenida" className="mt-3 w-full">
          Completar el alta
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
          <p className="mt-1 text-sm">
            Puedes cambiar la cesta hasta el <strong>{formatCutoff(next.cutoffAt)}</strong>.
          </p>
        </>
      ) : (
        <p>Ahora mismo no hay repartos programados para tu día. Te avisaremos.</p>
      )}
    </Card>
  );
}

function ProductRow({
  product,
  quantity,
  subtitle,
  warning,
}: {
  product: Product;
  quantity: number;
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
          <QuantityStepper productId={product.id} productName={product.name} unit={product.unit} quantity={quantity} />
        </div>
      </Card>
    </li>
  );
}

function BasketView({
  products,
  basket,
  shopName,
  unavailable,
  minOrderCents,
}: {
  products: Product[];
  basket: Map<string, number>;
  shopName: Map<string, string>;
  unavailable: Set<string>;
  minOrderCents: number;
}) {
  const inBasket = products.filter((p) => basket.has(p.id));
  const retired = basket.size - inBasket.length;
  if (inBasket.length === 0) {
    return (
      <EmptyState icon="🧺" title="Tu cesta está vacía">
        Añade fruta, verdura, pescado o carne desde las pestañas de arriba. Se repetirá sola en cada reparto.
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
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Total estimado por reparto</span>
          <span className="text-xl font-bold">{formatEuros(total)}</span>
        </div>
        <p className="text-sm text-muted">
          IVA incluido. Lo que va al peso se cobra con el peso real cuando te lo entregamos. La cuota de la suscripción va
          aparte.
        </p>
        {total < minOrderCents && (
          <p className="text-sm font-medium text-warning">
            El pedido mínimo es de {formatEuros(minOrderCents)}. Con menos, ese reparto no se prepara.
          </p>
        )}
      </Card>
    </>
  );
}

function CategoryView({
  category,
  products,
  basket,
  shopName,
  unavailable,
}: {
  category: ProductCategory;
  products: Product[];
  basket: Map<string, number>;
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
          <ProductRow key={p.id} product={p} quantity={basket.get(p.id) ?? 0} warning={warning(p)} />
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
          <ProductRow key={p.id} product={p} quantity={basket.get(p.id) ?? 0} />
        ))}
      </ul>
    </section>
  ));
}
