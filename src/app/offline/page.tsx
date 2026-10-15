import type { Metadata } from "next";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark className="size-16" />
      <h1 className="mt-6 text-2xl font-bold">Sin conexión</h1>
      <p className="mt-2 max-w-sm text-muted">
        Parece que no tienes internet. Tu cesta está guardada: cuando vuelvas a tener conexión, podrás seguir donde lo
        dejaste.
      </p>
      {/* Recarga completa (no navegación de cliente) para salir de la página guardada sin conexión */}
      <a href="/inicio" className="mt-6 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-ink">
        Reintentar
      </a>
    </main>
  );
}
