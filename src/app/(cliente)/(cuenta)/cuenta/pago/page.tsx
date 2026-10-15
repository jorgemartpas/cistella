import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { ButtonLink, Card, PageHeader, PageSkeleton, buttonStyles } from "@/components/ui";
import { openBillingPortal } from "@/lib/actions/subscription";
import { requireRole } from "@/lib/auth";
import { getStripe, paymentsDemoMode } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Método de pago" };

export default function PaymentMethodPage() {
  return (
    <>
      <PageHeader title="Método de pago" subtitle="La tarjeta con la que pagas la cuota y cada pedido." />
      <Suspense fallback={<PageSkeleton />}>
        <PaymentMethod />
      </Suspense>
    </>
  );
}

async function PaymentMethod() {
  const profile = await requireRole("cliente");
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, stripe_customer_id")
    .eq("customer_id", profile.id)
    .maybeSingle();
  const hasCard = Boolean(getStripe() && sub?.stripe_customer_id);

  return (
    <Card className="flex items-start gap-4 p-5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name="card" className="size-6" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        {hasCard ? (
          <>
            <p>
              Tu tarjeta está guardada de forma segura en Stripe, nuestro procesador de pagos. Desde allí puedes cambiarla
              y descargar tus facturas.
            </p>
            <form action={openBillingPortal}>
              <button type="submit" className={`${buttonStyles.outline} w-full sm:w-auto sm:px-6`}>
                Cambiar tarjeta y ver facturas
              </button>
            </form>
          </>
        ) : paymentsDemoMode() ? (
          <p>Ahora mismo Cistella está en modo de prueba: no se guarda ninguna tarjeta ni se cobra nada.</p>
        ) : (
          <>
            <p>Cuando elijas tu plan, guardaremos aquí tu tarjeta.</p>
            <ButtonLink href="/bienvenida" variant="outline" className="w-full sm:w-auto sm:px-6">
              Elegir plan
            </ButtonLink>
          </>
        )}
      </div>
    </Card>
  );
}
