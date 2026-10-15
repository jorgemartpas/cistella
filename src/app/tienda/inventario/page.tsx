import type { Metadata } from "next";
import { Suspense } from "react";
import { InventoryView } from "@/components/inventory-view";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { getShopInventory } from "@/lib/inventory";

export const metadata: Metadata = { title: "Inventario" };

export default function ShopInventoryPage() {
  return (
    <>
      <PageHeader title="Inventario" subtitle="Lo que tienes disponible y lo pedido para tu próximo reparto." />
      <Suspense fallback={<PageSkeleton />}>
        <Inventory />
      </Suspense>
    </>
  );
}

async function Inventory() {
  const { shopId } = await requireShop();
  const data = await getShopInventory(shopId);
  return data ? <InventoryView data={data} /> : null;
}
