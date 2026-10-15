import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  { href: "/tienda", label: "Pedidos", icon: "list", exact: true },
  { href: "/tienda/productos", label: "Productos", icon: "box" },
  { href: "/tienda/ventas", label: "Ganancias", icon: "chart" },
];

export default function TiendaLayout({ children }: LayoutProps<"/tienda">) {
  return (
    <AppShell nav={nav} badge="Tienda">
      {children}
    </AppShell>
  );
}
