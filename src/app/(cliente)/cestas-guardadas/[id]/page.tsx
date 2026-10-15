import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { ProductImage } from "@/components/product-image";
import { ApplyListButton } from "@/components/store/apply-list-button";
import { ProductGrid } from "@/components/store/product-grid";
import { EmptyState, Input, PageSkeleton } from "@/components/ui";
import { deleteList, renameList } from "@/lib/actions/lists";
import { getCustomerContext } from "@/lib/client-context";
import { formatEuros, formatQuantity, lineTotalCents } from "@/lib/domain/money";
import { WEEKDAY_NAMES } from "@/lib/domain/schedule";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { SavedList } from "@/lib/types";

export const metadata: Metadata = { title: "Lista" };

export default function ListPage({ params }: PageProps<"/listas/[id]">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<PageSkeleton />}>
        <ListDetail params={params} />
      </Suspense>
    </div>
  );
}

async function ListDetail({ params }: Pick<PageProps<"/listas/[id]">, "params">) {
  const { id } = await params;
  const ctx = await getCustomerContext();
  const supabase = await createClient();
  const [{ data: list }, { data: items }] = await Promise.all([
    supabase.from("saved_lists").select("*").eq("id", id).maybeSingle<SavedList>(),
    supabase.from("saved_list_items").select("product_id, quantity").eq("list_id", id),
  ]);
  if (!list) notFound();

  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  const lines = (items ?? []).flatMap((i) => {
    const product = byId.get(i.product_id);
    return product ? [{ product, quantity: i.quantity === null ? null : Number(i.quantity) }] : [];
  });
  const retired = (items?.length ?? 0) - lines.length;
  const isBasket = list.kind === "cesta";
  const basketLabel = ctx.dayBaskets ? `tu cesta del ${WEEKDAY_NAMES[ctx.slot]}` : "tu cesta";
  const total = lines.reduce((sum, l) => sum + lineTotalCents(l.quantity ?? 1, l.product.price_cents), 0);

  return (
    <>
      <BackLink href={isBasket ? "/listas?ver=cestas" : "/listas?ver=listas"}>Listas y cestas</BackLink>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">{isBasket ? "Cesta guardada" : "Lista"}</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{list.name}</h1>
          <p className="text-sm text-muted">
            {plural(lines.length, "producto")}
            {isBasket && ` · ${formatEuros(total)} aprox.`}
          </p>
        </div>
        {lines.length > 0 && (
          <ApplyListButton
            listId={list.id}
            kind={list.kind}
            slot={ctx.slot}
            basketLabel={basketLabel}
            className="w-full sm:w-64"
          />
        )}
      </div>

      {lines.length === 0 ? (
        <EmptyState icon="🔖" title="Esta lista está vacía">
          Añade productos con el marcador de su foto, desde Categorías o el buscador.
        </EmptyState>
      ) : isBasket ? (
        <ul className="card-surface divide-y divide-border">
          {lines.map(({ product, quantity }) => (
            <li key={product.id} className="flex items-center gap-4 p-3 sm:p-4">
              <ProductImage product={product} neutral className="size-14" iconClassName="text-3xl" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{product.name}</p>
                <p className="text-sm text-muted">{formatQuantity(quantity ?? 1, product.unit)}</p>
              </div>
              <p className="font-bold tabular-nums">{formatEuros(lineTotalCents(quantity ?? 1, product.price_cents))}</p>
            </li>
          ))}
        </ul>
      ) : (
        <ProductGrid products={lines.map((l) => l.product)} />
      )}
      {retired > 0 && (
        <p className="mt-3 text-sm text-muted">
          {plural(retired, "producto")} de esta lista ya no {retired === 1 ? "está" : "están"} a la venta.
        </p>
      )}

      <div className="mt-10 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
        <ActionForm action={renameList}>
          <input type="hidden" name="id" value={list.id} />
          <Input name="name" defaultValue={list.name} aria-label="Nombre" maxLength={60} required />
          <SubmitButton variant="secondary" className="w-full">
            Cambiar el nombre
          </SubmitButton>
        </ActionForm>
        <form action={deleteList.bind(null, list.id)} className="sm:self-end">
          <ConfirmButton variant="danger" className="w-full" message={`¿Borrar «${list.name}»?`}>
            Borrar {isBasket ? "esta cesta" : "esta lista"}
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
