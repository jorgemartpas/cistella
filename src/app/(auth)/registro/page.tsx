import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Notice } from "@/components/ui";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage({ searchParams }: PageProps<"/registro">) {
  return (
    <>
      <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
      <p className="mt-1 text-muted">
        Con tu cuenta confirmas tus pedidos; el plan lo eliges al confirmar el primero. Solo repartimos en Alzira (CP
        46600).
      </p>
      <ActionForm action={signUp} className="mt-6 space-y-4">
        <Suspense>
          <ReturnTo searchParams={searchParams} />
        </Suspense>
        <Field label="Nombre y apellidos">
          <Input name="full_name" autoComplete="name" required minLength={2} />
        </Field>
        <Field label="Email">
          <Input type="email" name="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres">
          <Input type="password" name="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="accept" required className="mt-1 size-5 accent-[var(--primary)]" />
          <span>
            He leído y acepto la{" "}
            <Link href="/privacidad" className="text-primary underline underline-offset-2" target="_blank">
              política de privacidad
            </Link>
            . Solo guardamos tu nombre, email, teléfono y dirección para llevarte los pedidos.
          </span>
        </label>
        <SubmitButton className="w-full" pendingText="Creando cuenta…">
          Crear cuenta
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Suspense
          fallback={
            <Link href="/entrar" className="font-semibold text-primary underline underline-offset-2">
              Entra
            </Link>
          }
        >
          <LoginLink searchParams={searchParams} />
        </Suspense>
      </p>
    </>
  );
}

/** A dónde se va después de crear la cuenta (por ejemplo, a elegir el plan para confirmar el pedido) */
async function ReturnTo({ searchParams }: Pick<PageProps<"/registro">, "searchParams">) {
  const { volver } = await searchParams;
  if (typeof volver !== "string") return null;
  return (
    <>
      {volver.includes("confirmar=1") && (
        <Notice tone="success">Para confirmar tu pedido, crea tu cuenta. Tu cesta no se pierde.</Notice>
      )}
      <input type="hidden" name="volver" value={volver} />
    </>
  );
}

async function LoginLink({ searchParams }: Pick<PageProps<"/registro">, "searchParams">) {
  const { volver } = await searchParams;
  // Quien ya tiene cuenta y venía a confirmar vuelve a su cesta para confirmarlo
  const after = typeof volver === "string" && volver.includes("confirmar=1") ? "/cesta?confirmar=1" : null;
  return (
    <Link
      href={after ? `/entrar?volver=${encodeURIComponent(after)}` : "/entrar"}
      className="font-semibold text-primary underline underline-offset-2"
    >
      Entra
    </Link>
  );
}
