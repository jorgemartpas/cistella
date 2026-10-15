import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { PageHeader, PageSkeleton, cx } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { loadInbox } from "@/lib/chat";
import { madridDate, TIME_ZONE } from "@/lib/domain/dates";
import { relativeDay } from "@/lib/domain/chat";
import { SHOP_TYPE_LABELS, type ShopType } from "@/lib/domain/orders";
import { formatShortDay } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mensajes" };

const timeFormatter = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

export default function AdminMessagesPage() {
  return (
    <>
      <PageHeader title="Mensajes" subtitle="Una conversación con cada tienda. Cualquiera del equipo puede contestar." />
      <Suspense fallback={<PageSkeleton />}>
        <Inbox />
      </Suspense>
    </>
  );
}

async function Inbox() {
  await requireRole("admin");
  const supabase = await createClient();
  const inbox = await loadInbox(supabase);
  const today = madridDate(new Date());
  const when = (iso: string) => {
    const date = madridDate(new Date(iso));
    return relativeDay(date, today) === "Hoy" ? timeFormatter.format(new Date(iso)) : (relativeDay(date, today) ?? formatShortDay(date));
  };

  return (
    <ul className="card-surface divide-y divide-border">
      {inbox.map((row) => (
        <li key={row.shopId}>
          <Link href={`/admin/mensajes/${row.shopId}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon name="store" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cx("truncate", row.unread > 0 ? "font-bold" : "font-semibold")}>{row.shopName}</span>
                {row.lastAt && <span className="shrink-0 text-xs text-muted">{when(row.lastAt)}</span>}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className={cx("truncate text-sm", row.unread > 0 ? "text-text" : "text-muted")}>
                  {row.lastBody
                    ? `${row.lastSide === "admin" ? "Equipo: " : ""}${row.lastBody}`
                    : `${SHOP_TYPE_LABELS[row.shopType as ShopType]} · sin mensajes`}
                </span>
                {row.unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
                    {row.unread}
                  </span>
                )}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
