import { describe, expect, it } from "vitest";
import { assignRotation, nextInRotation, rotationQueue, type RotationShop } from "./rotation";

const fruteriaA: RotationShop = { id: "fru-a", name: "Frutería A", active: true, rotationOrder: 1 };
const fruteriaB: RotationShop = { id: "fru-b", name: "Frutería B", active: true, rotationOrder: 2 };

describe("rotación de tiendas", () => {
  it("ordena la cola por el orden que fija el admin y deja fuera las inactivas", () => {
    const fruteriaC = { id: "fru-c", name: "Frutería C", active: false, rotationOrder: 0 };
    expect(rotationQueue([fruteriaB, fruteriaC, fruteriaA])).toEqual(["fru-a", "fru-b"]);
    expect(rotationQueue([{ ...fruteriaB, rotationOrder: 0 }, fruteriaA])).toEqual(["fru-b", "fru-a"]);
  });

  it("alterna entre las tiendas de la cola", () => {
    const queue = ["fru-a", "fru-b"];
    expect(nextInRotation(queue, null)).toBe("fru-a");
    expect(nextInRotation(queue, "fru-a")).toBe("fru-b");
    expect(nextInRotation(queue, "fru-b")).toBe("fru-a");
  });

  it("vuelve al principio si la anterior ya no está en la cola", () => {
    expect(nextInRotation(["fru-a", "fru-b"], "fru-baja")).toBe("fru-a");
  });

  it("no asigna tienda si no hay ninguna activa", () => {
    expect(nextInRotation([], "fru-a")).toBeNull();
    const result = assignRotation(["2026-10-20"], [{ ...fruteriaA, active: false }], null);
    expect(result.get("2026-10-20")).toBeNull();
  });

  it("continúa la alternancia desde el último día asignado", () => {
    const dates = ["2026-10-20", "2026-10-23", "2026-10-27", "2026-10-30"];
    const result = assignRotation(dates, [fruteriaA, fruteriaB], "fru-a");
    expect([...result.values()]).toEqual(["fru-b", "fru-a", "fru-b", "fru-a"]);
  });

  it("asigna en orden de fecha aunque lleguen desordenadas", () => {
    const result = assignRotation(["2026-10-23", "2026-10-20"], [fruteriaA, fruteriaB], null);
    expect(result.get("2026-10-20")).toBe("fru-a");
    expect(result.get("2026-10-23")).toBe("fru-b");
  });

  it("reparte los días por igual entre las tiendas", () => {
    const dates = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
    const result = [...assignRotation(dates, [fruteriaA, fruteriaB], null).values()];
    expect(result.filter((id) => id === "fru-a")).toHaveLength(5);
    expect(result.filter((id) => id === "fru-b")).toHaveLength(5);
  });

  it("con una sola tienda activa, le toca siempre a ella", () => {
    const result = assignRotation(["2026-10-20", "2026-10-23"], [fruteriaA, { ...fruteriaB, active: false }], "fru-b");
    expect([...result.values()]).toEqual(["fru-a", "fru-a"]);
  });
});
