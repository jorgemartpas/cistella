"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { createSavedBasket, setListItem } from "@/lib/actions/lists";
import { Icon } from "../icons";
import { cx } from "../ui";

/** Botón de marcador de cada producto: lo guarda (con su cantidad) en una o varias cestas guardadas. */
export function SaveToList({
  productId,
  productName,
  lists,
  memberOf,
  className,
}: {
  productId: string;
  productName: string;
  lists: { id: string; name: string }[];
  /** Listas en las que ya está */
  memberOf: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(memberOf);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = (listId: string) => {
    const inList = !optimistic.includes(listId);
    setError(null);
    startTransition(async () => {
      setOptimistic(inList ? [...optimistic, listId] : optimistic.filter((id) => id !== listId));
      const result = await setListItem(listId, productId, inList);
      if (result.error) setError(result.error);
    });
  };

  const saved = optimistic.length > 0;
  return (
    <div ref={ref} className={cx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Guardar ${productName} en una cesta guardada`}
        title="Guardar en una cesta guardada"
        className={cx(
          "flex size-9 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-border",
          saved ? "text-primary" : "text-muted hover:text-text",
        )}
      >
        <Icon name="bookmark" className={cx("size-4", saved && "fill-current")} />
      </button>
      {open && (
        <div className="card-surface absolute right-0 top-11 z-20 w-60 p-3 text-left">
          <p className="mb-2 text-sm font-bold">Guardar en una cesta guardada</p>
          {lists.length > 0 && (
            <ul className="mb-2 max-h-48 space-y-1 overflow-y-auto">
              {lists.map((list) => (
                <li key={list.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={optimistic.includes(list.id)}
                      onChange={() => toggle(list.id)}
                      disabled={pending}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 truncate">{list.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const name = String(new FormData(form).get("name") ?? "");
              setError(null);
              startTransition(async () => {
                const result = await createSavedBasket(name, productId);
                if (result.error) setError(result.error);
                else form.reset();
              });
            }}
          >
            <input
              name="name"
              placeholder="Nueva cesta"
              aria-label="Nombre de la nueva cesta"
              maxLength={60}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              required
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-2.5 text-sm font-semibold text-primary-ink disabled:opacity-50"
            >
              Crear
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
