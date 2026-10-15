import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types";

/** Usuario y perfil de la petición actual (verificado contra Supabase Auth). */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<Profile>();
  return data ?? null;
});

export const HOME_BY_ROLE: Record<UserRole, string> = {
  cliente: "/cesta",
  tienda: "/tienda",
  admin: "/admin",
};

/** Exige sesión y un rol concreto; si no, redirige. Úsalo en páginas y Server Actions. */
export async function requireRole<R extends UserRole>(...roles: R[]): Promise<Profile & { role: R }> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/entrar");
  if (!roles.includes(profile.role as R)) redirect(HOME_BY_ROLE[profile.role]);
  return profile as Profile & { role: R };
}

/** Variante para tiendas: devuelve también el id de su tienda. */
export async function requireShop() {
  const profile = await requireRole("tienda");
  if (!profile.shop_id) redirect("/entrar");
  return { profile, shopId: profile.shop_id };
}

/** ¿Tiene el cliente todo lo necesario para recibir pedidos? */
export function isProfileComplete(profile: Profile): boolean {
  return Boolean(profile.full_name.trim() && profile.phone?.trim() && profile.address?.trim() && profile.postal_code);
}
