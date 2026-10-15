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
                  "flex items-center gap-3 whitespace-nowrap rounded-full border px-4 py-2 text-[15px] md:rounded-lg md:border-0 md:px-3 md:py-3",
                  active
                    ? "border-primary font-semibold text-primary md:bg-surface"
                    : "border-border text-text hover:text-primary",
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
              className="flex items-center gap-3 whitespace-nowrap rounded-full border border-border px-4 py-2 text-[15px] hover:text-primary md:rounded-lg md:border-0 md:px-3 md:py-3"
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
