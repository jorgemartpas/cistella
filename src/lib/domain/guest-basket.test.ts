import { describe, expect, it } from "vitest";
import { GUEST_BASKET_MAX_ITEMS, parseGuestBasket, updateGuestBasket } from "./guest-basket";

const A = "11111111-1111-4111-8111-000000000001";
const B = "11111111-1111-4111-8111-000000000002";

describe("cesta del visitante", () => {
  it("lee la cookie e ignora lo que no es válido", () => {
    expect(parseGuestBasket(undefined).size).toBe(0);
    expect(parseGuestBasket("no es json").size).toBe(0);
    expect(parseGuestBasket("[1,2]").size).toBe(0);
    const basket = parseGuestBasket(JSON.stringify({ [A]: 0.5, [B]: -1, "no-uuid": 2, x: "3" }));
    expect([...basket]).toEqual([[A, 0.5]]);
  });

  it("añade, cambia y quita productos", () => {
    let raw = updateGuestBasket(new Map(), A, 1);
    raw = updateGuestBasket(parseGuestBasket(raw), B, 0.75);
    raw = updateGuestBasket(parseGuestBasket(raw), A, 2);
    expect(Object.fromEntries(parseGuestBasket(raw))).toEqual({ [A]: 2, [B]: 0.75 });
    raw = updateGuestBasket(parseGuestBasket(raw), A, 0);
    expect(Object.fromEntries(parseGuestBasket(raw))).toEqual({ [B]: 0.75 });
  });

  it("no pasa del máximo de productos", () => {
    const full = new Map(
      Array.from({ length: GUEST_BASKET_MAX_ITEMS }, (_, i) => [`11111111-1111-4111-8111-${String(i).padStart(12, "0")}`, 1]),
    );
    expect(parseGuestBasket(updateGuestBasket(full, "22222222-2222-4222-8222-000000000000", 1)).size).toBe(
      GUEST_BASKET_MAX_ITEMS,
    );
  });
});
