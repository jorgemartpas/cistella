import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { getShops } from "@/lib/catalog";
import { SHOP_TYPE_LABELS, type ShopType } from "@/lib/domain/orders";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tiendas" };

const TYPES: ShopType[] = ["carniceria", "pescaderia", "fruteria"];

export default function ShopsPage() {
  return (
    <>
      <PageHeader
        title="Tiendas"
        action={
          <ButtonLink href="/admin/tiendas/nueva" className="shrink-0 px-3">
            <Icon name="plus" /> <span className="sr-only sm:not-sr-only">Nueva</span>
          </ButtonLink>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <ShopList />
      </Suspense>
    </>
  );
}

async function ShopList() {
  await requireRole("admin");
  const supabase = await createClient();
  const [shops, { data: accounts }] = await Promise.all([
    getShops(supabase),
    supabase.from("profiles").select("shop_id, email").eq("role", "tienda"),
  ]);
  const accountByShop = new Map((accounts ?? []).map((a) => [a.shop_id, a.email]));

  if (shops.length === 0) return <EmptyState icon="🏪" title="Aún no hay tiendas" />;

  return TYPES.map((type) => {
    const ofType = shops.filter((s) => s.type === type);
    return (
      <section key={type}>
        <SectionTitle>{SHOP_TYPE_LABELS[type]}s</SectionTitle>
        {ofType.length === 0 && <p className="text-sm text-muted">Ninguna todavía.</p>}
        <ul className="space-y-2">
          {ofType.map((shop) => (
            <li key={shop.id}>
              <Link href={`/admin/tiendas/${shop.id}`}>
                <Card className="flex items-center gap-3 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{shop.name}</p>
                    <p className="truncate text-sm text-muted">
                      Comisión {String(shop.commission_pct).replace(".", ",")} % ·{" "}
                      {accountByShop.get(shop.id) ?? "sin cuenta de acceso"}
                    </p>
                  </div>
                  {!shop.active && <Badge tone="warning">Inactiva</Badge>}
                  <Icon name="chevron" className="size-5 text-muted" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  });
}
