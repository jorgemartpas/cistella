import { getCurrentProfile } from "@/lib/auth";
import { madridDate } from "@/lib/domain/dates";
import { SHOP_TYPE_LABELS } from "@/lib/domain/orders";
import { salesByShop } from "@/lib/sales";
import { createClient } from "@/lib/supabase/server";

const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;

/** CSV de ventas y comisión por tienda de un mes, para facturar a mano (separador ; para Excel en español). */
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return new Response("No autorizado", { status: 403 });

  const param = new URL(request.url).searchParams.get("mes") ?? "";
  const month = /^\d{4}-\d{2}$/.test(param) ? param : madridDate(new Date()).slice(0, 7);
  const rows = await salesByShop(await createClient(), month);

  const lines = [
    ["Mes", "Tienda", "Tipo", "Pedidos", "Ventas (€)", "Comisión (%)", "Comisión (€)"].map(cell).join(";"),
    ...rows.map((r) =>
      [
        month,
        r.shop.name,
        SHOP_TYPE_LABELS[r.shop.type],
        String(r.orders),
        euros(r.salesCents),
        String(r.shop.commission_pct).replace(".", ","),
        euros(r.commissionCents),
      ]
        .map(cell)
        .join(";"),
    ),
  ];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="cistella-comisiones-${month}.csv"`,
    },
  });
}
