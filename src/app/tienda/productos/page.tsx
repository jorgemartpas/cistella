import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { ActiveToggle, AvailabilityToggle } from "@/components/toggles";
import { ButtonLink, Card, EmptyState, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { getProducts, UNIFIED_CATEGORIES_BY_SHOP_TYPE } from "@/lib/catalog";
import { formatUnitPrice } from "@/lib/domain/money";
import { CATEGORY_LABELS } from "@/lib/domain/orders";
import { createClient } from "@/lib/supabase/server";
import type { Shop } from "@/lib/types";

export const metadata: Metadata = { title: "Productos" };

export default function ShopProductsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopProducts />
    </Suspense>
  );
}

async function ShopProducts() {
  const { shopId } = await requireShop();
  const supabase = await createClient();
  const { data: shop } = await supabase.from("shops").select("*").eq("id", shopId).single<Shop>();
  if (!shop) return null;
  return shop.type === "carniceria" ? <ButcherProducts shop={shop} /> : <UnifiedAvailability shop={shop} />;
}

/** Carnicerías: crean y editan sus propios productos. */
async function ButcherProducts({ shop }: { shop: Shop }) {
  const supabase = await createClient();
  const products = await getProducts(supabase, { shopId: shop.id });
  return (
    <>
      <PageHeader
        title="Tus productos"
        subtitle="Los clientes ven que son de tu carnicería."
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

/** Fruterías y pescaderías: marcan qué productos del catálogo unificado tienen. */
async function UnifiedAvailability({ shop }: { shop: Shop }) {
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
        subtitle="Cistella fija los productos y los precios. Marca lo que tienes: solo te llegarán pedidos de eso los días que te toque."
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
                    <ProductImage product={p} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-sm text-muted">{formatUnitPrice(p.price_cents, p.unit)}</p>
                    </div>
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
