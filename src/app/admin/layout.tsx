import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  { href: "/admin", label: "Inicio", icon: "home", exact: true },
  { href: "/admin/reparto", label: "Reparto", icon: "truck" },
  { href: "/admin/dias", label: "Días", icon: "calendar" },
  { href: "/admin/catalogo", label: "Catálogo", icon: "box" },
  { href: "/admin/tiendas", label: "Tiendas", icon: "store" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell nav={nav} homeHref="/admin" badge="Admin">
      {children}
    </AppShell>
  );
}
