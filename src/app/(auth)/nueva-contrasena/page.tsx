import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { updatePassword } from "../actions";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function NewPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Elige una contraseña nueva</h1>
      <ActionForm action={updatePassword} className="mt-6 space-y-4">
        <Field label="Contraseña nueva" hint="Mínimo 8 caracteres">
          <Input type="password" name="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Repítela">
          <Input type="password" name="password_confirm" autoComplete="new-password" required minLength={8} />
        </Field>
        <SubmitButton className="w-full">Guardar contraseña</SubmitButton>
      </ActionForm>
    </>
  );
}
