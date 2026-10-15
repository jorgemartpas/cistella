import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/forms";
import { ProductForm } from "@/components/product-form";
import { AvailabilityToggle } from "@/components/toggles";
import { Card, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { deleteProduct } from "@/lib/actions/products";
import { requireRole } from "@/lib/auth";
import { centsToInput, getShops } from "@/lib/catalog";
import { shopTypeForCategory } from "@/lib/domain/orders";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Editar producto" };

export default function EditProductPage({ params }: PageProps<"/admin/catalogo/[id]">) {
  return (
    <>
      <BackLink href="/admin/catalogo">Catálogo</BackLink>
      <Suspense fallback={<PageSkeleton />}>
        <Editor params={params} />
      </Suspense>
    </>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/catalogo/[id]">, "params">) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", id).maybeSingle<Product>();
  if (!product) notFound();

  const isMeat = product.category === "carne";
  const [shops, { data: availability }] = await Promise.all([
    getShops(supabase),
    supabase.from("shop_availability").select("shop_id, available").eq("product_id", id),
  ]);
  const available = new Set((availability ?? []).filter((a) => a.available).map((a) => a.shop_id));
  const owner = shops.find((s) => s.id === product.shop_id);

  return (
    <>
      <PageHeader title={product.name} subtitle={isMeat ? `Producto de ${owner?.name}` : "Catálogo unificado"} />
      <ProductForm
        product={product}
        categories={isMeat ? ["carne"] : ["fruta", "verdura", "pescado"]}
        defaultCategory={product.category}
        priceInput={centsToInput(product.price_cents)}
      />

      {!isMeat && (
        <>
          <SectionTitle>¿Quién lo tiene?</SectionTitle>
          <Card className="flex flex-wrap gap-2">
            {shops
              .filter((s) => s.type === shopTypeForCategory(product.category))
              .map((s) => (
                <AvailabilityToggle
                  key={s.id}
                  shopId={s.id}
                  productId={product.id}
                  productName={`${product.name} en ${s.name}`}
                  available={available.has(s.id)}
                  labelOn={s.name}
                  labelOff={s.name}
                />
              ))}
          </Card>
          <p className="mt-2 text-sm text-muted">
            Solo se sirve si la tienda de turno del día de reparto lo tiene marcado.
          </p>
        </>
      )}

      <SectionTitle>Eliminar</SectionTitle>
      <form action={deleteProduct.bind(null, product.id)}>
        <p className="mb-3 text-sm text-muted">
          Se quitará de las cestas de los clientes. Los pedidos ya generados no cambian. Si solo se ha agotado, mejor
          desmárcalo como disponible.
        </p>
        <ConfirmButton variant="danger" message={`¿Eliminar «${product.name}» del catálogo?`}>
          Eliminar producto
        </ConfirmButton>
      </form>
    </>
  );
}
