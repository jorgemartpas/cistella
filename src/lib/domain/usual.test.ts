import { describe, expect, it } from "vitest";
import { rankUsualProducts } from "./usual";

describe("mis habituales", () => {
  it("sin pedidos entregados no hay habituales", () => {
    expect(rankUsualProducts([])).toEqual([]);
  });

  it("primero lo que aparece en más pedidos", () => {
    const orders = [
      { items: [{ productId: "naranjas", quantity: 2 }, { productId: "lomo", quantity: 0.5 }] },
      { items: [{ productId: "naranjas", quantity: 3 }] },
      { items: [{ productId: "naranjas", quantity: 1 }, { productId: "merluza", quantity: 1 }] },
    ];
    expect(rankUsualProducts(orders)).toEqual(["naranjas", "merluza", "lomo"]);
  });

  it("a igualdad de pedidos, el que más cantidad suma; un producto repetido en un pedido cuenta una vez", () => {
    const orders = [
      { items: [{ productId: "a", quantity: 1 }, { productId: "b", quantity: 2 }, { productId: "b", quantity: 2 }] },
      { items: [{ productId: "a", quantity: 1 }, { productId: "b", quantity: 1 }, { productId: null, quantity: 9 }] },
    ];
    expect(rankUsualProducts(orders)).toEqual(["b", "a"]);
  });
});
