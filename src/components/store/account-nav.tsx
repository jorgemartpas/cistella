"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { Icon, type IconName } from "../icons";
import { cx } from "../ui";

const ITEMS: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: "/pedidos", label: "Mis pedidos", icon: "list" },
  { href: "/cuenta", label: "Mi plan", icon: "calendar", exact: true },
  { href: "/cuenta/datos", label: "Datos personales", icon: "user" },
  { href: "/cuenta/pago", label: "Método de pago", icon: "card" },
  { href: "/listas", label: "Listas y cestas", icon: "bookmark" },
  { href: "/ayuda", label: "Preguntas frecuentes", icon: "help" },
];

/** Menú lateral de la cuenta (en el móvil, una fila que se desliza). */
export function AccountNav() {
  return <AccountNavItems pathname={usePathname()} />;
}

export function AccountNavItems({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Mi cuenta" className="-mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:mb-0 md:overflow-visible md:px-0">
      <ul className="flex gap-2 md:flex-col md:gap-1">
        {ITEMS.map((item) => {
          const active =
            pathname !== null &&
            (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] font-semibold md:py-3",
                  active
                    ? "bg-primary text-primary-ink shadow-[0_10px_22px_-12px_rgb(18_132_63/0.8)] md:bg-surface md:text-primary md:shadow-sm"
                    : "bg-surface shadow-sm hover:text-primary md:bg-transparent md:shadow-none",
                )}
              >
                <Icon name={item.icon} className="hidden size-5 md:block" />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="md:mt-6">
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-3 whitespace-nowrap rounded-full bg-surface px-4 py-2.5 text-[15px] font-semibold shadow-sm hover:text-primary md:bg-transparent md:py-3 md:shadow-none"
            >
              <Icon name="logout" className="hidden size-5 md:block" />
              Cerrar sesión
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
