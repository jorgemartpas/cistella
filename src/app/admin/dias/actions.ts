"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { closeDeliveryDay, ensureDeliveryDays, getScheduleRules } from "@/lib/delivery";
import { isoWeekday, madridDate, madridLocalToUTC } from "@/lib/domain/dates";
import { cutoffFor } from "@/lib/domain/schedule";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionState, DeliveryDay } from "@/lib/types";

/**
 * Guarda el calendario semanal y lo aplica a los días aún abiertos: los de días de la semana
 * desactivados se quitan y el resto toma la nueva hora de cierre.
 */
export async function saveSchedule(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const rows = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    active: formData.get(`active_${weekday}`) === "on",
    cutoff_days_before: Number(formData.get(`days_${weekday}`) ?? 1),
    cutoff_time: String(formData.get(`time_${weekday}`) ?? "20:00"),
  }));
  if (!rows.some((r) => r.active)) return { error: "Tiene que haber al menos un día de reparto." };
  if (rows.some((r) => !/^\d{2}:\d{2}$/.test(r.cutoff_time) || !(r.cutoff_days_before >= 0 && r.cutoff_days_before <= 6))) {
    return { error: "Revisa las horas de cierre." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("delivery_schedule").upsert(rows, { onConflict: "weekday" });
  if (error) return { error: "No se ha podido guardar el calendario." };

  const service = createServiceClient();
  const now = new Date();
  const rules = await getScheduleRules(service);
  const { data: open } = await service
    .from("delivery_days")
    .select("id, date")
    .eq("status", "abierto")
    .is("orders_generated_at", null)
    .gte("date", madridDate(now));
  for (const day of (open ?? []) as Pick<DeliveryDay, "id" | "date">[]) {
    const rule = rules.find((r) => r.weekday === isoWeekday(day.date));
    if (!rule?.active) {
      await service.from("delivery_days").delete().eq("id", day.id);
    } else {
      const cutoff = cutoffFor(day.date, rule);
      // Si con la nueva hora ya habría cerrado, se queda como estaba para no cerrarlo de golpe
      if (cutoff > now) await service.from("delivery_days").update({ cutoff_at: cutoff.toISOString() }).eq("id", day.id);
    }
  }
  await ensureDeliveryDays(service, now);
  refresh();
  return { ok: "Calendario guardado y aplicado a los próximos repartos." };
}

export async function generateDays() {
  await requireRole("admin");
  await ensureDeliveryDays(createServiceClient());
  refresh();
}

export async function updateDay(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const id = String(formData.get("id"));
  const cutoffLocal = String(formData.get("cutoff") ?? "");
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(cutoffLocal);
  if (!match) return { error: "La hora de cierre no es válida." };
  const supabase = await createClient();
  const { data: day } = await supabase.from("delivery_days").select("*").eq("id", id).single<DeliveryDay>();
  if (!day) return { error: "Ese día de reparto no existe." };
  if (day.status !== "abierto") return { error: "Este reparto ya está cerrado; no se puede cambiar." };

  const cutoff = madridLocalToUTC(match[1], match[2]);
  if (match[1] > day.date) return { error: "El cierre tiene que ser antes del día de reparto." };
  const { error } = await supabase
    .from("delivery_days")
    .update({
      cutoff_at: cutoff.toISOString(),
      fruteria_id: formData.get("fruteria_id") || null,
      pescaderia_id: formData.get("pescaderia_id") || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) return { error: "No se han podido guardar los cambios." };
  refresh();
  return { ok: "Cambios guardados." };
}

/** Cancela un reparto (festivo, incidencia) o lo vuelve a abrir, si aún no tiene pedidos. */
export async function setDayCancelled(id: string, cancelled: boolean) {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("delivery_days")
    .update({ status: cancelled ? "cancelado" : "abierto" })
    .eq("id", id)
    .is("orders_generated_at", null);
  refresh();
}

/** Cierra ya un reparto y genera sus pedidos, sin esperar a la hora de cierre. */
export async function closeDayNow(id: string) {
  await requireRole("admin");
  const service = createServiceClient();
  const now = new Date().toISOString();
  await service.from("delivery_days").update({ cutoff_at: now }).eq("id", id).eq("status", "abierto").gt("cutoff_at", now);
  await closeDeliveryDay(service, id);
  redirect(`/admin/dias/${id}`);
}
