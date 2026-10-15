import type { Metadata } from "next";
import { Suspense } from "react";
import { Notice, PageSkeleton } from "@/components/ui";
import { CATEGORY_META } from "@/components/store/catalog-meta";
import { DeliveryBar } from "@/components/store/delivery-bar";
import { ProductGrid } from "@/components/store/product-grid";
import { SeasonHero, StoreSection } from "@/components/store/sections";
import { CATEGORY_ORDER } from "@/lib/catalog";
import { getClientContext, getUsualProductIds } from "@/lib/client-context";
import { TIME_ZONE } from "@/lib/domain/dates";
import { seasonHighlight } from "@/lib/domain/season";

export const metadata: Metadata = { title: "Inicio" };

// Portada del cliente con sesión iniciada: el proxy reescribe "/" a esta página
export default function StoreHomePage({ searchParams }: PageProps<"/portada">) {
  return (
    <>
      <Suspense>
        <DeletedAccountNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<PageSkeleton />}>
        <StoreHome />
      </Suspense>
    </>
  );
}

/** Aviso tras eliminar la cuenta (Mi cuenta → Datos personales) */
async function DeletedAccountNotice({ searchParams }: Pick<PageProps<"/portada">, "searchParams">) {
  const { cuenta } = await searchParams;
  if (cuenta !== "eliminada") return null;
  return (
    <div className="mx-auto mb-6 max-w-5xl">
      <Notice tone="success" title="Tu cuenta se ha eliminado">
        Hemos cancelado tu cuota y borrado tus datos. Gracias por haber confiado en las tiendas de Alzira.
      </Notice>
    </div>
  );
}

async function StoreHome() {
  const [ctx, usualIds] = await Promise.all([getClientContext(), getUsualProductIds()]);
  const month = Number(new Intl.DateTimeFormat("en", { month: "numeric", timeZone: TIME_ZONE }).format(new Date()));
  const highlight = seasonHighlight(month);
  const newest = [...ctx.products]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.name.localeCompare(b.name, "es"))
    .slice(0, 4);
  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  const usual = usualIds.flatMap((id) => byId.get(id) ?? []).slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl">
      <DeliveryBar />

      <StoreSection title="Productos del momento" subtitle="Lo mejor de la temporada en las tiendas de Alzira">
        <SeasonHero highlight={highlight} href={`/categorias/${highlight.category}`} />
      </StoreSection>

      {usual.length > 0 && (
        <StoreSection title="Tus habituales" subtitle="Lo que más pides" href="/cestas-guardadas?ver=habituales" linkText="Ver todos">
          <ProductGrid products={usual} />
        </StoreSection>
      )}

      <StoreSection
        title="Novedades"
        subtitle="Productos recién añadidos o mejorados"
        href="/categorias"
        linkText="Ver todo el catálogo"
      >
        <ProductGrid products={newest} />
      </StoreSection>

      {CATEGORY_ORDER.map((category) => {
        const products = ctx.products.filter((p) => p.category === category).slice(0, 4);
        if (products.length === 0) return null;
        const meta = CATEGORY_META[category];
        return (
          <StoreSection
            key={category}
            title={meta.home}
            subtitle={meta.subtitle}
            href={`/categorias/${category}`}
            linkText={`Ver ${meta.title.toLowerCase()}`}
          >
            <ProductGrid products={products} />
          </StoreSection>
        );
      })}
    </div>
  );
}
