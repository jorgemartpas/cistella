import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { ProfileFields } from "@/components/customer-fields";
import { PlanPicker } from "@/components/plan-picker";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { Badge, ButtonLink, Card, PageHeader, PageSkeleton, SectionTitle, buttonStyles, type Tone } from "@/components/ui";
import { changeSubscription, openBillingPortal, updatePlan } from "@/lib/actions/subscription";
import { updateProfile } from "@/lib/actions/profile";
import { requireRole } from "@/lib/auth";
import { getScheduleRules, nextDeliveryFor } from "@/lib/delivery";
import { STATUS_LABELS, type SubscriptionStatus } from "@/lib/domain/subscription";
import { formatDay, formatLongDate } from "@/lib/format";
import { planDescription, planPriceLabel } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type { Settings, Subscription } from "@/lib/types";

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
  const [{ data: sub }, rules, { data: settings }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("customer_id", profile.id).maybeSingle<Subscription>(),
    getScheduleRules(supabase),
    supabase.from("settings").select("*").single<Settings>(),
  ]);
  const subscribed = sub && ["activa", "pausada", "impagada"].includes(sub.status);
  const perDelivery = sub?.frequency === "por_envio";
  const next = sub?.status === "activa" && !perDelivery ? await nextDeliveryFor(supabase, sub, new Date()) : null;
  const hasStripe = Boolean(getStripe() && sub?.stripe_customer_id);

  return (
    <>
      <SectionTitle>Tu plan</SectionTitle>
      {!subscribed ? (
        <Card>
          <p>No tienes un plan activo.</p>
          <ButtonLink href="/bienvenida" className="mt-3 w-full">
            Elegir plan
          </ButtonLink>
        </Card>
      ) : (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{planDescription(sub)}</p>
              {settings && <p className="text-sm text-muted">{planPriceLabel(settings, sub.frequency)}</p>}
            </div>
            <Badge tone={STATUS_TONES[sub.status]}>{STATUS_LABELS[sub.status]}</Badge>
          </div>
          {next && <p className="text-sm text-muted">Próximo reparto: {formatDay(next.date)}.</p>}
          {perDelivery && <p className="text-sm text-muted">Pides los repartos que quieras desde tu cesta.</p>}
          {!perDelivery && sub.current_period_end && !sub.cancel_at_period_end && sub.status === "activa" && (
            <p className="text-sm text-muted">Próxima cuota: {formatLongDate(sub.current_period_end)}.</p>
          )}
          {!perDelivery && sub.cancel_at_period_end && (
            <p className="text-sm font-medium text-warning">
              Te has dado de baja: seguirás recibiendo repartos hasta el{" "}
              {sub.current_period_end ? formatLongDate(sub.current_period_end) : "final del periodo pagado"}.
            </p>
          )}

          {perDelivery ? (
            <form action={changeSubscription.bind(null, "cancelar")}>
              <ConfirmButton
                variant="danger"
                className="w-full"
                message="Se anularán los repartos que tengas pedidos. ¿Darte de baja?"
              >
                Darme de baja
              </ConfirmButton>
            </form>
          ) : (
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
          )}
          {hasStripe && (
            <form action={openBillingPortal}>
              <button type="submit" className={`${buttonStyles.ghost} w-full`}>
                Cambiar tarjeta y ver facturas
              </button>
            </form>
          )}
        </Card>
      )}

      {subscribed && settings && (
        <>
          <SectionTitle>Cambiar de plan o de día</SectionTitle>
          <ActionForm action={updatePlan}>
            <PlanPicker rules={rules} prices={settings} plan={sub.frequency} weekday={sub.delivery_weekday} />
            <p className="text-sm text-muted">
              Si cambias entre planes con cuota, la diferencia se ajusta en tu próxima cuota.
            </p>
            <SubmitButton variant="secondary" className="w-full">
              Guardar cambios
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
