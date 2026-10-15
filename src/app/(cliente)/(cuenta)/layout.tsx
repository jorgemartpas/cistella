import { Suspense } from "react";
import { AccountNav, AccountNavItems } from "@/components/store/account-nav";

/** Área de cuenta: menú gris a la izquierda y el contenido a la derecha. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:grid md:grid-cols-[16rem_1fr] md:gap-10">
      <aside className="md:pt-2">
        <Suspense fallback={<AccountNavItems pathname={null} />}>
          <AccountNav />
        </Suspense>
      </aside>
      <div className="min-w-0 max-w-3xl md:py-2">{children}</div>
    </div>
  );
}
