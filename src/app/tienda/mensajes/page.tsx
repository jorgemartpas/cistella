import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatLive } from "@/components/chat/chat-live";
import { ChatThread } from "@/components/chat/chat-thread";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { requireShop } from "@/lib/auth";
import { loadThread } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mensajes" };

export default function ShopMessagesPage() {
  return (
    <>
      <PageHeader
        title="Mensajes"
        subtitle="Habla con el equipo de LaCistella: dudas, incidencias con un pedido, cambios… Te contestamos aquí."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Conversation />
      </Suspense>
    </>
  );
}

async function Conversation() {
  const { profile, shopId } = await requireShop();
  const supabase = await createClient();
  const messages = await loadThread(supabase, shopId, { id: profile.id, role: "tienda" });
  return (
    <>
      <ChatThread
        messages={messages}
        now={new Date()}
        empty="Aún no hay mensajes. Escribe al equipo de LaCistella cuando lo necesites."
      />
      <ChatLive shopId={shopId} lastId={messages.at(-1)?.id ?? null} />
      <ChatComposer shopId={shopId} placeholder="Escribe al equipo de LaCistella…" />
    </>
  );
}
