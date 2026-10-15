"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { Icon, type IconName } from "../icons";
import { cx } from "../ui";

const SECTIONS = [
  { href: "/categorias", label: "Categorías" },
  { href: "/cestas-guardadas", label: "Cestas" },
];

/** Enlaces de la cabecera, con la raya verde debajo del que está activo. */
export function StoreNav() {
  const pathname = usePathname();
  return <StoreNavLinks pathname={pathname} />;
}

export function StoreNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Secciones de la tienda" className="hidden items-center gap-1 md:flex">
      {SECTIONS.map((s) => {
        const active = pathname !== null && (pathname === s.href || pathname.startsWith(`${s.href}/`));
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] font-bold",
              active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

export type MenuItem = { href: string; label: string; icon: IconName };

const CUSTOMER_MENU: MenuItem[] = [
  { href: "/pedidos", label: "Mis pedidos", icon: "list" },
  { href: "/cuenta", label: "Mi plan", icon: "calendar" },
  { href: "/cuenta/datos", label: "Datos personales", icon: "user" },
  { href: "/cuenta/pago", label: "Método de pago", icon: "card" },
  { href: "/cestas-guardadas", label: "Cestas guardadas", icon: "bookmark" },
  { href: "/ayuda", label: "Preguntas frecuentes", icon: "help" },
];

/** «Hola Jorge» con su menú: pedidos, cuenta, ayuda y cerrar sesión (o las opciones que se pasen). */
export function UserMenu({ firstName, items = CUSTOMER_MENU }: { firstName: string; items?: MenuItem[] }) {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-[15px] font-semibold text-muted hover:text-text"
      >
        Hola {firstName}
        <Icon name="down" className={cx("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="menu"
          className="card-surface absolute right-0 top-12 z-40 w-64 overflow-hidden py-2"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[15px] hover:bg-surface-2"
            >
              <Icon name={item.icon} className="size-5 text-muted" />
              {item.label}
            </Link>
          ))}
          <form action={signOut} className="mt-1 border-t border-border pt-1">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] hover:bg-surface-2"
            >
              <Icon name="logout" className="size-5 text-muted" />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
