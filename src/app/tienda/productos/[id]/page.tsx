import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/forms";
import { ProductForm } from "@/components/product-form";
import { Notice, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { proposeProductDeletion } from "@/lib/actions/product-changes";
import { requireShop } from "@/lib/auth";
import { centsToInput, UNIFIED_CATEGORIES_BY_SHOP_TYPE } from "@/lib/catalog";
import { capitalize } from "@/lib/format";
import { loadChanges } from "@/lib/product-changes";
import { createClient } from "@/lib/supabase/server";
import type { Product, Shop } from "@/lib/types";

export const metadata: Metadata = { title: "Proponer un cambio" };

export default function ShopProductPage({ params }: PageProps<"/tienda/productos/[id]">) {
  return (
    <>
      <BackLink href="/tienda/productos">Productos</BackLink>
      <Suspense fallback={<PageSkeleton />}>
        <Editor params={params} />
      </Suspense>
    </>
  );
}

async function Editor({ params }: Pick<PageProps<"/tienda/productos/[id]">, "params">) {
  const { shopId } = await requireShop();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: shop }, { data: product }] = await Promise.all([
    supabase.from("shops").select("*").eq("id", shopId).single<Shop>(),
    supabase.from("products").select("*").eq("id", id).maybeSingle<Product>(),
  ]);
  if (!shop || !product) notFound();
  // La carnicería, sus productos; fruterías y pescaderías, el catálogo común de su tipo
  const allowed =
    shop.type === "carniceria"
      ? product.shop_id === shop.id
      : product.shop_id === null && UNIFIED_CATEGORIES_BY_SHOP_TYPE[shop.type].includes(product.category);
  if (!allowed) notFound();

  const pending = (await loadChanges(supabase, { pending: true, shopId })).find((c) => c.productId === product.id);
  const common = shop.type !== "carniceria";

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={
          common
            ? "Es del catálogo común: si se acepta, cambia para todas las tiendas de tu tipo."
            : "Lo que cambies lo revisa el equipo de LaCistella antes de salir en la tienda."
        }
      />
      {pending && (
        <div className="mb-4">
          <Notice tone="warning" title="Ya tienes un cambio pendiente de revisión">
            {capitalize(pending.summary)}. Si envías otro, sustituye al anterior.
          </Notice>
        </div>
      )}
      <ProductForm
        product={product}
        categories={[product.category]}
        defaultCategory={product.category}
        priceInput={centsToInput(product.price_cents)}
        forShop
      />
      <SectionTitle>Eliminar</SectionTitle>
      <form action={proposeProductDeletion.bind(null, product.id)}>
        <p className="mb-3 text-sm text-muted">
          {common
            ? "Pide que se quite del catálogo. Si solo es que hoy no lo tienes, desmárcalo en «Qué tienes»."
            : "Si solo se ha agotado, mejor márcalo como agotado: así no desaparece de las cestas."}{" "}
          Al eliminarlo se quita de las cestas de los clientes, por eso también se revisa.
        </p>
        <ConfirmButton variant="danger" message={`¿Pedir que se elimine «${product.name}»? Lo revisará el equipo de LaCistella.`}>
          Pedir que se elimine
        </ConfirmButton>
      </form>
    </>
  );
}
