import type { Metadata } from "next";
import Form from "next/form";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { ProductGrid } from "@/components/store/product-grid";
import { EmptyState, PageSkeleton } from "@/components/ui";
import { getClientContext } from "@/lib/client-context";
import { CATEGORY_LABELS } from "@/lib/domain/orders";

export const metadata: Metadata = { title: "Buscar" };

/** Sin acentos ni mayúsculas, para buscar «platano» y encontrar «Plátano» */
const simplify = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export default function SearchPage({ searchParams }: PageProps<"/buscar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Search searchParams={searchParams} />
    </Suspense>
  );
}

async function Search({ searchParams }: Pick<PageProps<"/buscar">, "searchParams">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const ctx = await getClientContext();
  const shopName = new Map(ctx.shops.map((s) => [s.id, s.name]));
  const words = simplify(query).split(/\s+/).filter(Boolean);
  const results = words.length
    ? ctx.products.filter((p) => {
        const haystack = simplify(
          [p.name, p.description ?? "", CATEGORY_LABELS[p.category], p.shop_id ? (shopName.get(p.shop_id) ?? "") : ""].join(" "),
        );
        return words.every((w) => haystack.includes(w));
      })
    : [];

  return (
    <div className="mx-auto max-w-5xl">
      <Form action="/buscar" role="search" className="relative mb-6 md:hidden">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Buscar productos"
          aria-label="Buscar productos"
          autoFocus={!query}
          className="h-12 w-full rounded-full border border-border bg-surface-2 pl-11 pr-4 placeholder:text-muted focus:border-primary focus:bg-surface"
        />
      </Form>
      {query && (
        <h1 className="mb-6 text-2xl font-bold">
          {results.length > 0 ? `Resultados para «${query}»` : `No hemos encontrado «${query}»`}
        </h1>
      )}
      {results.length > 0 ? (
        <ProductGrid products={results} />
      ) : query ? (
        <EmptyState icon="🔍" title="Prueba con otra palabra">
          Busca por producto (naranjas, merluza…), por categoría o por el nombre de la carnicería.
        </EmptyState>
      ) : (
        <EmptyState icon="🔍" title="¿Qué estás buscando?">
          Escribe el nombre de un producto, una categoría o una carnicería.
        </EmptyState>
      )}
    </div>
  );
}
