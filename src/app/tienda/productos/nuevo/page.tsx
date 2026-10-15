import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ProductForm } from "@/components/product-form";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function NewButcherProductPage() {
  return (
    <>
      <BackLink href="/tienda/productos">Tus productos</BackLink>
      <PageHeader title="Nuevo producto" />
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
  if (shop?.type !== "carniceria") redirect("/tienda/productos");
  return <ProductForm categories={["carne"]} defaultCategory="carne" />;
}
