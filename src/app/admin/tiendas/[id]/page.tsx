import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { SHOP_TYPE_LABELS } from "@/lib/domain/orders";
import { createClient } from "@/lib/supabase/server";
import type { Shop } from "@/lib/types";
import { createShopAccount, resetShopPassword, saveShop } from "../actions";
import { ShopFields } from "../shop-fields";

export const metadata: Metadata = { title: "Tienda" };

export default function ShopPage({ params }: PageProps<"/admin/tiendas/[id]">) {
  return (
    <>
      <BackLink href="/admin/tiendas">Tiendas</BackLink>
      <Suspense fallback={<PageSkeleton />}>
        <ShopEditor params={params} />
      </Suspense>
    </>
  );
}

async function ShopEditor({ params }: Pick<PageProps<"/admin/tiendas/[id]">, "params">) {
  await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: shop }, { data: account }] = await Promise.all([
    supabase.from("shops").select("*").eq("id", id).maybeSingle<Shop>(),
    supabase.from("profiles").select("id, email").eq("shop_id", id).maybeSingle(),
  ]);
  if (!shop) notFound();

  return (
    <>
      <PageHeader title={shop.name} subtitle={SHOP_TYPE_LABELS[shop.type]} />
      <ActionForm action={saveShop}>
        <ShopFields shop={shop} defaultCommission={shop.commission_pct} />
        <SubmitButton className="w-full">Guardar cambios</SubmitButton>
      </ActionForm>

      <SectionTitle>Cuenta de acceso</SectionTitle>
      <Card>
        {account ? (
          <ActionForm action={resetShopPassword}>
            <p>
              La tienda entra con <strong>{account.email}</strong>.
            </p>
            <input type="hidden" name="user_id" value={account.id} />
            <Field label="Nueva contraseña" hint="Si la han olvidado. Mínimo 8 caracteres.">
              <Input name="password" type="text" autoComplete="off" minLength={8} required />
            </Field>
            <SubmitButton variant="secondary" className="w-full">
              Cambiar contraseña
            </SubmitButton>
          </ActionForm>
        ) : (
          <ActionForm action={createShopAccount}>
            <p className="text-sm text-muted">Esta tienda aún no puede entrar en Cistella. Crea su cuenta:</p>
            <input type="hidden" name="shop_id" value={shop.id} />
            <Field label="Email">
              <Input name="email" type="email" autoComplete="off" required />
            </Field>
            <Field label="Contraseña inicial" hint="Mínimo 8 caracteres">
              <Input name="password" type="text" autoComplete="off" minLength={8} required />
            </Field>
            <SubmitButton className="w-full">Crear cuenta</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
