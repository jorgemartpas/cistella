import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatLive } from "@/components/chat/chat-live";
import { ChatThread } from "@/components/chat/chat-thread";
import { PageHeader, PageSkeleton } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { loadThread } from "@/lib/chat";
import { SHOP_TYPE_LABELS } from "@/lib/domain/orders";
import { createClient } from "@/lib/supabase/server";
import type { Shop } from "@/lib/types";

export const metadata: Metadata = { title: "Conversación" };

export default function AdminConversationPage({ params }: PageProps<"/admin/mensajes/[shopId]">) {
  return (
    <>
      <BackLink href="/admin/mensajes">Mensajes</BackLink>
      <Suspense fallback={<PageSkeleton />}>
        <Conversation params={params} />
      </Suspense>
    </>
  );
}

async function Conversation({ params }: Pick<PageProps<"/admin/mensajes/[shopId]">, "params">) {
  const profile = await requireRole("admin");
  const { shopId } = await params;
  const supabase = await createClient();
  const { data: shop } = await supabase.from("shops").select("*").eq("id", shopId).maybeSingle<Shop>();
  if (!shop) notFound();
  const messages = await loadThread(supabase, shop.id, { id: profile.id, role: "admin" });
  return (
    <>
      <PageHeader title={shop.name} subtitle={`${SHOP_TYPE_LABELS[shop.type]}${shop.phone ? ` · ${shop.phone}` : ""}`} />
      <ChatThread messages={messages} now={new Date()} empty={`Aún no hay mensajes con ${shop.name}. Escríbele cuando quieras.`} />
      <ChatLive shopId={shop.id} lastId={messages.at(-1)?.id ?? null} />
      <ChatComposer shopId={shop.id} placeholder={`Escribe a ${shop.name}…`} />
    </>
  );
}
