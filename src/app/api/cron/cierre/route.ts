import { closeDueDeliveryDays, ensureDeliveryDays } from "@/lib/delivery";
import { env } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Lo llama Vercel Cron (ver vercel.json) con "Authorization: Bearer $CRON_SECRET".
 * Crea los días de reparto de las próximas semanas y genera los pedidos de los que ya han cerrado.
 */
export async function GET(request: Request) {
  const secret = env.cronSecret;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }
  const service = createServiceClient();
  const createdDays = await ensureDeliveryDays(service);
  const closed = await closeDueDeliveryDays(service);
  return Response.json({ createdDays, closed });
}
