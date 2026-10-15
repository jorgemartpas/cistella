import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ProductForm } from "@/components/product-form";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { UNIFIED_CATEGORIES_BY_SHOP_TYPE } from "@/lib/catalog";
import type { ProductCategory, ShopType } from "@/lib/domain/orders";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function NewShopProductPage() {
  return (
    <>
      <BackLink href="/tienda/productos">Productos</BackLink>
      <PageHeader title="Nuevo producto" subtitle="Lo revisa el equipo de LaCistella antes de salir en la tienda." />
      <Suspense fallback={<PageSkeleton />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const { shopId } = await requireShop();
  const supabase = await createClient();
  const { data: shop } = await supabase.from("shops").select("type").eq("id", shopId).single();
  const type = (shop?.type ?? "carniceria") as ShopType;
  const categories: ProductCategory[] = type === "carniceria" ? ["carne"] : UNIFIED_CATEGORIES_BY_SHOP_TYPE[type];
  return <ProductForm categories={categories} defaultCategory={categories[0]} forShop />;
}
