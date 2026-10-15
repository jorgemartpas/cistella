import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileFields } from "@/components/customer-fields";
import { PlanPicker } from "@/components/plan-picker";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ButtonLink, Notice, PageSkeleton } from "@/components/ui";
import { syncCheckoutSession, startSubscription } from "@/lib/actions/subscription";
import { updateProfile } from "@/lib/actions/profile";
import { isProfileComplete, requireRole } from "@/lib/auth";
import { getScheduleRules, nextDeliveryFor } from "@/lib/delivery";
import { formatCutoff, formatDay, formatLongDate } from "@/lib/format";
import { getStripe, paymentsDemoMode } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { getTrial } from "@/lib/trial";
import type { Settings, Subscription } from "@/lib/types";

export const metadata: Metadata = { title: "Bienvenida" };

export default function WelcomePage({ searchParams }: PageProps<"/bienvenida">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Welcome searchParams={searchParams} />
    </Suspense>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Tus datos", "Tu plan", "Pago"];
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
  const { pago, session_id: sessionId, confirmar } = await searchParams;
  if (pago === "ok" && typeof sessionId === "string") await syncCheckoutSession(sessionId, profile.id);
  // Viene de «Confirmar pedido» en la cesta: al tener plan, vuelve allí y el pedido queda confirmado
  const confirming = confirmar === "1";

  const supabase = await createClient();
  const [{ data: sub }, rules, { data: settings }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("customer_id", profile.id).maybeSingle<Subscription>(),
    getScheduleRules(supabase),
    supabase.from("settings").select("*").single<Settings>(),
  ]);
  const isSubscribed = sub && ["activa", "pausada", "impagada"].includes(sub.status);

  if (isSubscribed && confirming) redirect("/cesta?confirmar=1");
  if (isSubscribed && pago === "ok") {
    const perDelivery = sub.frequency === "por_envio";
    const next = sub.status === "activa" && !perDelivery ? await nextDeliveryFor(supabase, sub, new Date()) : null;
    const trial = sub.status === "activa" ? await getTrial(supabase, sub) : null;
    return (
      <div className="py-6 text-center">
        <div className="text-5xl" aria-hidden>
          🧺
        </div>
        <h1 className="mt-4 text-2xl font-bold">{perDelivery ? "¡Ya estás dentro!" : "¡Ya estás suscrito!"}</h1>
        {perDelivery && (
          <p className="mt-2 text-muted">
            Monta tu cesta y pide los repartos que quieras desde la pestaña «Mi cesta».
          </p>
        )}
        {trial && (
          <p className="mt-2 font-semibold text-primary">
            🎁 Tu prueba gratis ha empezado: no pagas la cuota hasta el {formatLongDate(trial.endsAt)} o tu 2.º pedido.
          </p>
        )}
        {next && (
          <p className="mt-2 text-muted">
            Tu primer reparto es el <strong className="text-text">{formatDay(next.date)}</strong>. Monta tu cesta y
            confirma el pedido antes del {formatCutoff(next.cutoffAt)}.
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
        <Link href={confirming ? "/bienvenida?pago=ok&confirmar=1" : "/bienvenida?pago=ok"} className="font-semibold underline">
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
          <input type="hidden" name="next" value={confirming ? "/bienvenida?confirmar=1" : "/bienvenida"} />
          <ProfileFields profile={profile} />
          <SubmitButton className="w-full">Continuar</SubmitButton>
        </ActionForm>
      </>
    );
  }

  const demo = !getStripe() && paymentsDemoMode();
  const trial = !sub?.trial_started_at;
  return (
    <>
      <Steps current={2} />
      <h1 className="text-2xl font-bold">Elige tu plan</h1>
      <p className="mb-5 mt-1 text-muted">
        {confirming && "Último paso para confirmar tu pedido. "}
        {trial && (
          <>
            Empiezas con <strong className="text-text">2 semanas gratis</strong>.{" "}
          </>
        )}
        Lo puedes cambiar cuando quieras desde tu cuenta.
      </p>
      {pago === "cancelado" && (
        <div className="mb-4">
          <Notice tone="warning">No se ha completado el pago. Puedes intentarlo de nuevo.</Notice>
        </div>
      )}
      <ActionForm action={startSubscription}>
        {confirming && <input type="hidden" name="confirmar" value="1" />}
        {demo && <Notice tone="warning">Modo demo: no se cobrará nada (Stripe no está configurado).</Notice>}
        {settings && (
          <PlanPicker
            rules={rules}
            prices={settings}
            plan={sub?.frequency}
            weekday={sub?.delivery_weekday}
            trial={trial}
            submit={{
              label: demo ? "Activar plan (demo)" : "Continuar al pago",
              trialLabel: demo ? "Empezar mi prueba gratis (demo)" : "Empezar mi prueba gratis",
              pendingText: demo ? "Activando…" : "Abriendo el pago…",
            }}
          />
        )}
      </ActionForm>
    </>
  );
}
