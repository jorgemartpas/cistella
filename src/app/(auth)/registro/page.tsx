import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
      <p className="mt-1 text-muted">
        Después eliges cada cuánto quieres el reparto y montas tu cesta. Solo repartimos en Alzira (CP 46600).
      </p>
      <ActionForm action={signUp} className="mt-6 space-y-4">
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
        <Link href="/entrar" className="font-semibold text-primary underline underline-offset-2">
          Entra
        </Link>
      </p>
    </>
  );
}
