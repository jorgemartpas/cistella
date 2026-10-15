"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { confirmDelivery, setDeliverySkip } from "@/lib/actions/basket";
import { Icon } from "./icons";
import { buttonStyles, cx } from "./ui";

/** Confirmar (o anular) el pedido de un reparto. Sin confirmar, ese día no se prepara nada. */
export function ConfirmOrder({
  dayId,
  confirmed,
  dayLabel,
  cutoffLabel,
  note,
  autoConfirm = false,
}: {
  dayId: string;
  confirmed: boolean;
  /** "martes, 20 de octubre" */
  dayLabel: string;
  /** "lunes 19, 20:00" */
  cutoffLabel: string;
  /** Texto extra bajo el botón (los gastos de envío, en pago por envío) */
  note?: string;
  /** Lo confirma solo al abrirse (al volver del alta, si se pulsó «Confirmar pedido» sin cuenta) */
  autoConfirm?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(confirmed);
  const [error, setError] = useState<string | null>(null);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoConfirm || confirmed || autoStarted.current) return;
    autoStarted.current = true;
    startTransition(async () => {
      const result = await confirmDelivery(dayId, true);
      if (result.error) setError(result.error);
    });
  }, [autoConfirm, confirmed, dayId]);

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      setOptimistic(!optimistic);
      const result = await confirmDelivery(dayId, !optimistic);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div id="confirmar" className="mt-3 scroll-mt-20 space-y-2">
      {optimistic ? (
        <div role="status" className="rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
          <p className="flex items-center gap-1.5 text-base font-semibold">
            <Icon name="check" className="size-5" /> Pedido confirmado para el {dayLabel}
          </p>
          <p className="mt-1">
            Puedes seguir cambiando la cesta hasta el {cutoffLabel}: lo preparamos tal y como esté entonces.
          </p>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-50"
          >
            Anular este pedido
          </button>
        </div>
      ) : (
        <>
          <button type="button" onClick={toggle} disabled={pending} className={cx(buttonStyles.primary, "w-full")}>
            <Icon name="check" className="size-5" /> Confirmar pedido del {dayLabel}
          </button>
          <p className="text-center text-sm text-muted">
            Confírmalo antes del {cutoffLabel}. Si no, ese día no te llevamos nada.{note && ` ${note}`}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-center text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Envío automático: el reparto se prepara solo con la cesta; se puede saltar (o recuperar). */
export function AutoOrder({
  dayId,
  skipped,
  dayLabel,
  cutoffLabel,
  basketName,
}: {
  dayId: string;
  skipped: boolean;
  dayLabel: string;
  cutoffLabel: string;
  /** Cesta guardada a la que vuelve la cesta después de cada reparto */
  basketName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(skipped);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      setOptimistic(!optimistic);
      const result = await setDeliverySkip(dayId, !optimistic);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div id="confirmar" className="mt-3 scroll-mt-20 space-y-2">
      {optimistic ? (
        <div role="status" className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          <p className="text-base font-semibold">Has saltado el reparto del {dayLabel}</p>
          <p className="mt-1">Ese día no te llevamos nada. El envío automático sigue en los siguientes repartos.</p>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-50"
          >
            Recuperar este reparto
          </button>
        </div>
      ) : (
        <div role="status" className="rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary">
          <p className="text-base font-semibold">
            <span aria-hidden>🔁</span> Envío automático: tu pedido del {dayLabel} se prepara solo
          </p>
          <p className="mt-1">
            Con lo que haya en tu cesta el {cutoffLabel}. Después tu cesta vuelve a ser «{basketName}».
          </p>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-50"
          >
            Saltar este reparto
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-center text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
