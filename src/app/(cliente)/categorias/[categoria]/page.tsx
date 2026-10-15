import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CATEGORY_META } from "@/components/store/catalog-meta";
import { DeliveryBar } from "@/components/store/delivery-bar";
import { ProductGrid } from "@/components/store/product-grid";
import { EmptyState, PageSkeleton, cx } from "@/components/ui";
import { CATEGORY_ORDER } from "@/lib/catalog";
import { getClientContext } from "@/lib/client-context";
import type { ProductCategory } from "@/lib/domain/orders";
import { splitBySeason } from "@/lib/domain/season";

export async function generateMetadata({ params }: PageProps<"/categorias/[categoria]">): Promise<Metadata> {
  const { categoria } = await params;
  return { title: CATEGORY_META[categoria as ProductCategory]?.title ?? "Categorías" };
}

export default function CategoryPage({ params }: PageProps<"/categorias/[categoria]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Category params={params} />
    </Suspense>
  );
}

async function Category({ params }: Pick<PageProps<"/categorias/[categoria]">, "params">) {
  const { categoria } = await params;
  if (!CATEGORY_ORDER.includes(categoria as ProductCategory)) notFound();
  const category = categoria as ProductCategory;
  const ctx = await getClientContext();
  const meta = CATEGORY_META[category];
  const products = ctx.products.filter((p) => p.category === category);
  const count = (c: ProductCategory) => ctx.products.filter((p) => p.category === c).length;
  // Primero lo de temporada (lo marca el admin) y, separado, lo de todo el año
  const { seasonal, yearRound } = splitBySeason(products);

  // La carne de todo el año, agrupada por carnicería
  const groups =
    category === "carne"
      ? ctx.shops
          .filter((s) => s.type === "carniceria" && s.active)
          .map((s) => ({ title: s.name, products: yearRound.filter((p) => p.shop_id === s.id) }))
          .filter((g) => g.products.length > 0)
      : [{ title: null, products: yearRound }];
  const GroupTitle = seasonal.length > 0 ? "h3" : "h2";

  return (
    <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-8">
      <nav aria-label="Categorías" className="-mx-4 -mt-2 mb-1 overflow-x-auto px-4 pb-4 pt-2 md:mx-0 md:mb-0 md:overflow-visible md:px-0">
        <ul className="flex gap-2 md:sticky md:top-24 md:flex-col md:gap-0.5">
          {CATEGORY_ORDER.map((c) => (
            <li key={c}>
              <Link
                href={`/categorias/${c}`}
                aria-current={c === category ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] font-semibold md:px-4",
                  c === category
                    ? "bg-primary font-bold text-primary-ink shadow-[0_10px_22px_-12px_rgb(18_132_63/0.8)]"
                    : "bg-surface shadow-sm md:bg-transparent md:shadow-none md:hover:bg-surface",
                )}
              >
                <span aria-hidden>{CATEGORY_META[c].icon}</span>
                {CATEGORY_META[c].title}
                <span className="ml-auto hidden text-sm font-normal opacity-70 md:inline">{count(c)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">
        <DeliveryBar />
        <h1 className="text-3xl font-extrabold tracking-tight">{meta.title}</h1>
        <p className="mb-6 mt-0.5 text-sm text-muted">{meta.subtitle}</p>
        {products.length === 0 ? (
          <EmptyState icon={meta.icon} title={`Ahora mismo no hay ${meta.title.toLowerCase()} a la venta`} />
        ) : (
          <>
            {seasonal.length > 0 && (
              <section aria-labelledby="de-temporada" className="mb-10">
                <h2 id="de-temporada" className="mb-1 flex items-center gap-2 text-xl font-extrabold tracking-tight">
                  <span aria-hidden>🌿</span> De temporada
                </h2>
                <p className="mb-4 text-sm text-muted">Lo mejor de ahora, en su momento.</p>
                <ProductGrid products={seasonal} />
              </section>
            )}
            {yearRound.length > 0 && (
              <div className={seasonal.length > 0 ? "border-t border-border pt-8" : undefined}>
                {seasonal.length > 0 && <h2 className="mb-4 text-xl font-extrabold tracking-tight">Todo el año</h2>}
                {groups.map((group) => (
                  <section key={group.title ?? category} className="mb-8">
                    {group.title && <GroupTitle className="mb-4 text-lg font-bold">{group.title}</GroupTitle>}
                    <ProductGrid products={group.products} />
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
