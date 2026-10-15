"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Escribe tu nombre"),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s.-]/g, ""))
    .pipe(z.string().regex(/^(\+34)?[6-9]\d{8}$/, "Escribe un teléfono de 9 cifras")),
  address: z.string().trim().min(5, "Escribe la dirección completa (calle, número, piso)").max(200),
  postal_code: z.string().trim(),
});

/** Datos de contacto y entrega del cliente. El CP se valida también en la base de datos. */
export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("allowed_postal_codes").single();
  const allowed: string[] = settings?.allowed_postal_codes ?? ["46600"];
  if (!allowed.includes(parsed.data.postal_code)) {
    return { error: `De momento solo repartimos en Alzira (CP ${allowed.join(", ")}). Te avisaremos cuando lleguemos a tu zona.` };
  }

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", profile.id);
  if (error) return { error: "No se han podido guardar tus datos. Inténtalo de nuevo." };

  const next = formData.get("next");
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) redirect(next);
  refresh();
  return { ok: "Datos guardados." };
}

/** Direcciones: teléfono, dirección y código postal de entrega. */
export async function updateDeliveryDetails(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  const parsed = profileSchema.omit({ full_name: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("allowed_postal_codes").single();
  const allowed: string[] = settings?.allowed_postal_codes ?? ["46600"];
  if (!allowed.includes(parsed.data.postal_code)) {
    return { error: `De momento solo repartimos en Alzira (CP ${allowed.join(", ")}).` };
  }
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", profile.id);
  if (error) return { error: "No se ha podido guardar la dirección. Inténtalo de nuevo." };
  refresh();
  return { ok: "Dirección guardada." };
}

/** Datos personales: nombre y apellidos. */
export async function updateFullName(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  const parsed = profileSchema.pick({ full_name: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", profile.id);
  if (error) return { error: "No se ha podido guardar el nombre." };
  refresh();
  return { ok: "Nombre guardado." };
}
