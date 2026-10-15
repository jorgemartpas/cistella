import Form from "next/form";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getClientContext } from "@/lib/client-context";
import { formatEuros } from "@/lib/domain/money";
import { Icon } from "../icons";
import { LogoMark } from "../logo";
import { ActiveNavList, NavList, type NavItem } from "../nav-list";
import { StoreNav, StoreNavLinks, UserMenu } from "./header-parts";

const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: "home", exact: true },
  { href: "/categorias", label: "Categorías", icon: "grid" },
  { href: "/cestas-guardadas", label: "Cestas", icon: "bookmark" },
  { href: "/pedidos", label: "Pedidos", icon: "list" },
  { href: "/cuenta", label: "Cuenta", icon: "user" },
];

/** Estructura del portal del cliente: cabecera de tienda online, contenido y, en el móvil, pestañas abajo. */
export function StoreShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 bg-surface/95 pt-[env(safe-area-inset-top)] shadow-[0_8px_30px_-18px_rgb(16_40_28/0.3)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:h-[72px] md:gap-8">
          <Link href="/" aria-label="Cistella, inicio" className="flex shrink-0 items-center gap-2">
            <LogoMark className="size-10 md:size-11" />
            <span className="hidden text-lg font-bold tracking-tight lg:inline">Cistella</span>
          </Link>
          <Form action="/buscar" className="relative hidden max-w-xs flex-1 md:block" role="search">
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
            <input
              name="q"
              type="search"
              placeholder="Buscar productos"
              aria-label="Buscar productos"
              className="h-12 w-full rounded-full border border-transparent bg-surface-2 pl-11 pr-4 text-[15px] placeholder:text-muted focus:border-primary focus:bg-surface"
            />
          </Form>
          <Suspense fallback={<StoreNavLinks pathname={null} />}>
            <StoreNav />
          </Suspense>
          <div className="ml-auto flex items-center gap-1 md:gap-4">
            <Link
              href="/buscar"
              aria-label="Buscar productos"
              className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 md:hidden"
            >
              <Icon name="search" className="size-6" />
            </Link>
            <Suspense fallback={<BasketButton count={null} totalCents={null} />}>
              <HeaderAccount />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="pb-nav mx-auto w-full max-w-6xl flex-1 px-4 pt-5 md:pb-10 md:pt-7">{children}</main>

      <footer className="mx-auto hidden w-full max-w-6xl border-t border-border px-4 pb-24 pt-6 text-sm text-muted md:flex md:justify-between">
        <p>© Cistella · Alzira</p>
        <div className="flex gap-6">
          <Link href="/ayuda" className="hover:text-text">
            Preguntas frecuentes
          </Link>
          <Link href="/privacidad" className="hover:text-text">
            Política de privacidad
          </Link>
        </div>
      </footer>

      <Link
        href="/ayuda"
        className="fixed bottom-6 left-6 z-30 hidden items-center gap-2 rounded-full bg-primary py-2.5 pl-3 pr-5 font-semibold text-primary-ink shadow-lg hover:bg-primary-hover md:flex"
      >
        <Icon name="help" className="size-6" /> Ayuda
      </Link>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-20px_rgb(16_40_28/0.4)] md:hidden"
      >
        <Suspense fallback={<NavList nav={MOBILE_NAV} pathname={null} />}>
          <ActiveNavList nav={MOBILE_NAV} />
        </Suspense>
      </nav>
    </div>
  );
}

async function HeaderAccount() {
  const ctx = await getClientContext();
  return (
    <>
      {ctx.profile ? (
        <UserMenu firstName={ctx.profile.full_name?.trim().split(/\s+/)[0] || "de nuevo"} />
      ) : (
        <GuestLinks />
      )}
      <BasketButton count={ctx.basketCount} totalCents={ctx.basketTotalCents} />
    </>
  );
}

/** Visitante sin cuenta: cómo funciona y entrar (la cuenta se crea al confirmar el pedido) */
function GuestLinks() {
  return (
    <>
      <Link href="/como-funciona" className="hidden text-[15px] font-bold text-muted hover:text-text lg:inline">
        Cómo funciona
      </Link>
      <Link
        href="/entrar"
        className="hidden rounded-full border border-primary px-4 py-2 text-[15px] font-bold text-primary hover:bg-primary-soft md:inline-flex"
      >
        Entrar
      </Link>
      <Link
        href="/entrar"
        aria-label="Entrar"
        className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 md:hidden"
      >
        <Icon name="user" className="size-6" />
      </Link>
    </>
  );
}

/** Botón de la cesta: número de productos y total estimado, como el carro de una tienda online. */
function BasketButton({ count, totalCents }: { count: number | null; totalCents: number | null }) {
  return (
    <Link
      href="/cesta"
      aria-label={count === null ? "Mi cesta" : `Mi cesta: ${count} productos, ${formatEuros(totalCents ?? 0)}`}
      className="flex h-11 items-center gap-2 rounded-full bg-cart px-4 font-bold text-cart-ink shadow-[0_10px_22px_-10px_rgb(18_132_63/0.7)] hover:bg-cart-hover"
    >
      <Icon name="cart" className="size-5" />
      <span className="flex size-6 items-center justify-center rounded-full bg-cart-badge text-xs font-bold text-cart tabular-nums">
        {count ?? "·"}
      </span>
      <span className="text-sm tabular-nums">{totalCents === null ? "" : formatEuros(totalCents)}</span>
    </Link>
  );
}
