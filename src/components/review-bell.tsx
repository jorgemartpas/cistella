import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { pendingChangesCount } from "@/lib/product-changes";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "./icons";

/** Campana del admin: cuántos cambios de las tiendas esperan su revisión. */
export async function ReviewBell() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return null;
  const count = await pendingChangesCount(await createClient());
  const label =
    count === 0 ? "Revisiones: nada pendiente" : count === 1 ? "1 cambio pendiente de revisión" : `${count} cambios pendientes de revisión`;
  return (
    <Link
      href="/admin/revisiones"
      aria-label={label}
      title={label}
      className="relative flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
    >
      <Icon name="bell" className="size-5" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
