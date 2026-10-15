"use client";

import { useState, type ReactNode } from "react";
import { cx } from "../ui";

/** Fila de Datos personales: título, explicación y valor, con «Editar» que despliega el formulario. */
export function EditableRow({
  title,
  description,
  value,
  action = "Editar",
  danger = false,
  children,
}: {
  title: string;
  description: string;
  value?: ReactNode;
  /** Texto del botón */
  action?: string;
  danger?: boolean;
  /** Formulario que se despliega */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
          {value && <p className="mt-2 break-words font-bold">{value}</p>}
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={cx(
            "mt-1 shrink-0 rounded-full border px-5 py-1.5 text-sm font-bold",
            open
              ? "border-border text-muted hover:text-text"
              : danger
                ? "border-danger text-danger hover:bg-danger-soft"
                : "border-primary text-primary hover:bg-primary-soft",
          )}
        >
          {open ? "Cancelar" : action}
        </button>
      </div>
      {open && <div className="mt-4 max-w-md">{children}</div>}
    </div>
  );
}
