"use client";

import { useState, useTransition } from "react";
import { clearBasket } from "@/lib/actions/basket";
import { Icon } from "../icons";

/** «Vaciar la cesta»: quita todos los productos, después de confirmarlo. */
export function ClearBasketButton({ slot, count }: { slot: number; count: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    const what = count === 1 ? "el producto" : `los ${count} productos`;
    if (!window.confirm(`¿Vaciar la cesta? Se quitan ${what}.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await clearBasket(slot);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={clear}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
      >
        <Icon name="trash" className="size-4" /> {pending ? "Vaciando…" : "Vaciar la cesta"}
      </button>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
