import { describe, expect, it } from "vitest";
import { demandByProduct, stockStatus } from "./inventory";

describe("inventario de la tienda", () => {
  it("30 kg de mandarinas para 30 pedidos de 1 kg: llega", () => {
    expect(stockStatus(30, 30, "kg", 5)).toBe("suficiente");
  });

  it("si se pasa, avisa: dentro del margen es «justo» y por encima «no llega»", () => {
    expect(stockStatus(30, 33, "kg", 5)).toBe("justo");
    expect(stockStatus(30, 35, "kg", 5)).toBe("justo");
    expect(stockStatus(30, 35.5, "kg", 5)).toBe("no_llega");
  });

  it("el margen se puede ajustar (0 = sin margen)", () => {
    expect(stockStatus(30, 31, "kg", 0)).toBe("no_llega");
    expect(stockStatus(30, 39, "kg", 10)).toBe("justo");
  });

  it("en unidades y bandejas no hay margen", () => {
    expect(stockStatus(10, 11, "unidad", 5)).toBe("no_llega");
    expect(stockStatus(10, 10, "bandeja", 5)).toBe("suficiente");
  });

  it("sin inventario apuntado no avisa", () => {
    expect(stockStatus(null, 50, "kg", 5)).toBe("sin_inventario");
  });

  it("suma lo pedido de cada producto", () => {
    const lines = [
      { productId: "mandarinas", quantity: 1 },
      { productId: "mandarinas", quantity: 0.5 },
      { productId: "kakis", quantity: 2 },
      { productId: null, quantity: 3 },
      { productId: "mandarinas", quantity: 0.1 },
      { productId: "mandarinas", quantity: 0.2 },
    ];
    const totals = demandByProduct(lines);
    expect(totals.get("mandarinas")).toBe(1.8);
    expect(totals.get("kakis")).toBe(2);
    expect(totals.size).toBe(2);
  });
});
