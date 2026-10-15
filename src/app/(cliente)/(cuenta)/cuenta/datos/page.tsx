import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileFields } from "@/components/customer-fields";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { updateProfile } from "@/lib/actions/profile";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Datos personales" };

export default function PersonalDataPage() {
  return (
    <>
      <PageHeader title="Datos personales" subtitle="Tu nombre, teléfono y la dirección donde te llevamos la compra." />
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
      <ActionForm action={updateProfile}>
        <p className="text-sm text-muted">Email: {profile.email}</p>
        <ProfileFields profile={profile} />
        <SubmitButton className="w-full sm:w-auto sm:px-8">Guardar datos</SubmitButton>
      </ActionForm>

      <SectionTitle>Privacidad</SectionTitle>
      <p className="text-sm text-muted">
        Solo guardamos lo necesario para llevarte la compra. Lee la{" "}
        <Link href="/privacidad" className="underline">
          política de privacidad
        </Link>{" "}
        o escríbenos si quieres borrar tu cuenta.
      </p>
    </>
  );
}
