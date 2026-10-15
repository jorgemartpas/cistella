"use server";

import { refresh } from "next/cache";
import { getCurrentProfile, requireRole } from "@/lib/auth";
import { cleanMessage } from "@/lib/domain/chat";
import { createClient } from "@/lib/supabase/server";

/** Envía un mensaje a la conversación de una tienda (la tienda, a la suya; el admin, a cualquiera). */
export async function sendChatMessage(shopId: string, input: string): Promise<{ error?: string }> {
  const profile = await requireRole("admin", "tienda");
  if (profile.role === "tienda" && profile.shop_id !== shopId) return { error: "Esta conversación no es tuya." };
  const cleaned = cleanMessage(input);
  if ("error" in cleaned) return cleaned;

  const supabase = await createClient();
  const { error } = await supabase.from("chat_messages").insert({
    shop_id: shopId,
    sender_id: profile.id,
    sender_side: profile.role === "admin" ? "admin" : "tienda",
    body: cleaned.body,
  });
  if (error) return { error: "No se ha podido enviar. Inténtalo de nuevo." };
  // Quien escribe ya ha leído todo lo anterior
  await supabase.rpc("mark_chat_read", { p_shop_id: shopId });
  refresh();
  return {};
}

/** Marca la conversación como leída (al abrirla o al llegar mensajes nuevos con ella abierta). */
export async function markChatRead(shopId: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.shop_id !== shopId)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_chat_read", { p_shop_id: shopId });
}

/** Mensajes sin leer de quien pregunta (para el aviso de la cabecera). */
export async function getChatUnread(): Promise<number> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "tienda")) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("chat_unread_count");
  return Number(data ?? 0);
}
