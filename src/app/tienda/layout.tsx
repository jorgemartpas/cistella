import { Suspense } from "react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { ChatHeaderLink } from "@/components/chat/chat-header-link";

const nav: NavItem[] = [
  { href: "/tienda", label: "Pedidos", icon: "list", exact: true },
  { href: "/tienda/productos", label: "Productos", icon: "box" },
  { href: "/tienda/inventario", label: "Inventario", icon: "stock" },
  { href: "/tienda/ventas", label: "Ganancias", icon: "chart" },
  { href: "/tienda/mensajes", label: "Mensajes", icon: "chat" },
];

export default function TiendaLayout({ children }: LayoutProps<"/tienda">) {
  return (
    <AppShell
      nav={nav}
      badge="Tienda"
      actions={
        <Suspense fallback={null}>
          <ChatHeaderLink />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
