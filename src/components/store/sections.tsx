import Link from "next/link";
import type { ReactNode } from "react";
import type { SeasonHighlight } from "@/lib/domain/season";
import { Icon } from "../icons";
import { cx } from "../ui";

/** Bloque de la tienda: título en negrita, subtítulo gris y, a la derecha, un enlace «Ver …». */
export function StoreSection({
  title,
  subtitle,
  href,
  linkText,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkText?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("py-6 first:pt-0", className)}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 text-[15px] font-bold text-primary hover:underline"
          >
            {linkText ?? "Ver todo"} <Icon name="chevron" className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Destacado de temporada de «Productos del momento». */
export function SeasonHero({ highlight, href }: { highlight: SeasonHighlight; href: string }) {
  const [from, to] = highlight.colors;
  return (
    <div
      className="relative flex min-h-56 overflow-hidden rounded-[1.75rem] shadow-[0_18px_40px_-24px_rgb(60_30_10/0.7)] sm:min-h-64"
      style={{ background: `linear-gradient(120deg, ${from} 0%, ${to} 100%)` }}
    >
      <div className="relative z-10 flex max-w-md flex-col justify-center gap-4 p-6 sm:p-10">
        <h3 className="font-serif text-3xl font-bold leading-tight text-white sm:text-4xl">{highlight.title}</h3>
        <p className="text-white/85">{highlight.text}</p>
        <Link
          href={href}
          className="w-fit rounded-full bg-white/90 px-5 py-2.5 text-[15px] font-semibold text-[#1f2a1f] hover:bg-white"
        >
          Ver productos
        </Link>
      </div>
      <div aria-hidden className="pointer-events-none absolute -right-4 bottom-0 top-0 flex items-center gap-1 sm:right-6">
        {highlight.emojis.map((emoji, i) => (
          <span
            key={i}
            className={cx(
              "drop-shadow-xl",
              // El primero es el principal: va en medio y es el único que se ve en el móvil
              i === 0 ? "text-[7rem] sm:order-2 sm:text-[9rem]" : "hidden text-[6rem] opacity-90 sm:inline",
              i === 1 && "sm:order-1",
              i === 2 && "sm:order-3",
            )}
          >
            {emoji}
          </span>
        ))}
      </div>
    </div>
  );
}
