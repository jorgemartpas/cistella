import { StoreShell } from "@/components/store/store-shell";

export default function ClienteLayout({ children }: LayoutProps<"/">) {
  return <StoreShell>{children}</StoreShell>;
}
