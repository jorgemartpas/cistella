import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui";
import { getCurrentProfile, HOME_BY_ROLE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  if (profile.role === "cliente") {
    const supabase = await createClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("customer_id", profile.id)
      .maybeSingle();
    if (!sub || sub.status === "incompleta" || sub.status === "cancelada") redirect("/bienvenida");
  }
  redirect(HOME_BY_ROLE[profile.role]);
}
