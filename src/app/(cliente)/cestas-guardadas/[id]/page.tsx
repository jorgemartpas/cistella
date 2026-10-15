import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { ProductImage } from "@/components/product-image";
import { QuantityStepper } from "@/components/quantity-stepper";
import { ApplyListButton } from "@/components/store/apply-list-button";
import { AutoDeliveryToggle } from "@/components/store/auto-delivery-toggle";
import { ButtonLink, EmptyState, Input, PageSkeleton } from "@/components/ui";
import { deleteList, renameList, setSavedBasketQuantity } from "@/lib/actions/lists";
import { getCustomerContext } from "@/lib/client-context";
import { formatEuros, formatUnitPrice, lineTotalCents } from "@/lib/domain/money";
import { WEEKDAY_NAMES } from "@/lib/domain/schedule";
import { plural } from "@/lib/format";
import { defaultQuantity } from "@/lib/saved-baskets";
import { createClient } from "@/lib/supabase/server";
import type { SavedList } from "@/lib/types";

export const metadata: Metadata = { title: "Cesta guardada" };

export default function SavedBasketPage({ params }: PageProps<"/cestas-guardadas/[id]">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<PageSkeleton />}>
        <SavedBasket params={params} />
      </Suspense>
    </div>
  );
}

async function SavedBasket({ params }: Pick<PageProps<"/cestas-guardadas/[id]">, "params">) {
  const { id } = await params;
  const ctx = await getCustomerContext();
  const supabase = await createClient();
  const [{ data: list }, { data: items }] = await Promise.all([
    supabase.from("saved_lists").select("*").eq("id", id).maybeSingle<SavedList>(),
    supabase.from("saved_list_items").select("product_id, quantity").eq("list_id", id),
  ]);
  if (!list) notFound();

  const byId = new Map(ctx.products.map((p) => [p.id, p]));
  const shopName = new Map(ctx.shops.map((s) => [s.id, s.name]));
  const lines = (items ?? []).flatMap((i) => {
    const product = byId.get(i.product_id);
    if (!product) return [];
    return [{ product, quantity: i.quantity === null ? defaultQuantity(product.unit) : Number(i.quantity) }];
  });
  const retired = (items?.length ?? 0) - lines.length;
  const basketLabel = ctx.dayBaskets ? `tu cesta del ${WEEKDAY_NAMES[ctx.slot]}` : "tu cesta";
  const total = lines.reduce((sum, l) => sum + lineTotalCents(l.quantity, l.product.price_cents), 0);
  const saveQuantity = setSavedBasketQuantity.bind(null, list.id);
  const otherAuto = ctx.autoBasket && ctx.autoBasket.id !== list.id ? ctx.autoBasket.name : undefined;

  return (
    <>
      <BackLink href="/cestas-guardadas">Cestas guardadas</BackLink>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-primary">Cesta guardada</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{list.name}</h1>
          <p className="text-sm text-muted">
            {plural(lines.length, "producto")} · {formatEuros(total)} aprox.
          </p>
        </div>
        {lines.length > 0 && (
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <ApplyListButton listId={list.id} mode="sustituir" slot={ctx.slot} basketLabel={basketLabel} />
            <ApplyListButton listId={list.id} mode="añadir" slot={ctx.slot} basketLabel={basketLabel} variant="outline" />
          </div>
        )}
      </div>

      <section className="card-surface mb-8 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <span aria-hidden>🔁</span> Envío automático
          {list.auto_delivery && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-sm text-primary">Activado</span>}
        </h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          Cada reparto de tu plan se prepara solo con esta cesta, sin tener que confirmar. Si cambias algo en Mi cesta,
          vale solo para el reparto siguiente; después vuelve a ser esta. Si un día no lo quieres, lo saltas desde Mi
          cesta. Se cobra como siempre: los productos con el peso real, al entregarlos.
        </p>
        {!ctx.isActive ? (
          <ButtonLink href="/bienvenida" variant="outline" className="w-full sm:w-auto sm:px-6">
            Elige tu plan para activarlo
          </ButtonLink>
        ) : ctx.perDelivery ? (
          <p className="text-sm font-semibold">
            Con pago por envío pides cada reparto: el envío automático es para los planes con reparto fijo (2 veces por
            semana, cada semana o cada 15 días).
          </p>
        ) : (
          <AutoDeliveryToggle listId={list.id} on={list.auto_delivery} otherName={otherAuto} />
        )}
      </section>

      {lines.length === 0 ? (
        <EmptyState icon="🔖" title="Esta cesta está vacía">
          Añade productos con el marcador de su foto, desde Categorías o el buscador.
        </EmptyState>
      ) : (
        <ul className="card-surface divide-y divide-border">
          {lines.map(({ product, quantity }) => (
            <li key={product.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4">
              <ProductImage product={product} neutral className="size-14" iconClassName="text-3xl" />
              <div className="min-w-0 flex-1 basis-40">
                <p className="font-semibold leading-tight">{product.name}</p>
                <p className="text-sm text-muted">
                  {formatUnitPrice(product.price_cents, product.unit)}
                  {product.shop_id && ` · ${shopName.get(product.shop_id)}`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <QuantityStepper
                  productId={product.id}
                  productName={product.name}
                  unit={product.unit}
                  quantity={quantity}
                  action={saveQuantity}
                />
                <p className="w-20 text-right font-bold tabular-nums">
                  {formatEuros(lineTotalCents(quantity, product.price_cents))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {retired > 0 && (
        <p className="mt-3 text-sm text-muted">
          {plural(retired, "producto")} de esta cesta ya no {retired === 1 ? "está" : "están"} a la venta.
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
          <ConfirmButton
            variant="danger"
            className="w-full"
            message={
              list.auto_delivery
                ? `«${list.name}» tiene el envío automático: al borrarla, tendrás que confirmar cada pedido. ¿Borrarla?`
                : `¿Borrar «${list.name}»?`
            }
          >
            Borrar esta cesta
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
