"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

/** Cambia el email de acceso. Si el proyecto pide confirmarlo, llega un enlace al email nuevo. */
export async function updateEmail(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  const email = z.email("Escribe un email válido").safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: email.error.issues[0].message };
  if (email.data === profile.email) return { error: "Ese ya es tu email." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser(
    { email: email.data },
    { emailRedirectTo: `${env.siteUrl}/auth/confirm?next=/cuenta` },
  );
  if (error) {
    if (error.code === "email_exists") return { error: "Ese email ya tiene una cuenta en Cistella." };
    return { error: "No se ha podido cambiar el email. Inténtalo de nuevo en unos minutos." };
  }
  refresh();
  // El perfil se actualiza solo cuando cambia el email de acceso (disparador en la base de datos)
  return data.user?.email === email.data
    ? { ok: "Email cambiado. Desde ahora entras con él." }
    : {
        ok: `Te hemos enviado un enlace a ${email.data}: ábrelo para terminar el cambio. Si también te llega uno a tu email actual, ábrelo igualmente.`,
      };
}

/** Métodos de inicio de sesión: cambia la contraseña comprobando antes la actual. */
export async function changePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña nueva necesita al menos 8 caracteres." };
  if (password !== formData.get("password_confirm")) return { error: "Las contraseñas nuevas no coinciden." };
  if (password === current) return { error: "La contraseña nueva tiene que ser distinta de la actual." };

  const supabase = await createClient();
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: profile.email ?? "", password: current });
  if (wrong) return { error: "La contraseña actual no es correcta." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "weak_password") return { error: "Esa contraseña es demasiado fácil. Prueba con otra." };
    return { error: "No se ha podido cambiar la contraseña." };
  }
  return { ok: "Contraseña cambiada." };
}

/**
 * Elimina la cuenta: cancela la cuota, quita los datos personales de los pedidos ya entregados
 * (que se conservan para las cuentas de las tiendas) y borra el usuario con todo lo suyo.
 * No se puede con un pedido en curso o pendiente de cobro.
 */
export async function deleteAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("cliente");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "ELIMINAR") {
    return { error: "Escribe ELIMINAR para confirmarlo." };
  }

  const supabase = await createClient();
  const [{ data: orders }, { data: sub }] = await Promise.all([
    supabase.from("orders").select("id, status, payment_status").eq("customer_id", profile.id),
    supabase.from("subscriptions").select("stripe_subscription_id").eq("customer_id", profile.id).maybeSingle(),
  ]);
  const busy = (orders ?? []).some(
    (o) =>
      ["pendiente", "preparado", "en_reparto"].includes(o.status) ||
      (o.status === "entregado" && ["pendiente", "procesando", "fallido"].includes(o.payment_status)),
  );
  if (busy) {
    return { error: "Tienes un pedido en curso o pendiente de cobro. Podrás eliminar tu cuenta cuando termine." };
  }

  const stripe = getStripe();
  if (stripe && sub?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } catch {
      return { error: "No se ha podido cancelar tu cuota. Inténtalo de nuevo en unos minutos." };
    }
  }

  // Borrar el usuario y anonimizar sus pedidos solo se puede con la clave de servicio
  const service = createServiceClient();
  const ids = (orders ?? []).map((o) => o.id as string);
  if (ids.length) {
    await service
      .from("orders")
      .update({ customer_name: "Cliente eliminado", phone: null, address: "—", postal_code: null })
      .in("id", ids);
    await service.from("shop_orders").update({ customer_label: "Cliente eliminado" }).in("order_id", ids);
  }
  const { error } = await service.auth.admin.deleteUser(profile.id);
  if (error) return { error: "No se ha podido eliminar la cuenta. Inténtalo más tarde." };
  await supabase.auth.signOut();
  redirect("/?cuenta=eliminada");
}
