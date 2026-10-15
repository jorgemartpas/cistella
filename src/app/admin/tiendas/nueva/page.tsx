import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader, PageSkeleton } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveShop } from "../actions";
import { ShopFields } from "../shop-fields";

export const metadata: Metadata = { title: "Nueva tienda" };

export default function NewShopPage() {
  return (
    <>
      <BackLink href="/admin/tiendas">Tiendas</BackLink>
      <PageHeader title="Nueva tienda" />
      <Suspense fallback={<PageSkeleton />}>
        <NewShopForm />
      </Suspense>
    </>
  );
}

async function NewShopForm() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("default_commission_pct").single();
  return (
    <ActionForm action={saveShop}>
      <ShopFields defaultCommission={settings?.default_commission_pct ?? 10} />
      <Card className="space-y-4">
        <div>
          <p className="font-semibold">Cuenta de acceso de la tienda</p>
          <p className="text-sm text-muted">Opcional: también puedes crearla después desde la ficha.</p>
        </div>
        <Field label="Email">
          <Input name="account_email" type="email" autoComplete="off" />
        </Field>
        <Field label="Contraseña inicial" hint="Mínimo 8 caracteres. Pásasela a la tienda por un canal seguro.">
          <Input name="account_password" type="text" autoComplete="off" minLength={8} />
        </Field>
      </Card>
      <SubmitButton className="w-full">Crear tienda</SubmitButton>
    </ActionForm>
  );
}
