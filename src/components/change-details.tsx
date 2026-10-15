import { CATEGORY_LABELS } from "@/lib/domain/orders";
import { formatUnitPrice } from "@/lib/domain/money";
import type { ReviewedFields } from "@/lib/domain/product-changes";
import type { ChangeView } from "@/lib/product-changes";

const COMMON: Record<string, string> = {
  fruta: "todas las fruterías",
  verdura: "todas las fruterías",
  pescado: "todas las pescaderías",
};

function Photo({ url, label }: { url: string | null; label: string }) {
  return url ? (
    // Fotos subidas a Supabase Storage; no hace falta next/image
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={label} className="size-24 rounded-lg bg-surface-2 object-cover" />
  ) : (
    <span className="flex size-24 items-center justify-center rounded-lg bg-surface-2 text-xs text-muted">Sin foto</span>
  );
}

function Summary({ product, category }: { product: ReviewedFields; category: ChangeView["category"] }) {
  return (
    <div className="flex items-start gap-3">
      <Photo url={product.image_url} label={product.name} />
      <div className="min-w-0 text-sm">
        <p className="text-base font-semibold">{product.name}</p>
        {product.description && <p className="text-muted">{product.description}</p>}
        <p className="mt-1 font-semibold">{formatUnitPrice(product.price_cents, product.unit)}</p>
        <p className="text-muted">{CATEGORY_LABELS[category]}</p>
      </div>
    </div>
  );
}

/** Qué cambia: el producto nuevo, el antes y el después, o lo que se eliminaría. */
export function ChangeDetails({ change }: { change: ChangeView }) {
  const common = change.category !== "carne" ? COMMON[change.category] : null;
  return (
    <div className="space-y-3">
      {change.kind === "crear" && change.proposed && <Summary product={change.proposed} category={change.category} />}

      {change.kind === "editar" && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Qué</th>
                <th className="px-3 py-2 font-semibold">Ahora</th>
                <th className="px-3 py-2 font-semibold">Propuesto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {change.diffs.map((d) => (
                <tr key={d.field} className="align-top">
                  <th scope="row" className="px-3 py-2 text-left font-semibold">
                    {d.label}
                  </th>
                  <td className="px-3 py-2 text-muted">
                    {d.field === "image_url" ? <Photo url={d.from} label="Foto actual" /> : (d.from ?? "—")}
                  </td>
                  <td className="px-3 py-2 font-semibold">
                    {d.field === "image_url" ? <Photo url={d.to} label="Foto nueva" /> : (d.to ?? "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {change.kind === "eliminar" && change.current && (
        <>
          <Summary product={change.current} category={change.category} />
          <p className="text-sm font-medium text-danger">
            Al aceptarlo se borra del catálogo y se quita de las cestas de los clientes.
          </p>
        </>
      )}

      {common && (
        <p className="text-sm text-muted">
          Es del catálogo común: {change.kind === "crear" ? "saldrá para" : "afecta a"} {common}.
          {change.kind === "crear" && " La tienda que lo propone lo tendrá marcado como «lo tengo»."}
        </p>
      )}
    </div>
  );
}
