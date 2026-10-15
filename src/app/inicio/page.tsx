import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import { getCurrentProfile, HOME_BY_ROLE } from "@/lib/auth";

// Punto de entrada tras iniciar sesión: manda a cada uno a su zona.
export default function InicioPage() {
  return (
    <div className="mx-auto max-w-3xl p-4">
      <Suspense fallback={<PageSkeleton />}>
        <RedirectByRole />
      </Suspense>
    </div>
  );
}

async function RedirectByRole(): Promise<null> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar");
  // El cliente va a la tienda aunque aún no tenga plan: lo elige al confirmar su primer pedido
  redirect(HOME_BY_ROLE[profile.role]);
}
