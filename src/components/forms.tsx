"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/types";
import { buttonStyles, cx } from "./ui";

export function SubmitButton({
  children,
  pendingText = "Guardando…",
  variant = "primary",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonStyles;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={cx(buttonStyles[variant], className)}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={cx(
        "rounded-xl px-4 py-3 text-sm",
        state.error ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary",
      )}
    >
      {state.error ?? state.ok}
    </p>
  );
}

/** Formulario ligado a un Server Action que devuelve { error } o { ok }. */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}

/** Botón que pide confirmación antes de enviar el formulario. */
export function ConfirmButton({
  children,
  message,
  variant = "secondary",
  className,
  pendingText,
}: {
  children: ReactNode;
  message: string;
  variant?: keyof typeof buttonStyles;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cx(buttonStyles[variant], className)}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? (pendingText ?? "Un momento…") : children}
    </button>
  );
}
