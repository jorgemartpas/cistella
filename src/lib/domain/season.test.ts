import { describe, expect, it } from "vitest";
import { seasonalGroups, seasonHighlight, splitBySeason } from "./season";

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

  it("deja fuera los no marcados, los retirados y las categorías sin ninguno", () => {
    const groups = seasonalGroups([
      product("Patata", "verdura", false),
      product("Mandarinas", "fruta", true, false),
      product("Boquerones", "pescado"),
    ]);
    expect(groups).toEqual([{ category: "pescado", products: [product("Boquerones", "pescado")] }]);
  });

  it("la carne también puede ser de temporada, y va la última", () => {
    const groups = seasonalGroups([product("Cordero lechal", "carne"), product("Kakis", "fruta")]);
    expect(groups.map((g) => g.category)).toEqual(["fruta", "carne"]);
  });

  it("en cada categoría, primero lo de temporada y después lo de todo el año", () => {
    const products = [
      { name: "Kakis", seasonal: true },
      { name: "Manzana", seasonal: false },
      { name: "Uva", seasonal: true },
      { name: "Plátano", seasonal: false },
    ];
    const { seasonal, yearRound } = splitBySeason(products);
    expect(seasonal.map((p) => p.name)).toEqual(["Kakis", "Uva"]);
    expect(yearRound.map((p) => p.name)).toEqual(["Manzana", "Plátano"]);
    expect(splitBySeason([{ seasonal: false }]).seasonal).toEqual([]);
  });

  it("sin productos marcados no hay grupos", () => {
    expect(seasonalGroups([product("Patata", "verdura", false)])).toEqual([]);
  });
});
