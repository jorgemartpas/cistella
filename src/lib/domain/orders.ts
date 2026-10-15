import type { ISODate } from "./dates";
import { lineTotalCents, type ProductUnit } from "./money";
import { isDueOn, type SubscriptionCadence } from "./subscription";

export type ProductCategory = "carne" | "fruta" | "verdura" | "pescado";
export type ShopType = "carniceria" | "pescaderia" | "fruteria";

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  fruta: "Fruta",
  verdura: "Verdura",
  pescado: "Pescado",
  carne: "Carne",
};

export const SHOP_TYPE_LABELS: Record<ShopType, string> = {
  carniceria: "Carnicería",
  pescaderia: "Pescadería",
  fruteria: "Frutería",
};

/** Qué tipo de tienda sirve cada categoría (igual que shop_type_for_category en SQL). */
export function shopTypeForCategory(category: ProductCategory): ShopType {
  if (category === "carne") return "carniceria";
  if (category === "pescado") return "pescaderia";
  return "fruteria";
}

export type PlanProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  shopId: string | null;
  unit: ProductUnit;
  priceCents: number;
  active: boolean;
};

export type PlanCustomer = {
  customerId: string;
  name: string;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  subscription: SubscriptionCadence;
};

export type PlanDay = {
  id: string;
  date: ISODate;
  fruteriaId: string | null;
  pescaderiaId: string | null;
};

export type PlanInput = {
  day: PlanDay;
  customers: PlanCustomer[];
  basket: { customerId: string; productId: string; quantity: number }[];
  products: PlanProduct[];
  /** Pares tienda-producto marcados como disponibles en el catálogo unificado */
  availability: { shopId: string; productId: string; available: boolean }[];
  activeShopIds: string[];
  minOrderCents: number;
};

export type SkipReason = "no_disponible" | "sin_tienda" | "producto_retirado";

export type PlannedItem = {
  productId: string;
  productName: string;
  unit: ProductUnit;
  quantity: number;
  unitPriceCents: number;
};

export type PlannedOrder = {
  customerId: string;
  customerName: string;
  phone: string | null;
  address: string;
  postalCode: string | null;
  estimatedTotalCents: number;
  skippedItems: { productId: string; productName: string; reason: SkipReason }[];
  shops: { shopId: string; items: PlannedItem[] }[];
};

export type SkippedCustomerReason = "cesta_vacia" | "sin_productos" | "pedido_minimo" | "sin_direccion";

export type OrderPlan = {
  orders: PlannedOrder[];
  skippedCustomers: { customerId: string; reason: SkippedCustomerReason; totalCents?: number }[];
};

/**
 * Convierte las cestas de los clientes a los que les toca reparto en pedidos por tienda.
 * La carne va a la carnicería de cada producto; fruta y verdura a la frutería de turno y
 * el pescado a la pescadería de turno, siempre que esa tienda tenga el producto.
 */
export function planOrdersForDay(input: PlanInput): OrderPlan {
  const { day } = input;
  const products = new Map(input.products.map((p) => [p.id, p]));
  const activeShops = new Set(input.activeShopIds);
  const available = new Set(
    input.availability.filter((a) => a.available).map((a) => `${a.shopId}:${a.productId}`),
  );
  const basketByCustomer = new Map<string, PlanInput["basket"]>();
  for (const line of input.basket) {
    const lines = basketByCustomer.get(line.customerId) ?? [];
    lines.push(line);
    basketByCustomer.set(line.customerId, lines);
  }

  const shopOnDuty = (product: PlanProduct): string | null => {
    const shopId =
      product.category === "carne"
        ? product.shopId
        : product.category === "pescado"
          ? day.pescaderiaId
          : day.fruteriaId;
    return shopId && activeShops.has(shopId) ? shopId : null;
  };

  const plan: OrderPlan = { orders: [], skippedCustomers: [] };

  const customers = [...input.customers].sort((a, b) => a.customerId.localeCompare(b.customerId));
  for (const customer of customers) {
    if (!isDueOn(customer.subscription, day.date)) continue;

    const lines = basketByCustomer.get(customer.customerId) ?? [];
    if (lines.length === 0) {
      plan.skippedCustomers.push({ customerId: customer.customerId, reason: "cesta_vacia" });
      continue;
    }
    if (!customer.address?.trim()) {
      plan.skippedCustomers.push({ customerId: customer.customerId, reason: "sin_direccion" });
      continue;
    }

    const byShop = new Map<string, PlannedItem[]>();
    const skippedItems: PlannedOrder["skippedItems"] = [];
    for (const line of lines) {
      const product = products.get(line.productId);
      if (!product || !product.active) {
        skippedItems.push({
          productId: line.productId,
          productName: product?.name ?? "Producto retirado",
          reason: "producto_retirado",
        });
        continue;
      }
      const shopId = shopOnDuty(product);
      if (!shopId) {
        skippedItems.push({ productId: product.id, productName: product.name, reason: "sin_tienda" });
        continue;
      }
      if (product.shopId === null && !available.has(`${shopId}:${product.id}`)) {
        skippedItems.push({ productId: product.id, productName: product.name, reason: "no_disponible" });
        continue;
      }
      const items = byShop.get(shopId) ?? [];
      items.push({
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: line.quantity,
        unitPriceCents: product.priceCents,
      });
      byShop.set(shopId, items);
    }

    if (byShop.size === 0) {
      plan.skippedCustomers.push({ customerId: customer.customerId, reason: "sin_productos" });
      continue;
    }

    const shops = [...byShop.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([shopId, items]) => ({
        shopId,
        items: items.sort((a, b) => a.productName.localeCompare(b.productName, "es")),
      }));
    const estimatedTotalCents = shops
      .flatMap((s) => s.items)
      .reduce((sum, item) => sum + lineTotalCents(item.quantity, item.unitPriceCents), 0);

    if (estimatedTotalCents < input.minOrderCents) {
      plan.skippedCustomers.push({
        customerId: customer.customerId,
        reason: "pedido_minimo",
        totalCents: estimatedTotalCents,
      });
      continue;
    }

    plan.orders.push({
      customerId: customer.customerId,
      customerName: customer.name,
      phone: customer.phone,
      address: customer.address.trim(),
      postalCode: customer.postalCode,
      estimatedTotalCents,
      skippedItems,
      shops,
    });
  }

  return plan;
}

/** Importe final con las cantidades reales que ha indicado cada tienda. */
export function finalTotalCents(
  items: { quantityOrdered: number; quantityActual: number | null; unitPriceCents: number }[],
): number {
  return items.reduce(
    (sum, item) => sum + lineTotalCents(item.quantityActual ?? item.quantityOrdered, item.unitPriceCents),
    0,
  );
}
