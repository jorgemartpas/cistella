import { describe, expect, it } from "vitest";
import { commissionCents, formatEuros, formatQuantity, formatUnitPrice, lineTotalCents } from "./money";

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
