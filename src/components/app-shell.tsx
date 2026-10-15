import { Suspense, type ReactNode } from "react";
import { signOut } from "@/app/(auth)/actions";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "./icons";
import { Logo } from "./logo";
import { ActiveNavList, NavList, type NavItem } from "./nav-list";
import { SideNav, SideNavItems } from "./side-nav";
import { UserMenu } from "./store/header-parts";

export type { NavItem };

/**
 * Estructura de los paneles con sesión (tienda y admin), con el mismo estilo que la tienda online:
 * cabecera blanca con «Hola …» y, en el ordenador, menú lateral gris; en el móvil, pestañas abajo.
 * `more` son secciones que solo van en el menú lateral y en el de «Hola …».
 */
export function AppShell({
  nav,
  more = [],
  badge,
  children,
}: {
  nav: NavItem[];
  more?: NavItem[];
  badge?: string;
  children: ReactNode;
}) {
  const all = [...nav, ...more];
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:h-[72px]">
          <Logo />
          {badge && (
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
              {badge}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Suspense fallback={null}>
              <Greeting items={all} />
            </Suspense>
            <form action={signOut} className="md:hidden">
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

      <div className="mx-auto flex w-full max-w-6xl flex-1">
        <aside className="hidden w-60 shrink-0 bg-surface-2 px-4 py-8 md:block">
          <Suspense fallback={<SideNavItems items={all} pathname={null} />}>
            <SideNav items={all} />
          </Suspense>
        </aside>
        <main className="pb-nav min-w-0 flex-1 px-4 pt-5 md:px-10 md:pt-8">
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
      </div>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {/* La pestaña activa depende de la URL: se marca al hidratar */}
        <Suspense fallback={<NavList nav={nav} pathname={null} />}>
          <ActiveNavList nav={nav} />
        </Suspense>
      </nav>
    </div>
  );
}

/** «Hola Carnicería Reino» (en una tienda) o «Hola Ana» (en el admin), con su menú. */
async function Greeting({ items }: { items: NavItem[] }) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  let name = profile.full_name?.trim().split(/\s+/)[0] || "";
  if (profile.role === "tienda" && profile.shop_id) {
    const supabase = await createClient();
    const { data: shop } = await supabase.from("shops").select("name").eq("id", profile.shop_id).maybeSingle();
    name = shop?.name ?? name;
  }
  return <UserMenu firstName={name} items={items.map(({ href, label, icon }) => ({ href, label, icon }))} />;
}
