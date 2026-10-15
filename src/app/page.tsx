import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink, Card } from "@/components/ui";

const steps = [
  {
    title: "Monta tu cesta",
    text: "Fruta, verdura, pescado y la carne de tu carnicería de confianza. Se repite sola en cada reparto y la cambias cuando quieras.",
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
  { type: "Carnicerías", icon: "🥩", names: "Oskiñez · Carnicería Reino", note: "Eliges de qué carnicería es cada producto." },
  { type: "Pescaderías", icon: "🐟", names: "Pescados Miguel Ferrer · Pescados Tomás", note: "Se turnan en cada reparto." },
  { type: "Fruterías", icon: "🍊", names: "Dos fruterías de Alzira", note: "Fruta y verdura de temporada, también por turnos." },
];

const faqs = [
  {
    q: "¿Cuánto cuesta?",
    a: "La suscripción son 20 €/mes, con IVA incluido. Los productos se pagan aparte, en cada pedido y con el peso real, a la misma tarjeta.",
  },
  {
    q: "¿Qué días repartís?",
    a: "Martes y viernes. Puedes cambiar tu cesta hasta las 20:00 del día anterior. Eliges si quieres reparto cada semana, cada dos o cada cuatro.",
  },
  { q: "¿Dónde repartís?", a: "De momento solo en Alzira (código postal 46600)." },
  { q: "¿Puedo pausar o darme de baja?", a: "Sí, desde tu cuenta, cuando quieras y sin permanencia." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <Logo />
        <Link href="/entrar" className="rounded-lg px-3 py-2 font-semibold text-primary hover:bg-primary-soft">
          Entrar
        </Link>
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
            vez y te la llevamos cada semana.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/registro" className="sm:px-8">
              Suscribirme por 20 €/mes
            </ButtonLink>
            <ButtonLink href="#como-funciona" variant="secondary">
              Cómo funciona
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

        <section className="mx-auto max-w-5xl px-4 py-12">
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
        </section>

        <section className="bg-surface-2/60 py-12">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-bold">Preguntas frecuentes</h2>
            <dl className="mt-6 space-y-3">
              {faqs.map((faq) => (
                <Card key={faq.q}>
                  <dt className="font-semibold">{faq.q}</dt>
                  <dd className="mt-1 text-muted">{faq.a}</dd>
                </Card>
              ))}
            </dl>
            <div className="mt-8 text-center">
              <ButtonLink href="/registro" className="px-8">
                Empezar
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
