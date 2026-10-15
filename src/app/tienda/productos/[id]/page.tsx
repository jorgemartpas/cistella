import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/forms";
import { ProductForm } from "@/components/product-form";
import { PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { deleteProduct } from "@/lib/actions/products";
import { requireShop } from "@/lib/auth";
import { centsToInput } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Editar producto" };

export default function EditButcherProductPage({ params }: PageProps<"/tienda/productos/[id]">) {
  return (
    <>
      <BackLink href="/tienda/productos">Tus productos</BackLink>
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
  // RLS ya limita a los productos de la tienda; el filtro por shop_id lo deja explícito
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("shop_id", shopId)
    .maybeSingle<Product>();
  if (!product) notFound();

  return (
    <>
      <PageHeader title={product.name} />
      <ProductForm
        product={product}
        categories={["carne"]}
        defaultCategory="carne"
        priceInput={centsToInput(product.price_cents)}
      />
      <SectionTitle>Eliminar</SectionTitle>
      <form action={deleteProduct.bind(null, product.id)}>
        <p className="mb-3 text-sm text-muted">
          Si solo se ha agotado, mejor desmárcalo como disponible: así no desaparece de las cestas.
        </p>
        <ConfirmButton variant="danger" message={`¿Eliminar «${product.name}»?`}>
          Eliminar producto
        </ConfirmButton>
      </form>
    </>
  );
}
