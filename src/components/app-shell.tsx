"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { Logo } from "./logo";
import { cx } from "./ui";

export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };

/** Estructura de las zonas con sesión: cabecera arriba y navegación inferior tipo app. */
export function AppShell({
  nav,
  homeHref,
  badge,
  children,
}: {
  nav: NavItem[];
  homeHref: string;
  badge?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo href={homeHref} />
          {badge && <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">{badge}</span>}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-nav">{children}</main>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-3xl">
          {nav.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
      </nav>
    </div>
  );
}
