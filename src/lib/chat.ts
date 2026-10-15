import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requesterName } from "@/lib/domain/product-changes";

export type ChatMessage = {
  id: string;
  body: string;
  created_at: string;
  side: "tienda" | "admin";
  /** Lo ha escrito quien mira */
  mine: boolean;
  /** Quién lo escribe, visto por quien mira («Equipo LaCistella», «Óscar (Oskiñez)»…); vacío si es suyo */
  author: string;
};

/**
 * Los últimos mensajes de la conversación de una tienda, del más antiguo al más nuevo.
 * La tienda ve los del equipo como «Equipo LaCistella»; el admin ve el nombre de cada uno.
 */
export async function loadThread(
  supabase: SupabaseClient,
  shopId: string,
  viewer: { id: string; role: "admin" | "tienda" },
  limit = 150,
): Promise<ChatMessage[]> {
  const [{ data: rows }, { data: shop }] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("id, body, created_at, sender_side, sender_id")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("shops").select("name").eq("id", shopId).maybeSingle(),
  ]);
  const messages = (rows ?? []) as { id: string; body: string; created_at: string; sender_side: "tienda" | "admin"; sender_id: string | null }[];

  // Solo el admin puede leer los nombres de los demás
  const names = new Map<string, string | null>();
  if (viewer.role === "admin") {
    const ids = [...new Set(messages.map((m) => m.sender_id).filter((id): id is string => Boolean(id)))];
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      for (const p of profiles ?? []) names.set(p.id as string, p.full_name as string | null);
    }
  }
  const shopName = shop?.name ?? "La tienda";

  return messages.reverse().map((m) => {
    const mine = m.sender_id === viewer.id;
    let author = "";
    if (!mine) {
      if (m.sender_side === "admin") {
        const first = viewer.role === "admin" ? names.get(m.sender_id ?? "")?.trim().split(/\s+/)[0] : null;
        author = first ? `${first} (LaCistella)` : "Equipo LaCistella";
      } else {
        author = viewer.role === "admin" ? requesterName(names.get(m.sender_id ?? ""), shopName) : shopName;
      }
    }
    return { id: m.id, body: m.body, created_at: m.created_at, side: m.sender_side, mine, author };
  });
}

export type InboxRow = {
  shopId: string;
  shopName: string;
  shopType: string;
  lastBody: string | null;
  lastAt: string | null;
  lastSide: "tienda" | "admin" | null;
  unread: number;
};

/** Bandeja del admin: cada tienda con su último mensaje y los no leídos (las que tienen mensajes primero). */
export async function loadInbox(supabase: SupabaseClient): Promise<InboxRow[]> {
  const { data } = await supabase.rpc("chat_inbox");
  return ((data ?? []) as {
    shop_id: string;
    shop_name: string;
    shop_type: string;
    last_body: string | null;
    last_at: string | null;
    last_side: "tienda" | "admin" | null;
    unread: number;
  }[]).map((r) => ({
    shopId: r.shop_id,
    shopName: r.shop_name,
    shopType: r.shop_type,
    lastBody: r.last_body,
    lastAt: r.last_at,
    lastSide: r.last_side,
    unread: Number(r.unread),
  }));
}
