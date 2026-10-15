"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

/** Solo se vuelve a rutas internas, para no abrir redirecciones a otros sitios. */
function safeNext(value: FormDataEntryValue | null, fallback = "/inicio") {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

const credentials = z.object({
  email: z.email("Escribe un email válido").trim().toLowerCase(),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Antes de entrar, confirma tu email con el enlace que te enviamos." };
    }
    return { error: "El email o la contraseña no son correctos." };
  }
  redirect(safeNext(formData.get("volver")));
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Escribe tu nombre"),
  email: z.email("Escribe un email válido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña necesita al menos 8 caracteres"),
  accept: z.literal("on", { error: "Tienes que aceptar la política de privacidad" }),
});

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, accepted_privacy: "true" },
      emailRedirectTo: `${env.siteUrl}/auth/confirm?next=/bienvenida`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists") return { error: "Ya hay una cuenta con ese email. Prueba a entrar." };
    if (error.code === "weak_password") return { error: "Esa contraseña es demasiado fácil. Prueba con otra." };
    return { error: "No hemos podido crear la cuenta. Inténtalo de nuevo en unos minutos." };
  }
  // Si el proyecto pide confirmar el email, todavía no hay sesión
  if (!data.session) {
    return { ok: `Te hemos enviado un email a ${parsed.data.email}. Abre el enlace para activar tu cuenta.` };
  }
  redirect("/bienvenida");
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Escribe un email válido" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/nueva-contrasena`,
  });
  // Misma respuesta exista o no la cuenta
  return { ok: "Si hay una cuenta con ese email, te llegará un enlace para cambiar la contraseña." };
}

export async function updatePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña necesita al menos 8 caracteres" };
  if (password !== formData.get("password_confirm")) return { error: "Las contraseñas no coinciden" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "El enlace ha caducado. Pide uno nuevo desde «He olvidado mi contraseña»." };
  redirect("/inicio");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
