import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { ApplyListButton } from "@/components/store/apply-list-button";
import { ProductGrid } from "@/components/store/product-grid";
import { Tabs } from "@/components/store/tabs";
import { EmptyState, Input, PageSkeleton } from "@/components/ui";
import { createListForm } from "@/lib/actions/lists";
import { getClientContext, getUsualProductIds } from "@/lib/client-context";
import { formatEuros, lineTotalCents } from "@/lib/domain/money";
import { WEEKDAY_NAMES } from "@/lib/domain/schedule";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Listas y cestas" };

const TABS = [
  { key: "habituales", label: "Mis habituales", href: "/listas" },
  { key: "listas", label: "Listas", href: "/listas?ver=listas" },
  { key: "cestas", label: "Cestas guardadas", href: "/listas?ver=cestas" },
];

export default function ListsPage({ searchParams }: PageProps<"/listas">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<PageSkeleton />}>
        <Lists searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Lists({ searchParams }: Pick<PageProps<"/listas">, "searchParams">) {
  const { ver } = await searchParams;
  const current = ver === "listas" || ver === "cestas" ? ver : "habituales";
  return (
    <>
      <Tabs tabs={TABS} current={current} />
      {current === "habituales" && <Usual />}
      {current === "listas" && <SavedLists />}
      {current === "cestas" && <SavedBaskets />}
    </>
  );
}

async function Usual() {
  const [ctx, ids] = await Promise.all([getClientContext(), getUsualProductIds()]);
  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  const products = ids.flatMap((id) => byId.get(id) ?? []);
  if (products.length === 0) {
    return (
      <EmptyState icon="🧺" title="Aún no tienes suficientes compras">
        Cuando recibas tus pedidos, aquí verás los productos que pides con más frecuencia.
      </EmptyState>
    );
  }
  return <ProductGrid products={products} />;
}

async function SavedLists() {
  const ctx = await getClientContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_lists")
    .select("id, name, saved_list_items(count)")
    .eq("customer_id", ctx.profile.id)
    .eq("kind", "lista")
    .order("updated_at", { ascending: false });
  const lists = (data ?? []) as { id: string; name: string; saved_list_items: { count: number }[] }[];

  return (
    <div className="space-y-6">
      {lists.length === 0 ? (
        <EmptyState icon="🔖" title="Aún no tienes listas">
          Guarda productos con el marcador de su foto, o crea una lista aquí: «Para el cocido», «Desayunos»…
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/listas/${list.id}`}
                className="card-surface flex items-center gap-3 p-4 hover:ring-2 hover:ring-primary-soft"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon name="bookmark" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{list.name}</span>
                  <span className="text-sm text-muted">{plural(list.saved_list_items[0]?.count ?? 0, "producto")}</span>
                </span>
                <Icon name="chevron" className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="card-surface mx-auto max-w-md p-5">
        <h2 className="mb-3 font-bold">Nueva lista</h2>
        <ActionForm action={createListForm}>
          <Input name="name" placeholder="Nombre de la lista" aria-label="Nombre de la lista" maxLength={60} required />
          <SubmitButton variant="outline" className="w-full" pendingText="Creando…">
            Crear lista
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

async function SavedBaskets() {
  const ctx = await getClientContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_lists")
    .select("id, name, saved_list_items(quantity, products(price_cents, active))")
    .eq("customer_id", ctx.profile.id)
    .eq("kind", "cesta")
    .order("updated_at", { ascending: false });
  const baskets = (data ?? []) as unknown as {
    id: string;
    name: string;
    saved_list_items: { quantity: number | null; products: { price_cents: number; active: boolean } | null }[];
  }[];
  const basketLabel = ctx.dayBaskets ? `tu cesta del ${WEEKDAY_NAMES[ctx.slot]}` : "tu cesta";

  if (baskets.length === 0) {
    return (
      <EmptyState icon="🧺" title="Aún no has guardado ninguna cesta">
        En Mi cesta, pulsa «Guardar esta cesta» para tenerla a mano y volver a usarla cuando quieras.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {baskets.map((basket) => {
        const items = basket.saved_list_items.filter((i) => i.products?.active);
        const total = items.reduce((sum, i) => sum + lineTotalCents(Number(i.quantity ?? 1), i.products!.price_cents), 0);
        return (
          <li key={basket.id} className="card-surface flex flex-col p-4">
            <Link href={`/listas/${basket.id}`} className="group flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cart text-xl" aria-hidden>
                🧺
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold group-hover:underline">{basket.name}</span>
                <span className="text-sm text-muted">
                  {plural(items.length, "producto")} · {formatEuros(total)} aprox.
                </span>
              </span>
            </Link>
            <ApplyListButton
              listId={basket.id}
              kind="cesta"
              slot={ctx.slot}
              basketLabel={basketLabel}
              variant="outline"
              className="mt-4"
            />
          </li>
        );
      })}
    </ul>
  );
}
