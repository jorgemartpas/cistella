import { describe, expect, it } from "vitest";
import { earningsByMonth, monthEarnings, type ShopSale } from "./earnings";

const sale = (date: string, totalCents: number, customer = "Lucía M."): ShopSale => ({
  shopOrderId: `${date}-${customer}`,
  date,
  customer,
  totalCents,
});

describe("ganancias de la tienda", () => {
  it("agrupa por mes, del más reciente al más antiguo, con ventas, comisión y ganancias", () => {
    const months = earningsByMonth(
      [sale("2026-09-08", 2000), sale("2026-10-06", 3000), sale("2026-10-13", 2050, "Pau R."), sale("2026-09-29", 1000)],
      10,
    );
    expect(months.map((m) => m.month)).toEqual(["2026-10", "2026-09"]);
    expect(months[0]).toMatchObject({ salesCents: 5050, commissionCents: 505, earningsCents: 4545 });
    expect(months[1]).toMatchObject({ salesCents: 3000, commissionCents: 300, earningsCents: 2700 });
    expect(months[0].orders.map((o) => o.date)).toEqual(["2026-10-13", "2026-10-06"]);
  });

  it("las ganancias son siempre las ventas menos la comisión (redondeada al céntimo)", () => {
    const m = monthEarnings("2026-10", [sale("2026-10-06", 1234), sale("2026-10-09", 999)], 12.5);
    expect(m.commissionCents).toBe(279);
    expect(m.earningsCents + m.commissionCents).toBe(m.salesCents);
  });

  it("un mes sin pedidos queda a cero", () => {
    expect(monthEarnings("2026-11", [], 10)).toEqual({
      month: "2026-11",
      orders: [],
      salesCents: 0,
      commissionCents: 0,
      earningsCents: 0,
    });
  });

  it("sin comisión, la tienda gana todo lo vendido", () => {
    expect(earningsByMonth([sale("2026-10-06", 4200)], 0)[0].earningsCents).toBe(4200);
  });
});
