import { CATEGORY_LABELS } from "@/lib/domain/orders";
import { formatQuantity } from "@/lib/domain/money";
import { formatCutoff, formatDay } from "@/lib/format";
import type { InventoryRow, ShopInventory } from "@/lib/inventory";
import { StockInput } from "./stock-input";
import { Badge, EmptyState, Notice } from "./ui";

/** Inventario de una tienda frente a su próximo reparto. Lo ven y lo editan la tienda y el admin. */
export function InventoryView({ data, forAdmin = false }: { data: ShopInventory; forAdmin?: boolean }) {
  const { shop, day, preview, marginKg, rows } = data;
  const short = rows.filter((r) => r.status === "no_llega");
  const categories = [...new Set(rows.map((r) => r.product.category))];
  const margin = formatQuantity(marginKg, "kg");

  return (
    <>
      <p className="mb-4 text-sm text-muted">
        Apunta cuánto {forAdmin ? "tiene" : "tienes"} de cada producto. Solo lo ven {forAdmin ? "la tienda" : "tú"} y el
        equipo de LaCistella; los clientes no. Al marcar un pedido como preparado se resta lo servido, con el peso real.
        Si lo pedido pasa de lo que hay, sale en naranja mientras esté dentro del margen ({margin}, en lo que va al peso) y
        en rojo si lo supera. Deja la casilla vacía para no llevar inventario de un producto.
      </p>

      <div className="mb-4 space-y-3">
        {day ? (
          <Notice tone="info" title={`Próximo reparto: ${formatDay(day.date)}`}>
            {preview
              ? `«Pedido» es lo confirmado hasta ahora; puede cambiar hasta el cierre (${formatCutoff(day.cutoff_at)}).`
              : "Pedidos generados: «Pedido» es lo que queda por preparar (lo preparado ya se ha restado)."}
          </Notice>
        ) : (
          <Notice tone="info">{forAdmin ? "No tiene" : "No tienes"} ningún reparto programado.</Notice>
        )}
        {short.length > 0 && (
          <Notice tone="danger" title={short.length === 1 ? "1 producto no llega" : `${short.length} productos no llegan`}>
            {short.map((r) => r.product.name).join(", ")}.
          </Notice>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="📦" title="No hay productos">
          {shop.type === "carniceria" ? "Crea tus productos en «Productos»." : "Aún no hay productos en el catálogo."}
        </EmptyState>
      ) : (
        categories.map((category) => (
          <section key={category} className="mb-6">
            {categories.length > 1 && <h2 className="mb-2 font-bold">{CATEGORY_LABELS[category]}</h2>}
            <ul className="card-surface divide-y divide-border">
              {rows
                .filter((r) => r.product.category === category)
                .map((row) => (
                  <li key={row.product.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {row.product.name}
                        {!row.available && <span className="ml-2 text-xs font-normal text-muted">(no disponible)</span>}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                        Pedido: {row.ordered > 0 ? formatQuantity(row.ordered, row.product.unit) : "nada"}
                        <StatusBadge row={row} margin={margin} />
                      </p>
                    </div>
                    <StockInput
                      shopId={shop.id}
                      productId={row.product.id}
                      productName={row.product.name}
                      unit={row.product.unit}
                      stock={row.stock}
                    />
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

function StatusBadge({ row, margin }: { row: InventoryRow; margin: string }) {
  if (row.ordered === 0) return null;
  const over = row.stock === null ? 0 : row.ordered - row.stock;
  switch (row.status) {
    case "suficiente":
      return <Badge tone="success">Llega</Badge>;
    case "justo":
      return <Badge tone="warning">Justo: pasa {formatQuantity(over, row.product.unit)} (margen {margin})</Badge>;
    case "no_llega":
      return <Badge tone="danger">No llega: faltan {formatQuantity(over, row.product.unit)}</Badge>;
    default:
      return <Badge tone="neutral">Sin apuntar</Badge>;
  }
}
