import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChatBadgeLink } from "./chat-badge-link";

/** Mensajes en la cabecera de los paneles de tienda y admin, con los no leídos. */
export async function ChatHeaderLink() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin" && profile?.role !== "tienda") return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("chat_unread_count");
  return <ChatBadgeLink href={profile.role === "admin" ? "/admin/mensajes" : "/tienda/mensajes"} initial={Number(data ?? 0)} />;
}
