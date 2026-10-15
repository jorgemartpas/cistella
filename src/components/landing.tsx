import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { FREQUENCY_LABELS, PLAN_ORDER, type DeliveryFrequency } from "@/lib/domain/subscription";
import { DEFAULT_PRICES, planPriceLabel, type PlanPrices } from "@/lib/plans";
import { getCurrentProfile } from "@/lib/auth";
import { PUBLIC_FAQS } from "@/lib/faqs";
import { createClient } from "@/lib/supabase/server";

const steps = [
  {
    title: "Monta tu cesta",
    text: "Fruta, verdura, pescado y la carne de tu carnicería de confianza. Se guarda para cada reparto: la cambias si quieres y confirmas el pedido con un toque.",
  },
  {
    title: "Las tiendas la preparan",
    text: "Al cerrar los pedidos, cada tienda prepara su parte y ajusta el peso real de lo que va al peso.",
  },
  {
    title: "Te la llevamos a casa",
    text: "Recogemos en cada tienda y te lo entregamos todo junto, el día de reparto que elijas.",
  },
];

const shops = [
  {
    type: "Carnicerías",
    icon: "🥩",
    names: "Oskiñez · Carnicería Reino",
    note: "Eliges de qué carnicería es cada producto.",
  },
  {
    type: "Pescaderías",
    icon: "🐟",
    names: "Pescados Miguel Ferrer · Pescados Tomás",
    note: "Se turnan en cada reparto.",
  },
  {
    type: "Fruterías",
    icon: "🍊",
    names: "Dos fruterías de Alzira",
    note: "Fruta y verdura de temporada, también por turnos.",
  },
];


/** Página informativa: qué es Cistella, cómo funciona, planes y preguntas frecuentes. */
export function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <Logo />
        <Suspense fallback={<HeaderLink href="/entrar">Entrar</HeaderLink>}>
          <AccountLink />
        </Suspense>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-4 pb-12 pt-8 sm:pt-16">
          <p className="mb-3 inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
            Piloto en Alzira
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            La compra del comercio de Alzira, en tu puerta.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Carne, pescado, fruta y verdura de las tiendas del pueblo, sin ir de tienda en tienda. Monta tu cesta una
            vez, confirma cada pedido con un toque y te lo llevamos a casa.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/" className="sm:px-8">
              Ver la tienda
            </ButtonLink>
            <ButtonLink href="#planes" variant="secondary">
              Ver planes y precios
            </ButtonLink>
          </div>
        </section>

        <section id="como-funciona" className="bg-surface-2/60 py-12">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-bold">Cómo funciona</h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title}>
                  <Card className="h-full">
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary font-bold text-primary-ink">
                      {i + 1}
                    </span>
                    <h3 className="mt-3 font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted">{step.text}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="planes" className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="text-2xl font-bold">Planes</h2>
          <p className="mt-1 text-muted">Con IVA incluido. Sin permanencia: cambias de plan cuando quieras.</p>
          <Suspense fallback={<PlanCards prices={DEFAULT_PRICES} />}>
            <Pricing />
          </Suspense>
        </section>

        <section className="bg-surface-2/60 py-12">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-bold">Las tiendas del piloto</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {shops.map((shop) => (
                <Card key={shop.type}>
                  <div className="text-3xl" aria-hidden>
                    {shop.icon}
                  </div>
                  <h3 className="mt-2 font-semibold">{shop.type}</h3>
                  <p className="text-sm">{shop.names}</p>
                  <p className="mt-2 text-sm text-muted">{shop.note}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-bold">Preguntas frecuentes</h2>
            <dl className="mt-6 space-y-3">
              {PUBLIC_FAQS.map((faq) => (
                <Card key={faq.q}>
                  <dt className="font-semibold">{faq.q}</dt>
                  <dd className="mt-1 text-muted">{faq.a}</dd>
                </Card>
              ))}
            </dl>
            <div className="mt-8 text-center">
              <ButtonLink href="/" className="px-8">
                Ir a la tienda
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
        <p>Cistella · Alzira</p>
        <Link href="/privacidad" className="underline underline-offset-2">
          Política de privacidad
        </Link>
      </footer>
    </div>
  );
}

function HeaderLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="rounded-lg px-3 py-2 font-semibold text-primary hover:bg-primary-soft">
      {children}
    </Link>
  );
}

const ACCOUNT_LABELS = { cliente: "Mi cesta", tienda: "Mi tienda", admin: "Panel" } as const;

/** «Entrar», o el acceso a tu zona si ya has iniciado sesión (/inicio lleva a cada uno a la suya) */
async function AccountLink() {
  const profile = await getCurrentProfile();
  if (!profile) return <HeaderLink href="/entrar">Entrar</HeaderLink>;
  return <HeaderLink href="/inicio">{ACCOUNT_LABELS[profile.role]}</HeaderLink>;
}

const PLAN_TEXT: Record<DeliveryFrequency, string> = {
  dos_por_semana: "Martes y viernes, con una cesta distinta para cada día.",
  semanal: "Un reparto a la semana, el día que elijas.",
  quincenal: "Un reparto cada 15 días.",
  por_envio: "Sin cuota. Pides solo los repartos que quieras.",
};

function PlanCards({ prices }: { prices: PlanPrices }) {
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PLAN_ORDER.map((plan) => (
        <li key={plan}>
          <Card className={plan === "semanal" ? "h-full border-primary" : "h-full"}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{FREQUENCY_LABELS[plan]}</h3>
              {plan === "semanal" && <Badge tone="success">El más elegido</Badge>}
            </div>
            <p className="mt-2 text-2xl font-bold">{planPriceLabel(prices, plan)}</p>
            <p className="mt-1 text-sm text-muted">{PLAN_TEXT[plan]}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Precios actuales (los que el admin fija en Ajustes) */
async function Pricing() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("price_dos_por_semana_cents, price_semanal_cents, price_quincenal_cents, delivery_fee_cents")
    .single<PlanPrices>();
  return <PlanCards prices={data ?? DEFAULT_PRICES} />;
}
