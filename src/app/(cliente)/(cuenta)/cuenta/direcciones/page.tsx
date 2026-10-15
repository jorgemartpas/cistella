import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { EditableRow } from "@/components/store/editable-row";
import { Field, Input, PageHeader, PageSkeleton } from "@/components/ui";
import { updateDeliveryDetails } from "@/lib/actions/profile";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Direcciones" };

export default function AddressesPage() {
  return (
    <>
      <PageHeader title="Direcciones" />
      <Suspense fallback={<PageSkeleton />}>
        <Addresses />
      </Suspense>
    </>
  );
}

async function Addresses() {
  const profile = await requireRole("cliente");
  const hasAddress = Boolean(profile.address?.trim());
  return (
    <div className="card-surface px-5">
      <EditableRow
        title="Dirección de entrega"
        description="Donde te llevamos la compra. De momento solo repartimos en Alzira (46600)."
        value={
          hasAddress ? (
            <span className="flex items-start gap-2 font-normal">
              <Icon name="pin" className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block font-bold">{profile.address}</span>
                <span className="block text-sm text-muted">
                  {profile.postal_code} Alzira · Teléfono {profile.phone ?? "—"}
                </span>
              </span>
            </span>
          ) : (
            "Aún no has puesto tu dirección"
          )
        }
        action={hasAddress ? "Editar" : "Añadir"}
      >
        <ActionForm action={updateDeliveryDetails}>
          <Field label="Dirección de entrega" hint="Calle, número, piso y puerta">
            <Input name="address" defaultValue={profile.address ?? ""} autoComplete="street-address" required />
          </Field>
          <Field label="Código postal">
            <Input
              name="postal_code"
              defaultValue={profile.postal_code ?? "46600"}
              inputMode="numeric"
              autoComplete="postal-code"
              required
            />
          </Field>
          <Field label="Teléfono" hint="Para avisarte si hay algún problema con el reparto">
            <Input name="phone" defaultValue={profile.phone ?? ""} type="tel" autoComplete="tel" required />
          </Field>
          <SubmitButton className="w-full">Guardar dirección</SubmitButton>
        </ActionForm>
      </EditableRow>
    </div>
  );
}
