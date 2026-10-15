import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/(auth)/actions";
import { Icon } from "./icons";
import { Logo } from "./logo";
import { ActiveNavList, NavList, type NavItem } from "./nav-list";

export type { NavItem };

/** Estructura de las zonas con sesión: cabecera arriba y navegación inferior tipo app. */
export function AppShell({ nav, badge, children }: { nav: NavItem[]; badge?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-1">
            {badge && <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">{badge}</span>}
            <form action={signOut}>
              <button
                type="submit"
                className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <Icon name="logout" className="size-5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-nav">{children}</main>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        {/* La pestaña activa depende de la URL: se marca al hidratar */}
        <Suspense fallback={<NavList nav={nav} pathname={null} />}>
          <ActiveNavList nav={nav} />
        </Suspense>
      </nav>
    </div>
  );
}
