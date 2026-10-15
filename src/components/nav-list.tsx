"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { cx } from "./ui";

export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };

export function NavList({ nav, pathname }: { nav: NavItem[]; pathname: string | null }) {
  return (
    <ul className="mx-auto flex max-w-3xl">
      {nav.map((item) => {
        const active =
          pathname !== null &&
          (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted hover:text-text",
              )}
            >
              <Icon name={item.icon} className="size-6" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ActiveNavList({ nav }: { nav: NavItem[] }) {
  return <NavList nav={nav} pathname={usePathname()} />;
}
