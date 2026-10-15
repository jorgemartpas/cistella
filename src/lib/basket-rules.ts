import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { closingDayFor, getScheduleRules } from "@/lib/delivery";
import { usesDayBaskets } from "@/lib/domain/subscription";
import type { Subscription } from "@/lib/types";

const DATE_FORMAT = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * ¿Se puede tocar ahora la cesta `slot` del cliente? Devuelve el motivo si no. `slot` es 0 (la
 * cesta única) o el día de la semana en el plan de 2 veces por semana. Mientras se cierra un
 * reparto confirmado (entre la hora de cierre y la generación de pedidos) no se puede tocar.
 */
export async function basketLockReason(
  supabase: SupabaseClient,
  customerId: string,
  slot: number,
): Promise<string | null> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle<Subscription>();

  if (sub && usesDayBaskets(sub.frequency)) {
    const rules = await getScheduleRules(supabase);
    if (!rules.some((r) => r.active && r.weekday === slot)) return "Elige la cesta de un día de reparto.";
  } else if (slot !== 0) {
    return "Tu plan tiene una sola cesta.";
  }

  if (sub?.status === "activa") {
    const closing = await closingDayFor(supabase, sub, new Date());
    if (closing) {
      return `Estamos cerrando el reparto del ${DATE_FORMAT.format(new Date(closing.date))}. En unos minutos podrás cambiar la cesta para el siguiente.`;
    }
  }
  return null;
}
