import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { ActiveToggle, AvailabilityToggle } from "@/components/toggles";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { cancelProductChange } from "@/lib/actions/product-changes";
import { requireShop } from "@/lib/auth";
import { getProducts, UNIFIED_CATEGORIES_BY_SHOP_TYPE } from "@/lib/catalog";
import { formatUnitPrice } from "@/lib/domain/money";
import { CATEGORY_LABELS } from "@/lib/domain/orders";
import { capitalize, formatCutoff } from "@/lib/format";
import { loadChanges, type ChangeView } from "@/lib/product-changes";
import { createClient } from "@/lib/supabase/server";
import type { Shop } from "@/lib/types";

export const metadata: Metadata = { title: "Productos" };

export default function ShopProductsPage({ searchParams }: PageProps<"/tienda/productos">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopProducts searchParams={searchParams} />
    </Suspense>
  );
}

async function ShopProducts({ searchParams }: Pick<PageProps<"/tienda/productos">, "searchParams">) {
  const { shopId } = await requireShop();
  const { enviado } = await searchParams;
  const supabase = await createClient();
  const [{ data: shop }, pending, reviewed] = await Promise.all([
    supabase.from("shops").select("*").eq("id", shopId).single<Shop>(),
    loadChanges(supabase, { pending: true, shopId }),
    loadChanges(supabase, { pending: false, shopId, limit: 10 }),
  ]);
  if (!shop) return null;
  const pendingByProduct = new Set(pending.map((c) => c.productId).filter(Boolean));
  // Los revisados de los últimos 30 días
  const monthAgo = new Date(new Date().getTime() - 30 * 86_400_000).toISOString();
  const recent = reviewed.filter((c) => c.reviewedAt && c.reviewedAt >= monthAgo);

  return (
    <>
      {enviado === "1" && (
        <div className="mb-4">
          <Notice tone="success" title="Enviado: pendiente de revisión">
            El equipo de LaCistella lo revisará. Hasta que lo acepte, la tienda online sigue como está.
          </Notice>
        </div>
      )}
      {shop.type === "carniceria" ? (
        <ButcherProducts shop={shop} pendingByProduct={pendingByProduct} />
      ) : (
        <UnifiedAvailability shop={shop} pendingByProduct={pendingByProduct} />
      )}
      {(pending.length > 0 || recent.length > 0) && <YourChanges pending={pending} recent={recent} />}
    </>
  );
}

function PendingBadge() {
  return <Badge tone="warning">Pendiente de revisión</Badge>;
}

/** Carnicerías: sus propios productos. Los cambios importantes pasan por revisión; disponible/agotado, no. */
async function ButcherProducts({ shop, pendingByProduct }: { shop: Shop; pendingByProduct: Set<string | null> }) {
  const supabase = await createClient();
  const products = await getProducts(supabase, { shopId: shop.id });
  return (
    <>
      <PageHeader
        title="Tus productos"
        subtitle="Los clientes ven que son de tu carnicería. Los cambios de nombre, precio o foto y los productos nuevos los revisa el equipo de LaCistella; «Disponible» o «Agotado» se cambia al momento."
        action={
          <ButtonLink href="/tienda/productos/nuevo" className="shrink-0 px-3">
            <Icon name="plus" /> <span className="sr-only sm:not-sr-only">Nuevo</span>
          </ButtonLink>
        }
      />
      {products.length === 0 ? (
        <EmptyState icon="🥩" title="Aún no tienes productos">
          Añade el primero con el botón +. Hamburguesas, embutidos, cortes…
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => (
            <li key={p.id}>
              <Card className="flex items-center gap-3">
                <Link href={`/tienda/productos/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <ProductImage product={p} className="size-14" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-sm text-muted">{formatUnitPrice(p.price_cents, p.unit)}</p>
                    {pendingByProduct.has(p.id) && <PendingBadge />}
                  </div>
                </Link>
                <ActiveToggle productId={p.id} active={p.active} productName={p.name} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Fruterías y pescaderías: marcan qué tienen del catálogo común y pueden proponer cambios en él. */
async function UnifiedAvailability({ shop, pendingByProduct }: { shop: Shop; pendingByProduct: Set<string | null> }) {
  const supabase = await createClient();
  const categories = UNIFIED_CATEGORIES_BY_SHOP_TYPE[shop.type];
  const [products, { data: availability }] = await Promise.all([
    getProducts(supabase, { categories, onlyActive: true }),
    supabase.from("shop_availability").select("product_id, available").eq("shop_id", shop.id),
  ]);
  const available = new Set((availability ?? []).filter((a) => a.available).map((a) => a.product_id));
  const missing = products.filter((p) => !available.has(p.id)).length;

  return (
    <>
      <PageHeader
        title="Qué tienes"
        subtitle="Marca lo que tienes: solo te llegarán pedidos de eso los días que te toque. Si un precio, un nombre o una foto no está bien, o falta un producto, propón el cambio: lo revisa el equipo de LaCistella."
        action={
          <ButtonLink href="/tienda/productos/nuevo" className="shrink-0 px-3">
            <Icon name="plus" /> <span className="sr-only sm:not-sr-only">Proponer producto</span>
          </ButtonLink>
        }
      />
      {missing > 0 && (
        <p className="mb-2 text-sm font-medium text-warning">
          {missing === 1 ? "1 producto marcado" : `${missing} productos marcados`} como que no lo tienes.
        </p>
      )}
      {products.length === 0 && <EmptyState icon="🧺" title="El catálogo aún está vacío" />}
      {categories.map((category) => {
        const ofCategory = products.filter((p) => p.category === category);
        if (ofCategory.length === 0) return null;
        return (
          <section key={category}>
            <SectionTitle>{CATEGORY_LABELS[category]}</SectionTitle>
            <ul className="space-y-2">
              {ofCategory.map((p) => (
                <li key={p.id}>
                  <Card className="flex items-center gap-3 py-3">
                    <Link
                      href={`/tienda/productos/${p.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                      aria-label={`${p.name}: proponer un cambio`}
                    >
                      <ProductImage product={p} className="size-12" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="text-sm text-muted">{formatUnitPrice(p.price_cents, p.unit)}</p>
                        {pendingByProduct.has(p.id) && <PendingBadge />}
                      </div>
                    </Link>
                    <AvailabilityToggle
                      shopId={shop.id}
                      productId={p.id}
                      productName={p.name}
                      available={available.has(p.id)}
                    />
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** Lo que la tienda ha propuesto: pendiente (se puede retirar) y lo revisado hace poco. */
function YourChanges({ pending, recent }: { pending: ChangeView[]; recent: ChangeView[] }) {
  return (
    <section className="mt-8">
      <SectionTitle>Tus cambios</SectionTitle>
      <ul className="card-surface divide-y divide-border">
        {pending.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{capitalize(c.summary)}</p>
              <p className="text-muted">Enviado el {formatCutoff(c.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <PendingBadge />
              <form action={cancelProductChange.bind(null, c.id)}>
                <ConfirmButton variant="ghost" className="min-h-9 px-3 py-1 text-sm" message="¿Retirar este cambio?">
                  Retirar
                </ConfirmButton>
              </form>
            </div>
          </li>
        ))}
        {recent.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{capitalize(c.summary)}</p>
              {c.reviewNote && <p className="text-muted">Motivo: «{c.reviewNote}»</p>}
            </div>
            <Badge tone={c.status === "aprobado" ? "success" : "danger"}>
              {c.status === "aprobado" ? "Aceptado" : "Rechazado"}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
