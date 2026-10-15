import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { ApplyListButton } from "@/components/store/apply-list-button";
import { ProductGrid } from "@/components/store/product-grid";
import { Tabs } from "@/components/store/tabs";
import { Badge, EmptyState, Input, PageSkeleton } from "@/components/ui";
import { createSavedBasketForm } from "@/lib/actions/lists";
import { getCustomerContext, getUsualProductIds } from "@/lib/client-context";
import { formatEuros, lineTotalCents, type ProductUnit } from "@/lib/domain/money";
import { WEEKDAY_NAMES } from "@/lib/domain/schedule";
import { plural } from "@/lib/format";
import { defaultQuantity } from "@/lib/saved-baskets";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cestas guardadas" };

const TABS = [
  { key: "cestas", label: "Cestas guardadas", href: "/cestas-guardadas" },
  { key: "habituales", label: "Mis habituales", href: "/cestas-guardadas?ver=habituales" },
];

export default function SavedBasketsPage({ searchParams }: PageProps<"/cestas-guardadas">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<PageSkeleton />}>
        <SavedBasketsTabs searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SavedBasketsTabs({ searchParams }: Pick<PageProps<"/cestas-guardadas">, "searchParams">) {
  const { ver } = await searchParams;
  const current = ver === "habituales" ? "habituales" : "cestas";
  return (
    <>
      <Tabs tabs={TABS} current={current} />
      {current === "cestas" ? <SavedBaskets /> : <Usual />}
    </>
  );
}

async function Usual() {
  const [ctx, ids] = await Promise.all([getCustomerContext(), getUsualProductIds()]);
  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  const products = ids.flatMap((id) => byId.get(id) ?? []);
  if (products.length === 0) {
    return (
      <EmptyState icon="🧺" title="Aún no tienes suficientes compras">
        Cuando te entreguemos tus primeros pedidos, aquí verás los productos que más pides.
      </EmptyState>
    );
  }
  return <ProductGrid products={products} />;
}

async function SavedBaskets() {
  const ctx = await getCustomerContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_lists")
    .select("id, name, auto_delivery, saved_list_items(quantity, products(price_cents, unit, active))")
    .eq("customer_id", ctx.profile.id)
    .order("updated_at", { ascending: false });
  const baskets = (data ?? []) as unknown as {
    id: string;
    name: string;
    auto_delivery: boolean;
    saved_list_items: {
      quantity: number | null;
      products: { price_cents: number; unit: ProductUnit; active: boolean } | null;
    }[];
  }[];
  const basketLabel = ctx.dayBaskets ? `tu cesta del ${WEEKDAY_NAMES[ctx.slot]}` : "tu cesta";

  return (
    <div className="space-y-8">
      <AutoDeliveryExplainer autoName={ctx.autoBasket?.name ?? null} perDelivery={ctx.perDelivery} />

      {baskets.length === 0 ? (
        <EmptyState icon="🧺" title="Aún no tienes cestas guardadas">
          En Mi cesta, pulsa «Guardar esta cesta», o guarda productos con el marcador de su foto.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {baskets.map((basket) => {
            const items = basket.saved_list_items.filter((i) => i.products?.active);
            const total = items.reduce(
              (sum, i) => sum + lineTotalCents(Number(i.quantity ?? defaultQuantity(i.products!.unit)), i.products!.price_cents),
              0,
            );
            return (
              <li key={basket.id} className="card-surface flex flex-col p-4">
                <Link href={`/cestas-guardadas/${basket.id}`} className="group flex items-start gap-3">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xl"
                    aria-hidden
                  >
                    🧺
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold group-hover:underline">{basket.name}</span>
                    <span className="text-sm text-muted">
                      {plural(items.length, "producto")} · {formatEuros(total)} aprox.
                    </span>
                    {basket.auto_delivery && (
                      <span className="mt-1 block">
                        <Badge tone="success">Envío automático</Badge>
                      </span>
                    )}
                  </span>
                  <Icon name="chevron" className="size-5 text-muted" />
                </Link>
                <ApplyListButton
                  listId={basket.id}
                  mode="sustituir"
                  slot={ctx.slot}
                  basketLabel={basketLabel}
                  variant="outline"
                  className="mt-4"
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="card-surface mx-auto max-w-md p-5">
        <h2 className="mb-1 font-bold">Nueva cesta</h2>
        <p className="mb-3 text-sm text-muted">Créala vacía y añade productos con el marcador de su foto.</p>
        <ActionForm action={createSavedBasketForm}>
          <Input name="name" placeholder="Nombre de la cesta" aria-label="Nombre de la cesta" maxLength={60} required />
          <SubmitButton variant="outline" className="w-full" pendingText="Creando…">
            Crear cesta
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

/** Qué son las cestas guardadas y cómo funciona el envío automático */
function AutoDeliveryExplainer({ autoName, perDelivery }: { autoName: string | null; perDelivery: boolean }) {
  return (
    <section className="card-surface grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Icon name="bookmark" className="size-5 text-primary" /> Guarda tus cestas
        </h2>
        <p className="mt-1 text-sm text-muted">
          Guarda la cesta que más repites («Semana normal», «Barbacoa»…) desde Mi cesta, o ve añadiendo productos con
          el marcador de su foto. Después la usas de un toque.
        </p>
      </div>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <span aria-hidden>🔁</span> Envío automático
        </h2>
        <p className="mt-1 text-sm text-muted">
          Elige una cesta guardada y cada reparto de tu plan se prepara solo con ella, sin tener que confirmar. Puedes
          cambiar tu cesta para un reparto concreto o saltarlo; después vuelve a ser la guardada.
        </p>
        <p className="mt-2 text-sm font-semibold">
          {perDelivery
            ? "Con pago por envío pides cada reparto: el envío automático es para los planes con reparto fijo."
            : autoName
              ? `Ahora: envío automático con «${autoName}».`
              : "Ahora: confirmas tú cada pedido. Actívalo dentro de una cesta guardada."}
        </p>
      </div>
    </section>
  );
}
