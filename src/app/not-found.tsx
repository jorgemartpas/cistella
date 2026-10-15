import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl" aria-hidden>
        🍂
      </div>
      <h1 className="mt-4 text-2xl font-bold">No encontramos esta página</h1>
      <p className="mt-2 text-muted">Puede que el enlace sea antiguo o que lo que buscas ya no exista.</p>
      <Link href="/inicio" className={`${buttonStyles.primary} mt-6 w-full`}>
        Ir al inicio
      </Link>
    </main>
  );
}
