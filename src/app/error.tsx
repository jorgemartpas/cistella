"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonStyles } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl" aria-hidden>
        🧺
      </div>
      <h1 className="mt-4 text-2xl font-bold">Algo no ha ido bien</h1>
      <p className="mt-2 text-muted">
        No hemos podido cargar esta página. Vuelve a intentarlo en un momento; si sigue fallando, escríbenos.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted">Código: {error.digest}</p>}
      <div className="mt-6 flex w-full flex-col gap-2">
        <button type="button" onClick={reset} className={buttonStyles.primary}>
          Reintentar
        </button>
        <Link href="/inicio" className={buttonStyles.secondary}>
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
