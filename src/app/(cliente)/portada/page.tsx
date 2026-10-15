import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Notice, PageSkeleton } from "@/components/ui";
import { CATEGORY_META } from "@/components/store/catalog-meta";
import { DeliveryBar } from "@/components/store/delivery-bar";
import { ProductGrid } from "@/components/store/product-grid";
import { SeasonHero, StoreSection } from "@/components/store/sections";
import { getClientContext, getUsualProductIds } from "@/lib/client-context";
import { TIME_ZONE } from "@/lib/domain/dates";
import { seasonalGroups, seasonHighlight } from "@/lib/domain/season";

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
  const seasonal = seasonalGroups(ctx.products);
  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  const usual = usualIds.flatMap((id) => byId.get(id) ?? []).slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl">
      <DeliveryBar />

      <StoreSection title="Productos de temporada" subtitle="Lo mejor de cada época en las tiendas de Alzira">
        <SeasonHero highlight={highlight} href={`/categorias/${highlight.category}`} />
        {seasonal.map(({ category, products }) => {
          const group = SEASONAL_GROUPS[category as keyof typeof SEASONAL_GROUPS];
          return (
            <div key={category} className="mt-8">
              <div className="mb-3 flex items-end justify-between gap-3">
                <h3 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
                  <span aria-hidden>{CATEGORY_META[category].icon}</span> {group.title}
                </h3>
                <Link
                  href={`/categorias/${category}`}
                  className="flex shrink-0 items-center gap-1 text-[15px] font-bold text-primary hover:underline"
                >
                  {group.link} <Icon name="chevron" className="size-4" />
                </Link>
              </div>
              <ProductGrid products={products} />
            </div>
          );
        })}
      </StoreSection>

      {usual.length > 0 && (
        <StoreSection title="Tus habituales" subtitle="Lo que más pides" href="/cestas-guardadas?ver=habituales" linkText="Ver todos">
          <ProductGrid products={usual} />
        </StoreSection>
      )}
    </div>
  );
}

const SEASONAL_GROUPS = {
  fruta: { title: "Fruta", link: "Ver toda la fruta" },
  verdura: { title: "Verduras", link: "Ver todas las verduras" },
  pescado: { title: "Pescado", link: "Ver todo el pescado" },
};
