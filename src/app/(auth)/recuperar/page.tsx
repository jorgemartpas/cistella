import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ResetPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
      <p className="mt-1 text-muted">Te enviamos un enlace para elegir una nueva.</p>
      <ActionForm action={requestPasswordReset} className="mt-6 space-y-4">
        <Field label="Email">
          <Input type="email" name="email" autoComplete="email" inputMode="email" required />
        </Field>
        <SubmitButton className="w-full" pendingText="Enviando…">
          Enviar enlace
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm">
        <Link href="/entrar" className="text-primary underline underline-offset-2">
          Volver a entrar
        </Link>
      </p>
    </>
  );
}
