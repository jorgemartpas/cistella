import { Suspense } from "react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { ReviewBell } from "@/components/review-bell";

const nav: NavItem[] = [
  { href: "/admin", label: "Inicio", icon: "home", exact: true },
  { href: "/admin/reparto", label: "Reparto", icon: "truck" },
  { href: "/admin/dias", label: "Días", icon: "calendar" },
  { href: "/admin/catalogo", label: "Catálogo", icon: "box" },
  { href: "/admin/tiendas", label: "Tiendas", icon: "store" },
];

// Solo en el menú lateral y en el de «Hola …» (en el móvil se llega desde el inicio)
const more: NavItem[] = [
  { href: "/admin/revisiones", label: "Revisiones", icon: "bell" },
  { href: "/admin/clientes", label: "Clientes", icon: "users" },
  { href: "/admin/ventas", label: "Ventas", icon: "chart" },
  { href: "/admin/ajustes", label: "Ajustes", icon: "sliders" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell
      nav={nav}
      more={more}
      badge="Admin"
      actions={
        <Suspense fallback={null}>
          <ReviewBell />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
