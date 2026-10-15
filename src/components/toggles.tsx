"use client";

import { useOptimistic, useTransition } from "react";
import { setAvailability, setProductActive, setProductSeasonal } from "@/lib/actions/products";
import { Icon } from "./icons";
import { cx } from "./ui";

function ToggleChip({
  on,
  pending,
  onClick,
  labelOn,
  labelOff,
  ariaLabel,
  strikeOff = true,
}: {
  on: boolean;
  pending: boolean;
  onClick: () => void;
  labelOn: string;
  labelOff: string;
  ariaLabel: string;
  /** Tachar el texto cuando está apagado */
  strikeOff?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
        on ? "bg-primary-soft text-primary" : cx("bg-surface-2 text-muted", strikeOff && "line-through decoration-1"),
        pending && "opacity-70",
      )}
    >
      {on && <Icon name="check" className="size-4" />}
      {on ? labelOn : labelOff}
    </button>
  );
}

/** Interruptor "lo tengo / no lo tengo" del catálogo unificado para una tienda. */
export function AvailabilityToggle({
  shopId,
  productId,
  available,
  labelOn = "Lo tengo",
  labelOff = "No lo tengo",
  productName,
}: {
  shopId: string;
  productId: string;
  available: boolean;
  labelOn?: string;
  labelOff?: string;
  productName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(available);
  return (
    <ToggleChip
      on={optimistic}
      pending={pending}
      labelOn={labelOn}
      labelOff={labelOff}
      ariaLabel={`${productName}: ${labelOn}`}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await setAvailability(shopId, productId, !optimistic);
        })
      }
    />
  );
}

/** Interruptor de "disponible" de un producto propio (carnicerías) o del catálogo (admin). */
export function ActiveToggle({ productId, active, productName }: { productId: string; active: boolean; productName: string }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(active);
  return (
    <ToggleChip
      on={optimistic}
      pending={pending}
      labelOn="Disponible"
      labelOff="Agotado"
      ariaLabel={`${productName}: disponible`}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await setProductActive(productId, !optimistic);
        })
      }
    />
  );
}

/** Interruptor «De temporada» del catálogo unificado (admin): sale en la portada. */
export function SeasonalToggle({ productId, seasonal, productName }: { productId: string; seasonal: boolean; productName: string }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(seasonal);
  return (
    <ToggleChip
      on={optimistic}
      pending={pending}
      labelOn="De temporada"
      labelOff="Marcar de temporada"
      strikeOff={false}
      ariaLabel={`${productName}: de temporada`}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await setProductSeasonal(productId, !optimistic);
        })
      }
    />
  );
}
