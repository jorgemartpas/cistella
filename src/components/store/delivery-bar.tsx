import Link from "next/link";
import type { ReactNode } from "react";
import { getClientContext } from "@/lib/client-context";
import { formatEuros } from "@/lib/domain/money";
import { WEEKDAY_NAMES } from "@/lib/domain/schedule";
import { formatCutoff, formatDay } from "@/lib/format";
import { Icon } from "../icons";
import { cx } from "../ui";
import { BasketDayPicker } from "./basket-day-picker";

/** Barra gris bajo la cabecera: el próximo reparto, a qué dirección y si está confirmado. */
export async function DeliveryBar() {
  const ctx = await getClientContext();
  const { sub, next, toConfirm, closing, perDelivery } = ctx;
  const address = ctx.profile.address?.trim();
  const where = address ? ` en ${address}` : "";

  let content: ReactNode;
  let tone: "normal" | "warning" | "danger" = "normal";
  if (!sub || sub.status === "incompleta" || sub.status === "cancelada") {
    content = (
      <>
        Elige tu plan para recibir tu cesta{where}.{" "}
        <BarLink href="/bienvenida">Elegir plan</BarLink>
      </>
    );
  } else if (sub.status === "pausada") {
    tone = "warning";
    content = (
      <>
        Tu suscripción está pausada: no hay repartos. <BarLink href="/cuenta">Reanudar</BarLink>
      </>
    );
  } else if (sub.status === "impagada") {
    tone = "danger";
    content = (
      <>
        No hemos podido cobrar la cuota. <BarLink href="/cuenta/pago">Revisar mi tarjeta</BarLink>
      </>
    );
  } else if (perDelivery) {
    const requested = ctx.requestable.find((r) => r.requested);
    content = requested ? (
      <>
        Reparto pedido para el <strong>{formatDay(requested.day.date)}</strong>
        {where}. <BarLink href="/cesta">Ver mi cesta</BarLink>
      </>
    ) : (
      <>
        Pide tu próximo reparto ({formatEuros(ctx.settings?.delivery_fee_cents ?? 0)} de envío).{" "}
        <BarLink href="/cesta">Pedir reparto</BarLink>
      </>
    );
  } else if (next) {
    content = (
      <>
        Próximo reparto el <strong>{formatDay(next.date)}</strong>
        {where}.{" "}
        {toConfirm?.confirmed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-sm font-bold text-primary">
            <Icon name="check" className="size-4" /> Confirmado
          </span>
        ) : (
          <>
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-sm font-bold text-warning">Sin confirmar</span> (hasta
            el {formatCutoff(next.cutoffAt)}
            ). <BarLink href="/cesta#confirmar">Confirmar</BarLink>
          </>
        )}
      </>
    );
  } else {
    content = <>Ahora mismo no hay repartos programados para tu día.</>;
  }

  return (
    <div className="mb-6 space-y-2">
      <div
        className={cx(
          "flex items-start gap-3 rounded-lg px-4 py-3.5 text-[15px] leading-relaxed",
          tone === "normal" && "bg-primary text-primary-ink shadow-[0_12px_26px_-16px_rgb(18_132_63/0.8)]",
          tone === "warning" && "bg-warning-soft text-warning",
          tone === "danger" && "bg-danger-soft text-danger",
        )}
      >
        <Icon name="home" className="mt-0.5 size-5 shrink-0" />
        <p>
          {closing && (
            <span className="mr-1 rounded-full bg-surface px-2.5 py-0.5 text-sm font-bold text-warning">
              Estamos preparando el reparto del {formatDay(closing.date)}
            </span>
          )}
          {content}
        </p>
      </div>
      {ctx.dayBaskets && ctx.isActive && (
        <BasketDayPicker
          days={ctx.weekdays.map((w) => ({ weekday: w, label: WEEKDAY_NAMES[w] }))}
          current={ctx.slot}
        />
      )}
    </div>
  );
}

function BarLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-bold underline underline-offset-2 hover:no-underline">
      {children}
    </Link>
  );
}
