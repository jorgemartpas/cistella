import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ProductForm } from "@/components/product-form";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import type { ProductCategory } from "@/lib/domain/orders";

export const metadata: Metadata = { title: "Nuevo producto" };

const UNIFIED: ProductCategory[] = ["fruta", "verdura", "pescado"];

export default function NewUnifiedProductPage({ searchParams }: PageProps<"/admin/catalogo/nuevo">) {
  return (
    <>
      <BackLink href="/admin/catalogo">Catálogo</BackLink>
      <PageHeader title="Nuevo producto" subtitle="Se añade al catálogo unificado. Después, cada tienda marca si lo tiene." />
      <Suspense fallback={<PageSkeleton />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/admin/catalogo/nuevo">, "searchParams">) {
  await requireRole("admin");
  const { categoria } = await searchParams;
  const category = UNIFIED.includes(categoria as ProductCategory) ? (categoria as ProductCategory) : "fruta";
  return <ProductForm categories={UNIFIED} defaultCategory={category} />;
}
