import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <>
      <h1 className="text-2xl font-bold">Entrar</h1>
      <p className="mt-1 text-muted">Clientes, tiendas y equipo de Cistella.</p>
      <ActionForm action={signIn} className="mt-6 space-y-4">
        <Suspense>
          <ReturnTo searchParams={searchParams} />
        </Suspense>
        <Field label="Email">
          <Input type="email" name="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field label="Contraseña">
          <Input type="password" name="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Entrando…">
          Entrar
        </SubmitButton>
      </ActionForm>
      <div className="mt-6 space-y-2 text-center text-sm">
        <p>
          <Link href="/recuperar" className="text-primary underline underline-offset-2">
            He olvidado mi contraseña
          </Link>
        </p>
        <p className="text-muted">
          ¿Aún no tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-primary underline underline-offset-2">
            Suscríbete
          </Link>
        </p>
      </div>
    </>
  );
}

async function ReturnTo({ searchParams }: Pick<PageProps<"/entrar">, "searchParams">) {
  const { volver } = await searchParams;
  return typeof volver === "string" ? <input type="hidden" name="volver" value={volver} /> : null;
}
