import { describe, expect, it } from "vitest";
import { seasonalGroups, seasonHighlight } from "./season";

describe("destacado de temporada", () => {
  it("cambia con la temporada", () => {
    expect(seasonHighlight(10).title).toMatch(/kakis/);
    expect(seasonHighlight(1).title).toMatch(/Naranjas/);
    expect(seasonHighlight(4).category).toBe("verdura");
    expect(seasonHighlight(7).title).toMatch(/Tomate/);
    expect(seasonHighlight(9).title).toMatch(/Uva/);
  });

  it("tiene destacado para todos los meses", () => {
    for (let month = 1; month <= 12; month++) expect(seasonHighlight(month).emojis.length).toBeGreaterThan(0);
  });
});

describe("productos de temporada", () => {
  const product = (name: string, category: "fruta" | "verdura" | "pescado" | "carne", seasonal = true, active = true) => ({
    name,
    category,
    seasonal,
    active,
  });

  it("separa los marcados en fruta, verdura y pescado, en ese orden y por nombre", () => {
    const groups = seasonalGroups([
      product("Sepia", "pescado"),
      product("Uva moscatel", "fruta"),
      product("Alcachofas", "verdura"),
      product("Kakis de la Ribera", "fruta"),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["fruta", "verdura", "pescado"]);
    expect(groups[0].products.map((p) => p.name)).toEqual(["Kakis de la Ribera", "Uva moscatel"]);
  });

  it("deja fuera los no marcados, los retirados, la carne y las categorías sin ninguno", () => {
    const groups = seasonalGroups([
      product("Patata", "verdura", false),
      product("Mandarinas", "fruta", true, false),
      product("Butifarra", "carne"),
      product("Boquerones", "pescado"),
    ]);
    expect(groups).toEqual([{ category: "pescado", products: [product("Boquerones", "pescado")] }]);
  });

  it("sin productos marcados no hay grupos", () => {
    expect(seasonalGroups([product("Patata", "verdura", false)])).toEqual([]);
  });
});
