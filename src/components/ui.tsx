import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-12";

export const buttonStyles = {
  primary: cx(buttonBase, "bg-primary text-primary-ink hover:bg-primary-hover"),
  secondary: cx(buttonBase, "bg-surface text-text border border-border hover:bg-surface-2"),
  danger: cx(buttonBase, "bg-danger-soft text-danger hover:opacity-90"),
  ghost: cx(buttonBase, "text-primary hover:bg-primary-soft"),
  outline: cx(buttonBase, "border border-primary bg-surface text-primary hover:bg-primary-soft"),
  small: "inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold min-h-10 transition-colors disabled:opacity-50",
};

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link className={cx(buttonStyles[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("card-surface p-4", className)} {...props} />;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between gap-3">
      <h2 className="text-lg font-extrabold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

const toneStyles = {
  neutral: "bg-surface-2 text-muted",
  success: "bg-primary-soft text-primary",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
};
export type Tone = keyof typeof toneStyles;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", toneStyles[tone])}>
      {children}
    </span>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role="status" className={cx("rounded-lg px-4 py-3 text-sm", toneStyles[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : undefined}>{children}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm px-6 py-12 text-center">
      <div
        className="mx-auto flex size-28 items-center justify-center rounded-full bg-surface-2 text-6xl"
        aria-hidden
      >
        {icon}
      </div>
      <p className="mt-5 text-xl font-bold">{title}</p>
      {children && <div className="mt-2 text-muted">{children}</div>}
    </div>
  );
}

const inputStyles =
  "rounded-lg border border-border bg-surface px-3.5 py-3 text-text placeholder:text-muted/70 focus:border-primary focus:outline-none";

/** Ancho completo salvo que se pase otro ancho (w-24, w-auto…) */
function withWidth(className?: string) {
  return /(^|\s)(w-|min-w-0 flex-1)/.test(className ?? "") ? className : cx("w-full", className);
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  // La ayuda va fuera del <label> para que no forme parte del nombre del campo
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{label}</span>
        {children}
      </label>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputStyles, withWidth(className))} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputStyles, "appearance-auto", withWidth(className))} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputStyles, withWidth(className))} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-surface-2", className)} />;
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}
