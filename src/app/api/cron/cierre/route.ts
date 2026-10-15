import { closeDueDeliveryDays, ensureDeliveryDays } from "@/lib/delivery";
import { env } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { endUsedUpTrials } from "@/lib/trial";

/**
 * Lo llama Vercel Cron (ver vercel.json) con "Authorization: Bearer $CRON_SECRET".
 * Crea los días de reparto de las próximas semanas, genera los pedidos de los que ya han cerrado y
 * termina las pruebas gratis gastadas que no se pudieron terminar al cerrar (si Stripe falló).
 */
export async function GET(request: Request) {
  const secret = env.cronSecret;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }
  const service = createServiceClient();
  const createdDays = await ensureDeliveryDays(service);
  const closed = await closeDueDeliveryDays(service);
  const trialsEnded = await endUsedUpTrials(service);
  return Response.json({ createdDays, closed, trialsEnded });
}
