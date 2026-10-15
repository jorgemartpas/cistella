import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CategoryTabs } from "@/components/category-tabs";
import { Icon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { ActiveToggle, AvailabilityToggle, SeasonalToggle } from "@/components/toggles";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { CATEGORY_ORDER, getProducts, getShops } from "@/lib/catalog";
import { formatUnitPrice } from "@/lib/domain/money";
import { CATEGORY_LABELS, shopTypeForCategory, type ProductCategory } from "@/lib/domain/orders";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Catálogo" };

export default function AdminCatalogPage({ searchParams }: PageProps<"/admin/catalogo">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Catalog searchParams={searchParams} />
    </Suspense>
  );
}

async function Catalog({ searchParams }: Pick<PageProps<"/admin/catalogo">, "searchParams">) {
  await requireRole("admin");
  const { categoria } = await searchParams;
  const category: ProductCategory = CATEGORY_ORDER.includes(categoria as ProductCategory)
    ? (categoria as ProductCategory)
    : "fruta";

  const supabase = await createClient();
  const [products, shops, { data: availability }] = await Promise.all([
    getProducts(supabase, { categories: [category] }),
    getShops(supabase),
    supabase.from("shop_availability").select("shop_id, product_id, available"),
  ]);
  const isMeat = category === "carne";
  const shopsOfType = shops.filter((s) => s.type === shopTypeForCategory(category));
  const isAvailable = new Set(
    (availability ?? []).filter((a) => a.available).map((a) => `${a.shop_id}:${a.product_id}`),
  );
  const shopName = new Map(shops.map((s) => [s.id, s.name]));

  return (
    <>
      <PageHeader
        title="Catálogo"
        subtitle={
          isMeat
            ? "La carne la gestiona cada carnicería desde su panel. Aquí puedes corregir lo que haga falta."
            : "Catálogo unificado: tú fijas nombre, foto y precio y qué es de temporada; cada tienda marca si lo tiene."
        }
        action={
          !isMeat && (
            <ButtonLink href={`/admin/catalogo/nuevo?categoria=${category}`} variant="primary" className="shrink-0 px-3">
              <Icon name="plus" /> <span className="sr-only sm:not-sr-only">Nuevo</span>
            </ButtonLink>
          )
        }
      />
      <CategoryTabs categories={CATEGORY_ORDER} current={category} hrefFor={(c) => `/admin/catalogo?categoria=${c}`} />

      {products.length === 0 ? (
        <EmptyState icon="🧺" title={`Aún no hay productos de ${CATEGORY_LABELS[category].toLowerCase()}`}>
          {!isMeat && "Crea el primero con el botón +."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-col gap-3">
                <Link href={`/admin/catalogo/${p.id}`} className="flex items-center gap-3">
                  <ProductImage product={p} className="size-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-sm text-muted">
                      {formatUnitPrice(p.price_cents, p.unit)}
                      {p.shop_id && ` · ${shopName.get(p.shop_id)}`}
                    </p>
                  </div>
                  {!p.active && <Badge tone="warning">Retirado</Badge>}
                  <Icon name="chevron" className="size-5 text-muted" />
                </Link>
                <div className="flex flex-wrap gap-2">
                  {isMeat ? (
                    <ActiveToggle productId={p.id} active={p.active} productName={p.name} />
                  ) : (
                    <>
                      {shopsOfType.map((s) => (
                        <AvailabilityToggle
                          key={s.id}
                          shopId={s.id}
                          productId={p.id}
                          productName={`${p.name} en ${s.name}`}
                          available={isAvailable.has(`${s.id}:${p.id}`)}
                          labelOn={s.name}
                          labelOff={s.name}
                        />
                      ))}
                      <span aria-hidden className="mx-1 w-px self-stretch bg-border" />
                      <SeasonalToggle productId={p.id} seasonal={p.seasonal} productName={p.name} />
                    </>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
