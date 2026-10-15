import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { PlanFields, ProfileFields } from "@/components/customer-fields";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Badge, ButtonLink, Card, PageHeader, PageSkeleton, SectionTitle, buttonStyles, type Tone } from "@/components/ui";
import { changeSubscription, openBillingPortal, updatePlan } from "@/lib/actions/subscription";
import { updateProfile } from "@/lib/actions/profile";
import { requireRole } from "@/lib/auth";
import { getScheduleRules, nextDeliveryFor } from "@/lib/delivery";
import { WEEKDAY_NAMES } from "@/lib/domain/schedule";
import { FREQUENCY_LABELS, STATUS_LABELS, type SubscriptionStatus } from "@/lib/domain/subscription";
import { formatDay, formatLongDate } from "@/lib/format";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type { Subscription } from "@/lib/types";

export const metadata: Metadata = { title: "Mi cuenta" };

const STATUS_TONES: Record<SubscriptionStatus, Tone> = {
  activa: "success",
  pausada: "warning",
  impagada: "danger",
  incompleta: "neutral",
  cancelada: "neutral",
};

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Mi cuenta" />
      <Suspense fallback={<PageSkeleton />}>
        <Account />
      </Suspense>
    </>
  );
}

async function Account() {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const [{ data: sub }, rules] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("customer_id", profile.id).maybeSingle<Subscription>(),
    getScheduleRules(supabase),
  ]);
  const subscribed = sub && ["activa", "pausada", "impagada"].includes(sub.status);
  const next = sub?.status === "activa" ? await nextDeliveryFor(supabase, sub, new Date()) : null;
  const hasStripe = Boolean(getStripe() && sub?.stripe_customer_id);

  return (
    <>
      <SectionTitle>Suscripción</SectionTitle>
      {!subscribed ? (
        <Card>
          <p>No tienes una suscripción activa.</p>
          <ButtonLink href="/bienvenida" className="mt-3 w-full">
            Suscribirme
          </ButtonLink>
        </Card>
      ) : (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">
              {FREQUENCY_LABELS[sub.frequency]}, los {WEEKDAY_NAMES[sub.delivery_weekday]}
            </p>
            <Badge tone={STATUS_TONES[sub.status]}>{STATUS_LABELS[sub.status]}</Badge>
          </div>
          {next && <p className="text-sm text-muted">Próximo reparto: {formatDay(next.date)}.</p>}
          {sub.current_period_end && !sub.cancel_at_period_end && sub.status === "activa" && (
            <p className="text-sm text-muted">Próxima cuota: {formatLongDate(sub.current_period_end)}.</p>
          )}
          {sub.cancel_at_period_end && (
            <p className="text-sm font-medium text-warning">
              Te has dado de baja: seguirás recibiendo repartos hasta el{" "}
              {sub.current_period_end ? formatLongDate(sub.current_period_end) : "final del periodo pagado"}.
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {sub.status === "pausada" ? (
              <form action={changeSubscription.bind(null, "reanudar")}>
                <SubmitButton className="w-full" pendingText="Reanudando…">
                  Reanudar repartos
                </SubmitButton>
              </form>
            ) : (
              <form action={changeSubscription.bind(null, "pausar")}>
                <ConfirmButton
                  className="w-full"
                  message="Mientras esté pausada no recibirás repartos ni se cobrará la cuota. ¿Pausar?"
                >
                  <Icon name="pause" className="size-4" /> Pausar
                </ConfirmButton>
              </form>
            )}
            {sub.cancel_at_period_end ? (
              <form action={changeSubscription.bind(null, "mantener")}>
                <SubmitButton variant="secondary" className="w-full">
                  Seguir suscrito
                </SubmitButton>
              </form>
            ) : (
              <form action={changeSubscription.bind(null, "cancelar")}>
                <ConfirmButton
                  variant="danger"
                  className="w-full"
                  message="Seguirás recibiendo repartos hasta el final del mes que ya has pagado. ¿Darte de baja?"
                >
                  Darme de baja
                </ConfirmButton>
              </form>
            )}
          </div>
          {hasStripe && (
            <form action={openBillingPortal}>
              <button type="submit" className={`${buttonStyles.ghost} w-full`}>
                Cambiar tarjeta y ver facturas
              </button>
            </form>
          )}
        </Card>
      )}

      {subscribed && (
        <>
          <SectionTitle>Día y frecuencia</SectionTitle>
          <ActionForm action={updatePlan}>
            <PlanFields rules={rules} weekday={sub.delivery_weekday} frequency={sub.frequency} />
            <SubmitButton variant="secondary" className="w-full">
              Cambiar reparto
            </SubmitButton>
          </ActionForm>
        </>
      )}

      <SectionTitle>Datos de entrega</SectionTitle>
      <ActionForm action={updateProfile}>
        <p className="text-sm text-muted">Email: {profile.email}</p>
        <ProfileFields profile={profile} />
        <SubmitButton variant="secondary" className="w-full">
          Guardar datos
        </SubmitButton>
      </ActionForm>

      <SectionTitle>Privacidad</SectionTitle>
      <p className="text-sm text-muted">
        Solo guardamos lo necesario para llevarte la compra. Lee la{" "}
        <Link href="/privacidad" className="underline">
          política de privacidad
        </Link>{" "}
        o escríbenos si quieres borrar tu cuenta.
      </p>

      <form action={signOut} className="mt-8">
        <button type="submit" className={`${buttonStyles.secondary} w-full`}>
          <Icon name="logout" /> Cerrar sesión
        </button>
      </form>
    </>
  );
}
