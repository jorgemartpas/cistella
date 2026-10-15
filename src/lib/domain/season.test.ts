import { describe, expect, it } from "vitest";
import { seasonHighlight } from "./season";

describe("productos del momento", () => {
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
