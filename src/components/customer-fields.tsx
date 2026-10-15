import type { Profile } from "@/lib/types";
import { Field, Input } from "./ui";

/** Datos de contacto y entrega del cliente */
export function ProfileFields({ profile }: { profile: Profile }) {
  return (
    <>
      <Field label="Nombre y apellidos">
        <Input name="full_name" defaultValue={profile.full_name} autoComplete="name" required />
      </Field>
      <Field label="Teléfono" hint="Para avisarte el día del reparto">
        <Input name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" inputMode="tel" required />
      </Field>
      <Field label="Dirección de entrega" hint="Calle, número, piso y puerta">
        <Input name="address" defaultValue={profile.address ?? ""} autoComplete="street-address" required />
      </Field>
      <Field label="Código postal" hint="De momento solo repartimos en Alzira">
        <Input
          name="postal_code"
          defaultValue={profile.postal_code ?? "46600"}
          autoComplete="postal-code"
          inputMode="numeric"
          pattern="\d{5}"
          required
        />
      </Field>
    </>
  );
}
