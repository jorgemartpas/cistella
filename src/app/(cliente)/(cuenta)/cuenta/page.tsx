import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EditableRow } from "@/components/store/editable-row";
import { Field, Input, PageHeader, PageSkeleton } from "@/components/ui";
import { changePassword, deleteAccount, updateEmail } from "@/lib/actions/account";
import { updateFullName } from "@/lib/actions/profile";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Datos personales" };

// Portada de «Mi cuenta»
export default function PersonalDataPage() {
  return (
    <>
      <PageHeader title="Datos personales" />
      <Suspense fallback={<PageSkeleton />}>
        <PersonalData />
      </Suspense>
    </>
  );
}

async function PersonalData() {
  const profile = await requireRole("cliente");
  return (
    <>
      <div className="card-surface divide-y divide-border px-5">
        <EditableRow
          title="Nombre completo"
          description="Indícanos tu nombre y apellidos para localizarte en relación a tu pedido."
          value={profile.full_name || "—"}
        >
          <ActionForm action={updateFullName}>
            <Field label="Nombre y apellidos">
              <Input name="full_name" defaultValue={profile.full_name} autoComplete="name" required minLength={2} />
            </Field>
            <SubmitButton className="w-full">Guardar</SubmitButton>
          </ActionForm>
        </EditableRow>

        <EditableRow
          title="Email"
          description="Tu email es también el usuario de acceso a la cuenta."
          value={profile.email}
        >
          <ActionForm action={updateEmail}>
            <Field label="Email nuevo">
              <Input name="email" type="email" autoComplete="email" inputMode="email" required />
            </Field>
            <SubmitButton className="w-full">Cambiar el email</SubmitButton>
          </ActionForm>
        </EditableRow>

        <EditableRow title="Métodos de inicio de sesión" description="Cambia tu contraseña o cómo accedes a tu cuenta.">
          <ActionForm action={changePassword}>
            <Field label="Contraseña actual">
              <Input name="current" type="password" autoComplete="current-password" required />
            </Field>
            <Field label="Contraseña nueva" hint="Mínimo 8 caracteres">
              <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
            </Field>
            <Field label="Repite la contraseña nueva">
              <Input name="password_confirm" type="password" autoComplete="new-password" required minLength={8} />
            </Field>
            <SubmitButton className="w-full">Cambiar la contraseña</SubmitButton>
          </ActionForm>
        </EditableRow>

        <EditableRow
          title="Eliminar tu cuenta de usuario"
          description="Se borran tus datos, tu plan y tus cestas. No se puede deshacer."
          action="Eliminar"
          danger
        >
          <ActionForm action={deleteAccount}>
            <p className="text-sm">
              Cancelamos tu cuota y borramos tu cuenta. Los pedidos ya entregados se conservan sin tus datos personales,
              para las cuentas de las tiendas. Si tienes un pedido en curso, espera a recibirlo.
            </p>
            <Field label="Escribe ELIMINAR para confirmarlo">
              <Input name="confirm" autoComplete="off" required />
            </Field>
            <SubmitButton variant="danger" className="w-full" pendingText="Eliminando…">
              Eliminar mi cuenta
            </SubmitButton>
          </ActionForm>
        </EditableRow>
      </div>

      <p className="mt-6 text-sm text-muted">
        Solo guardamos lo necesario para llevarte la compra. Lee la{" "}
        <Link href="/privacidad" className="underline">
          política de privacidad
        </Link>
        .
      </p>
    </>
  );
}
