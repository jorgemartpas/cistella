import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangeDetails } from "@/components/change-details";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, Field, Input, Notice, PageHeader, PageSkeleton, SectionTitle } from "@/components/ui";
import { reviewProductChange } from "@/lib/actions/product-changes";
import { requireRole } from "@/lib/auth";
import { capitalize, formatCutoff } from "@/lib/format";
import { loadChanges } from "@/lib/product-changes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Revisiones" };

export default function ReviewsPage({ searchParams }: PageProps<"/admin/revisiones">) {
  return (
    <>
      <PageHeader
        title="Revisiones"
        subtitle="Cambios que proponen las tiendas. Hasta que los aceptes, la tienda online sigue como está."
      />
      <Suspense>
        <DoneNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<PageSkeleton />}>
        <Reviews />
      </Suspense>
    </>
  );
}

async function DoneNotice({ searchParams }: Pick<PageProps<"/admin/revisiones">, "searchParams">) {
  const { hecho } = await searchParams;
  if (hecho !== "aceptado" && hecho !== "rechazado") return null;
  return (
    <div className="mb-4">
      <Notice tone={hecho === "aceptado" ? "success" : "info"}>
        {hecho === "aceptado" ? "Aceptado: ya está en la tienda." : "Rechazado. La tienda verá el motivo."}
      </Notice>
    </div>
  );
}

async function Reviews() {
  await requireRole("admin");
  const supabase = await createClient();
  const [pending, reviewed] = await Promise.all([
    loadChanges(supabase, { pending: true }),
    loadChanges(supabase, { pending: false, limit: 20 }),
  ]);

  return (
    <>
      {pending.length === 0 ? (
        <EmptyState icon="✅" title="No hay nada pendiente">
          Cuando una tienda cambie un precio, un nombre o una foto, o pida añadir o quitar un producto, aparecerá aquí.
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {pending.map((change) => (
            <li key={change.id}>
              <Card className="space-y-4 p-5">
                <div>
                  <p className="text-lg font-bold leading-snug">{change.title}</p>
                  <p className="mt-0.5 text-sm text-muted">Lo pidió el {formatCutoff(change.createdAt)}</p>
                </div>
                <ChangeDetails change={change} />
                <ActionForm action={reviewProductChange} className="space-y-3 border-t border-border pt-4">
                  <input type="hidden" name="change_id" value={change.id} />
                  <Field label="Motivo (opcional)" hint="Si lo rechazas, la tienda lo verá.">
                    <Input name="note" maxLength={300} autoComplete="off" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <SubmitButton name="decision" value="aceptar" pendingText="Guardando…">
                      Aceptar
                    </SubmitButton>
                    <SubmitButton name="decision" value="rechazar" variant="danger" pendingText="Guardando…">
                      Rechazar
                    </SubmitButton>
                  </div>
                </ActionForm>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {reviewed.length > 0 && (
        <>
          <SectionTitle>Revisados</SectionTitle>
          <ul className="card-surface divide-y divide-border">
            {reviewed.map((change) => (
              <li key={change.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{change.title}</p>
                  <p className="text-muted">
                    {change.reviewedAt && capitalize(formatCutoff(change.reviewedAt))}
                    {change.reviewNote && ` · «${change.reviewNote}»`}
                  </p>
                </div>
                <Badge tone={change.status === "aprobado" ? "success" : "danger"}>
                  {change.status === "aprobado" ? "Aceptado" : "Rechazado"}
                </Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
