/** Un pedido entregado, con lo que llevaba: id de producto (null si se borró) y cantidad */
export type DeliveredOrder = { items: { productId: string | null; quantity: number }[] };

/**
 * «Mis habituales»: los productos de los pedidos entregados, del más al menos pedido (en cuántos
 * pedidos aparece; a igualdad, el que más cantidad suma). Sin pedidos entregados, ninguno.
 */
export function rankUsualProducts(orders: DeliveredOrder[]): string[] {
  const stats = new Map<string, { orders: number; quantity: number }>();
  for (const order of orders) {
    const inOrder = new Map<string, number>();
    for (const item of order.items) {
      if (item.productId) inOrder.set(item.productId, (inOrder.get(item.productId) ?? 0) + item.quantity);
    }
    for (const [id, quantity] of inOrder) {
      const s = stats.get(id) ?? { orders: 0, quantity: 0 };
      stats.set(id, { orders: s.orders + 1, quantity: s.quantity + quantity });
    }
  }
  return [...stats.entries()]
    .sort(([, a], [, b]) => b.orders - a.orders || b.quantity - a.quantity)
    .map(([id]) => id);
}
