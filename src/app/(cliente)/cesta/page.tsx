import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AutoOrder, ConfirmOrder } from "@/components/confirm-order";
import { DeliveryRequestToggle } from "@/components/delivery-request-toggle";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { QuantityStepper } from "@/components/quantity-stepper";
import { DeliveryBar } from "@/components/store/delivery-bar";
import { ButtonLink, EmptyState, Input, Notice, PageSkeleton } from "@/components/ui";
import { saveBasket } from "@/lib/actions/lists";
import { CATEGORY_ORDER } from "@/lib/catalog";
import { getClientContext } from "@/lib/client-context";
import type { RequestableDay } from "@/lib/delivery";
import { formatEuros, formatUnitPrice, lineTotalCents } from "@/lib/domain/money";
import type { ProductCategory } from "@/lib/domain/orders";
import { WEEKDAY_NAMES } from "@/lib/domain/schedule";
import { formatCutoff, formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Mi cesta" };

export default function BasketPage({ searchParams }: PageProps<"/cesta">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Basket searchParams={searchParams} />
    </Suspense>
  );
}

async function Basket({ searchParams }: Pick<PageProps<"/cesta">, "searchParams">) {
  // Enlaces antiguos a las pestañas de categorías de la cesta
  const { ver, confirmar } = await searchParams;
  if (CATEGORY_ORDER.includes(ver as ProductCategory)) redirect(`/categorias/${ver}`);

  const ctx = await getClientContext();
  const hasPlan = Boolean(ctx.sub && ["activa", "pausada", "impagada"].includes(ctx.sub.status));
  // Venía a confirmar y acaba de entrar sin plan: a elegirlo (y vuelve aquí con el pedido confirmado)
  if (confirmar === "1" && ctx.profile && !hasPlan) redirect("/bienvenida?confirmar=1");
  const shopName = new Map(ctx.shops.map((s) => [s.id, s.name]));
  const inBasket = CATEGORY_ORDER.flatMap((c) => ctx.products.filter((p) => p.category === c && ctx.basket.has(p.id)));
  const retired = ctx.basket.size - inBasket.length;
  const feeCents = ctx.perDelivery ? (ctx.settings?.delivery_fee_cents ?? 0) : 0;
  const minOrderCents = ctx.settings?.min_order_cents ?? 0;
  const dayName = ctx.dayBaskets ? WEEKDAY_NAMES[ctx.slot] : null;

  return (
    <div className="mx-auto max-w-5xl">
      <DeliveryBar />
      <h1 className="text-3xl font-extrabold tracking-tight">{dayName ? `Mi cesta del ${dayName}` : "Mi cesta"}</h1>
      <p className="mb-6 mt-0.5 text-sm text-muted">
        {ctx.toConfirm?.auto
          ? "Se guarda sola. Con el envío automático, cada reparto se prepara solo con ella."
          : "Se guarda sola. Antes de cada reparto, revísala y confirma el pedido."}
      </p>
      {confirmar === "1" && ctx.isActive && (
        <div className="mb-6">
          <Notice tone="success" title="¡Bienvenida a Cistella! Tu plan ya está activo.">
            Confirmamos tu primer pedido con esta cesta. Puedes seguir cambiándola hasta la hora de cierre.
          </Notice>
        </div>
      )}

      {ctx.perDelivery && ctx.isActive && <RequestDays days={ctx.requestable} feeCents={feeCents} />}

      {inBasket.length === 0 ? (
        <EmptyState icon="🧺" title="Tu cesta está vacía">
          <p>Añade fruta, verdura, pescado o carne de las tiendas de Alzira.</p>
          <ButtonLink href="/categorias" variant="outline" className="mt-5 min-h-10 px-5 py-2 text-[15px]">
            Empezar a comprar
          </ButtonLink>
        </EmptyState>
      ) : (
        <div className="md:grid md:grid-cols-[1fr_20rem] md:items-start md:gap-8">
          <div>
            <ul className="card-surface divide-y divide-border">
              {inBasket.map((product) => {
                const quantity = ctx.basket.get(product.id)!;
                return (
                  <li key={product.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4">
                    <ProductImage product={product} neutral className="size-16 sm:size-20" iconClassName="text-4xl" />
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="font-semibold leading-tight">{product.name}</p>
                      <p className="text-sm text-muted">
                        {formatUnitPrice(product.price_cents, product.unit)}
                        {product.shop_id && ` · ${shopName.get(product.shop_id)}`}
                      </p>
                      {ctx.unavailable.has(product.id) && (
                        <p className="text-xs font-medium text-warning">
                          No lo tiene la tienda de turno del próximo reparto
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <QuantityStepper
                        productId={product.id}
                        productName={product.name}
                        unit={product.unit}
                        quantity={quantity}
                        slot={ctx.slot}
                      />
                      <p className="w-20 text-right font-bold tabular-nums">
                        {formatEuros(lineTotalCents(quantity, product.price_cents))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {retired > 0 && (
              <p className="mt-3 text-sm text-muted">
                {retired === 1 ? "Un producto de tu cesta ya no está" : `${retired} productos de tu cesta ya no están`}{" "}
                a la venta y no se incluirá.
              </p>
            )}
            <Link
              href="/categorias"
              className="mt-4 inline-flex items-center gap-1 text-[15px] font-semibold text-primary hover:underline"
            >
              <Icon name="back" className="size-4" /> Seguir comprando
            </Link>
          </div>

          <aside className="mt-6 space-y-4 md:sticky md:top-24 md:mt-0">
            <div className="card-surface p-5">
              <h2 className="mb-3 text-lg font-bold">Resumen</h2>
              <dl className="space-y-1.5 text-[15px]">
                <div className="flex justify-between">
                  <dt>Productos ({inBasket.length})</dt>
                  <dd className="tabular-nums">{formatEuros(ctx.basketTotalCents)}</dd>
                </div>
                {feeCents > 0 && (
                  <div className="flex justify-between">
                    <dt>Envío</dt>
                    <dd className="tabular-nums">{formatEuros(feeCents)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-lg font-bold">
                  <dt>Total estimado</dt>
                  <dd className="tabular-nums">{formatEuros(ctx.basketTotalCents + feeCents)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted">
                IVA incluido. Lo que va al peso se cobra con el peso real cuando te lo entregamos.
                {feeCents === 0 && " La cuota de tu plan va aparte."}
              </p>
              {ctx.basketTotalCents < minOrderCents && (
                <p className="mt-2 text-sm font-medium text-warning">
                  El pedido mínimo es de {formatEuros(minOrderCents)}. Con menos, ese reparto no se prepara.
                </p>
              )}
              {ctx.isGuest ? (
                <ConfirmWithAccount
                  href={`/registro?volver=${encodeURIComponent("/bienvenida?confirmar=1")}`}
                  text="Para confirmar, crea tu cuenta y elige tu plan. Tu cesta no se pierde."
                  login={`/entrar?volver=${encodeURIComponent("/cesta?confirmar=1")}`}
                />
              ) : !hasPlan ? (
                <ConfirmWithAccount
                  href="/bienvenida?confirmar=1"
                  text="Para confirmarlo, elige tu plan. Tu cesta no se pierde."
                />
              ) : ctx.toConfirm?.auto && ctx.autoBasket ? (
                <AutoOrder
                  key={ctx.toConfirm.day.id}
                  dayId={ctx.toConfirm.day.id}
                  skipped={ctx.toConfirm.skipped}
                  dayLabel={formatDay(ctx.toConfirm.day.date)}
                  cutoffLabel={formatCutoff(ctx.toConfirm.day.cutoff_at)}
                  basketName={ctx.autoBasket.name}
                />
              ) : (
                ctx.toConfirm && (
                  <ConfirmOrder
                    key={ctx.toConfirm.day.id}
                    dayId={ctx.toConfirm.day.id}
                    confirmed={ctx.toConfirm.confirmed}
                    dayLabel={formatDay(ctx.toConfirm.day.date)}
                    cutoffLabel={formatCutoff(ctx.toConfirm.day.cutoff_at)}
                    note={feeCents > 0 ? `Se suman ${formatEuros(feeCents)} de envío.` : undefined}
                    autoConfirm={confirmar === "1"}
                  />
                )
              )}
            </div>

            {!ctx.isGuest && (
              <section className="card-surface p-5">
                <h2 className="flex items-center gap-2 font-bold">
                  <Icon name="bookmark" className="size-5 text-primary" /> Crear cesta guardada
                </h2>
                <p className="mb-3 mt-1 text-sm text-muted">
                  Guarda esta cesta para repetirla otro día o para el envío automático (por ejemplo, «Semana normal»).
                  La tendrás en Cestas.
                </p>
                <ActionForm action={saveBasket}>
                  <input type="hidden" name="slot" value={ctx.slot} />
                  <Input
                    name="name"
                    placeholder="Nombre de la cesta"
                    aria-label="Nombre de la cesta"
                    maxLength={60}
                    required
                  />
                  <SubmitButton variant="outline" className="w-full" pendingText="Creando…">
                    Crear cesta
                  </SubmitButton>
                </ActionForm>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

/** Sin cuenta o sin plan: «Confirmar pedido» lleva a crear la cuenta o a elegir el plan */
function ConfirmWithAccount({ href, text, login }: { href: string; text: string; login?: string }) {
  return (
    <div id="confirmar" className="mt-3 scroll-mt-20 space-y-2">
      <ButtonLink href={href} className="w-full">
        <Icon name="check" className="size-5" /> Confirmar pedido
      </ButtonLink>
      <p className="text-center text-sm text-muted">{text}</p>
      {login && (
        <p className="text-center text-sm">
          ¿Ya tienes cuenta?{" "}
          <Link href={login} className="font-semibold text-primary underline underline-offset-2">
            Entra
          </Link>
        </p>
      )}
    </div>
  );
}

/** Pago por envío: elegir qué repartos se quieren */
function RequestDays({ days, feeCents }: { days: RequestableDay[]; feeCents: number }) {
  return (
    <section className="card-surface mb-6 p-5">
      <h2 className="font-bold">¿Qué días quieres tu cesta?</h2>
      <p className="mt-0.5 text-sm text-muted">
        Pago por envío: {formatEuros(feeCents)} cada reparto. Pide o anula hasta la hora de cierre de cada uno.
      </p>
      {days.length === 0 ? (
        <p className="mt-3 text-sm">Ahora mismo no hay repartos abiertos.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {days.map(({ day, requested }) => (
            <li key={day.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="font-semibold first-letter:uppercase">{formatDay(day.date)}</p>
                <p className="text-xs text-muted">Cierre {formatCutoff(day.cutoff_at)}</p>
              </div>
              <DeliveryRequestToggle dayId={day.id} requested={requested} label={formatDay(day.date)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
