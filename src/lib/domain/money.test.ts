import { describe, expect, it } from "vitest";
import {
  commissionCents,
  formatEuros,
  formatQuantity,
  formatUnitPrice,
  lineTotalCents,
  normalizeQuantity,
  parseEurosToCents,
  parseQuantity,
} from "./money";

describe("importes", () => {
  it("multiplica cantidad por precio sin errores de coma flotante", () => {
    expect(lineTotalCents(0.3, 1000)).toBe(300);
    expect(lineTotalCents(1.235, 1299)).toBe(1604);
    expect(lineTotalCents(0.25, 1850)).toBe(463); // 462,5 → 463
  });

  it("calcula la comisión de la tienda", () => {
    expect(commissionCents(12345, 10)).toBe(1235);
    expect(commissionCents(0, 10)).toBe(0);
    expect(commissionCents(10000, 12.5)).toBe(1250);
  });

  it("formatea en euros y con unidades en castellano", () => {
    expect(formatEuros(1250).replace(/\s/g, " ")).toBe("12,50 €");
    expect(formatUnitPrice(160, "kg").replace(/\s/g, " ")).toBe("1,60 €/kg");
    expect(formatQuantity(1.5, "kg")).toBe("1,5 kg");
    expect(formatQuantity(1, "bandeja")).toBe("1 bandeja");
    expect(formatQuantity(3, "unidad")).toBe("3 unidades");
  });
});

describe("importes escritos a mano", () => {
  it("acepta coma o punto, espacios y el símbolo del euro", () => {
    expect(parseEurosToCents("30,00")).toBe(3000);
    expect(parseEurosToCents("30")).toBe(3000);
    expect(parseEurosToCents(" 25,5 € ")).toBe(2550);
    expect(parseEurosToCents("6.00")).toBe(600);
  });

  it("rechaza lo que no es un importe", () => {
    expect(parseEurosToCents("")).toBeNull();
    expect(parseEurosToCents("15,999")).toBeNull();
    expect(parseEurosToCents("1.000,00")).toBeNull();
    expect(parseEurosToCents("abc")).toBeNull();
  });

  it("el cero solo vale cuando se permite (pedido mínimo, envío gratis)", () => {
    expect(parseEurosToCents("0,00")).toBeNull();
    expect(parseEurosToCents("0,00", { allowZero: true })).toBe(0);
    expect(parseEurosToCents("0", { allowZero: true })).toBe(0);
  });
});

describe("cantidades escritas a mano", () => {
  it("lo que va al kilo se puede pedir al gramo", () => {
    expect(parseQuantity("0,3")).toBe(0.3);
    expect(parseQuantity("1.35 kg")).toBe(1.35);
    expect(parseQuantity(",5")).toBe(0.5);
    expect(parseQuantity("medio")).toBeNull();
    expect(normalizeQuantity(0.3 + 0.25, "kg")).toBe(0.55);
    expect(normalizeQuantity(0.1234, "kg")).toBe(0.123);
  });

  it("unidades y bandejas, enteras", () => {
    expect(normalizeQuantity(2.4, "unidad")).toBe(2);
    expect(normalizeQuantity(2.6, "bandeja")).toBe(3);
  });
});
