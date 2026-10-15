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

  // La carne, agrupada por carnicería
  const groups =
    category === "carne"
      ? ctx.shops
          .filter((s) => s.type === "carniceria" && s.active)
          .map((s) => ({ title: s.name, products: products.filter((p) => p.shop_id === s.id) }))
          .filter((g) => g.products.length > 0)
      : [{ title: null, products }];

  return (
    <div className="md:grid md:grid-cols-[13rem_1fr] md:gap-8">
      <nav aria-label="Categorías" className="-mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:mb-0 md:px-0">
        <ul className="flex gap-2 md:sticky md:top-24 md:flex-col md:gap-0.5">
          {CATEGORY_ORDER.map((c) => (
            <li key={c}>
              <Link
                href={`/categorias/${c}`}
                aria-current={c === category ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[15px] md:rounded-lg md:px-3 md:py-2.5",
                  c === category
                    ? "bg-primary-soft font-bold text-primary"
                    : "border border-border md:border-transparent md:hover:bg-surface-2",
                )}
              >
                <span aria-hidden>{CATEGORY_META[c].icon}</span>
                {CATEGORY_META[c].title}
                <span className="ml-auto hidden text-sm font-normal text-muted md:inline">{count(c)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">
        <DeliveryBar />
        <h1 className="text-2xl font-bold">{meta.title}</h1>
        <p className="mb-6 mt-0.5 text-sm text-muted">{meta.subtitle}</p>
        {products.length === 0 ? (
          <EmptyState icon={meta.icon} title={`Ahora mismo no hay ${meta.title.toLowerCase()} a la venta`} />
        ) : (
          groups.map((group) => (
            <section key={group.title ?? category} className="mb-8">
              {group.title && <h2 className="mb-4 text-lg font-bold">{group.title}</h2>}
              <ProductGrid products={group.products} />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
