import { ProductImage } from "@/components/product-image";
import { QuantityStepper } from "@/components/quantity-stepper";
import { getClientContext, getListMembership } from "@/lib/client-context";
import { formatEuros, UNIT_LABELS } from "@/lib/domain/money";
import type { Product } from "@/lib/types";
import { SaveToList } from "./save-to-list";

/** Rejilla de tarjetas de producto, con su cantidad en la cesta y el botón de guardar en lista. */
export async function ProductGrid({ products }: { products: Product[] }) {
  const [ctx, membership] = await Promise.all([getClientContext(), getListMembership()]);
  const shopName = new Map(ctx.shops.map((s) => [s.id, s.name]));
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id} className="flex flex-col">
          <div className="relative">
            <ProductImage
              product={product}
              neutral
              className="aspect-square w-full"
              iconClassName="text-6xl sm:text-7xl"
            />
            <div className="absolute right-2 top-2">
              <SaveToList
                productId={product.id}
                productName={product.name}
                lists={membership.lists}
                memberOf={membership.byProduct.get(product.id) ?? []}
              />
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-[15px] leading-snug">{product.name}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">
            {product.shop_id ? shopName.get(product.shop_id) : (product.description ?? "")}
            {product.shop_id && product.description ? ` · ${product.description}` : ""}
          </p>
          <p className="mt-1">
            <span className="text-lg font-bold">{formatEuros(product.price_cents)}</span>{" "}
            <span className="text-sm text-muted">/{UNIT_LABELS[product.unit].short}</span>
          </p>
          {ctx.unavailable.has(product.id) && (
            <p className="text-xs font-medium text-warning">No lo tiene la tienda de turno del próximo reparto</p>
          )}
          <div className="mt-auto pt-2">
            <QuantityStepper
              productId={product.id}
              productName={product.name}
              unit={product.unit}
              quantity={ctx.basket.get(product.id) ?? 0}
              slot={ctx.slot}
              variant="card"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
