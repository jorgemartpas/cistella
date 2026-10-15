"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const shopSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Escribe el nombre de la tienda").max(80),
  type: z.enum(["carniceria", "pescaderia", "fruteria"], { error: "Elige el tipo de tienda" }).optional(),
  commission_pct: z.coerce.number({ error: "La comisión tiene que ser un número" }).min(0).max(100),
  rotation_order: z.coerce.number().int().min(0).max(99),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(200).optional(),
  active: z.literal("on").optional(),
  account_email: z.union([z.literal(""), z.email("El email de la cuenta no es válido")]).optional(),
  account_password: z.string().optional(),
});

export async function saveShop(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const raw = Object.fromEntries(formData);
  const parsed = shopSchema.safeParse({
    ...raw,
    id: raw.id || undefined,
    commission_pct: String(raw.commission_pct ?? "").replace(",", "."),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const values = {
    name: input.name,
    commission_pct: input.commission_pct,
    rotation_order: input.rotation_order,
    phone: input.phone || null,
    address: input.address || null,
    active: input.active === "on",
  };

  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase.from("shops").update(values).eq("id", input.id);
    if (error) return { error: "No se han podido guardar los cambios." };
    redirect("/admin/tiendas");
  }

  if (!input.type) return { error: "Elige el tipo de tienda" };
  const { data: shop, error } = await supabase
    .from("shops")
    .insert({ ...values, type: input.type })
    .select("id")
    .single();
  if (error || !shop) return { error: "No se ha podido crear la tienda." };

  if (input.account_email) {
    const result = await createAccount(shop.id, input.name, input.account_email, input.account_password ?? "");
    if (result.error) {
      return { error: `La tienda se ha creado, pero no su cuenta: ${result.error} Puedes crearla desde la ficha de la tienda.` };
    }
  }
  redirect("/admin/tiendas");
}

async function createAccount(
  shopId: string,
  shopName: string,
  email: string,
  password: string,
): Promise<{ error?: string; ok?: string }> {
  if (password.length < 8) return { error: "La contraseña necesita al menos 8 caracteres." };
  const service = createServiceClient();
  const { data: existing } = await service.from("profiles").select("id").eq("shop_id", shopId).maybeSingle();
  if (existing) return { error: "Esta tienda ya tiene una cuenta." };

  const { data, error } = await service.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: shopName },
  });
  if (error || !data.user) {
    return { error: /already/i.test(error?.message ?? "") ? "Ese email ya tiene una cuenta en Cistella." : "No se ha podido crear la cuenta." };
  }
  const { error: profileError } = await service
    .from("profiles")
    .update({ role: "tienda", shop_id: shopId, full_name: shopName })
    .eq("id", data.user.id);
  if (profileError) {
    await service.auth.admin.deleteUser(data.user.id);
    return { error: "No se ha podido enlazar la cuenta con la tienda." };
  }
  return { ok: `Cuenta creada. La tienda ya puede entrar con ${email}.` };
}

export async function createShopAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const shopId = String(formData.get("shop_id") ?? "");
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { error: "Escribe un email válido." };
  const supabase = await createClient();
  const { data: shop } = await supabase.from("shops").select("name").eq("id", shopId).single();
  if (!shop) return { error: "La tienda no existe." };
  const result = await createAccount(shopId, shop.name, email.data, String(formData.get("password") ?? ""));
  if (result.ok) refresh();
  return result;
}

export async function resetShopPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const userId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña necesita al menos 8 caracteres." };
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("role").eq("id", userId).single();
  if (profile?.role !== "tienda") return { error: "Solo se puede cambiar la contraseña de cuentas de tienda." };
  const { error } = await service.auth.admin.updateUserById(userId, { password });
  if (error) return { error: "No se ha podido cambiar la contraseña." };
  return { ok: "Contraseña cambiada. Pásasela a la tienda por un canal seguro." };
}
