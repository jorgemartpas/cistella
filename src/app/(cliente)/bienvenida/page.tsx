import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PlanFields, ProfileFields } from "@/components/customer-fields";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ButtonLink, Card, Notice, PageSkeleton } from "@/components/ui";
import { syncCheckoutSession, startSubscription } from "@/lib/actions/subscription";
import { updateProfile } from "@/lib/actions/profile";
import { isProfileComplete, requireRole } from "@/lib/auth";
import { getScheduleRules, nextDeliveryFor } from "@/lib/delivery";
import { formatEuros } from "@/lib/domain/money";
import { formatCutoff, formatDay } from "@/lib/format";
import { getStripe, paymentsDemoMode } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/lib/types";

export const metadata: Metadata = { title: "Bienvenida" };

export default function WelcomePage({ searchParams }: PageProps<"/bienvenida">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Welcome searchParams={searchParams} />
    </Suspense>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Tus datos", "Tu reparto", "Pago"];
  return (
    <ol className="mb-6 flex gap-2" aria-label="Pasos del alta">
      {steps.map((label, i) => (
        <li key={label} className="flex-1" aria-current={i + 1 === current ? "step" : undefined}>
          <div className={`h-1.5 rounded-full ${i + 1 <= current ? "bg-primary" : "bg-surface-2"}`} />
          <p className={`mt-1.5 text-xs font-medium ${i + 1 === current ? "text-text" : "text-muted"}`}>{label}</p>
        </li>
      ))}
    </ol>
  );
}

async function Welcome({ searchParams }: Pick<PageProps<"/bienvenida">, "searchParams">) {
  const profile = await requireRole("cliente");
  const { pago, session_id: sessionId } = await searchParams;
  if (pago === "ok" && typeof sessionId === "string") await syncCheckoutSession(sessionId, profile.id);

  const supabase = await createClient();
  const [{ data: sub }, rules, { data: settings }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("customer_id", profile.id).maybeSingle<Subscription>(),
    getScheduleRules(supabase),
    supabase.from("settings").select("subscription_price_cents").single(),
  ]);
  const isSubscribed = sub && ["activa", "pausada", "impagada"].includes(sub.status);

  if (isSubscribed && pago === "ok") {
    const next = sub.status === "activa" ? await nextDeliveryFor(supabase, sub, new Date()) : null;
    return (
      <div className="py-6 text-center">
        <div className="text-5xl" aria-hidden>
          🧺
        </div>
        <h1 className="mt-4 text-2xl font-bold">¡Ya estás suscrito!</h1>
        {next && (
          <p className="mt-2 text-muted">
            Tu primer reparto es el <strong className="text-text">{formatDay(next.date)}</strong>. Puedes montar tu
            cesta hasta el {formatCutoff(next.cutoffAt)}.
          </p>
        )}
        <ButtonLink href="/cesta" className="mt-6 w-full">
          Montar mi cesta
        </ButtonLink>
      </div>
    );
  }
  if (isSubscribed) redirect("/cesta");

  if (pago === "ok") {
    // Stripe ha cobrado pero aún no ha llegado la confirmación
    return (
      <Notice tone="info" title="Estamos confirmando tu pago">
        Tarda unos segundos.{" "}
        <Link href="/bienvenida?pago=ok" className="font-semibold underline">
          Actualiza la página
        </Link>
        .
      </Notice>
    );
  }

  if (!isProfileComplete(profile)) {
    return (
      <>
        <Steps current={1} />
        <h1 className="text-2xl font-bold">¿Dónde te llevamos la compra?</h1>
        <p className="mb-5 mt-1 text-muted">Solo usamos estos datos para tus pedidos.</p>
        <ActionForm action={updateProfile}>
          <input type="hidden" name="next" value="/bienvenida" />
          <ProfileFields profile={profile} />
          <SubmitButton className="w-full">Continuar</SubmitButton>
        </ActionForm>
      </>
    );
  }

  const price = formatEuros(settings?.subscription_price_cents ?? 2000);
  const demo = !getStripe() && paymentsDemoMode();
  return (
    <>
      <Steps current={2} />
      <h1 className="text-2xl font-bold">Elige tu reparto</h1>
      <p className="mb-5 mt-1 text-muted">Lo puedes cambiar cuando quieras desde tu cuenta.</p>
      {pago === "cancelado" && (
        <div className="mb-4">
          <Notice tone="warning">No se ha completado el pago. Puedes intentarlo de nuevo.</Notice>
        </div>
      )}
      <ActionForm action={startSubscription}>
        <PlanFields rules={rules} weekday={sub?.delivery_weekday} frequency={sub?.frequency} />
        <Card className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Suscripción Cistella</span>
            <span className="text-lg font-bold">{price}/mes</span>
          </div>
          <p className="text-sm text-muted">
            IVA incluido. Sin permanencia: puedes pausarla o darte de baja cuando quieras. Los productos se cobran aparte
            en cada pedido, con el peso real, a la misma tarjeta.
          </p>
        </Card>
        {demo && <Notice tone="warning">Modo demo: no se cobrará nada (Stripe no está configurado).</Notice>}
        <SubmitButton className="w-full" pendingText="Abriendo el pago…">
          {demo ? "Activar suscripción (demo)" : `Pagar ${price} con tarjeta`}
        </SubmitButton>
      </ActionForm>
    </>
  );
}
