import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  { href: "/cesta", label: "Mi cesta", icon: "basket" },
  { href: "/pedidos", label: "Pedidos", icon: "list" },
  { href: "/cuenta", label: "Cuenta", icon: "user" },
];

export default function ClienteLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell nav={nav} homeHref="/cesta">
      {children}
    </AppShell>
  );
}
