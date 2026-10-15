"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { Icon } from "./icons";
import type { NavItem } from "./nav-list";
import { cx } from "./ui";

/** Menú lateral gris de los paneles (tienda y admin) en el ordenador. */
export function SideNav({ items }: { items: NavItem[] }) {
  return <SideNavItems items={items} pathname={usePathname()} />;
}

export function SideNavItems({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <nav aria-label="Secciones">
      <ul className="space-y-1">
        {items.map((item) => {
          const active =
            pathname !== null &&
            (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-[15px]",
                  active ? "bg-surface font-semibold text-primary" : "text-text hover:text-primary",
                )}
              >
                <Icon name={item.icon} className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="pt-6">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] hover:text-primary"
            >
              <Icon name="logout" className="size-5" />
              Cerrar sesión
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
