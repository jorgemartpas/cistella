import { describe, expect, it } from "vitest";
import { describeChange, diffProduct, requesterName, type ReviewedFields } from "./product-changes";

// Los importes llevan un espacio sin salto antes del €
const plain = (text: string | null) => text?.replace(/\u00a0/g, " ") ?? null;

const chorizo: ReviewedFields = {
  name: "Chorizo casero",
  description: "Embutido de la casa",
  unit: "kg",
  price_cents: 1490,
  image_url: "https://fotos/chorizo.jpg",
};

describe("cambios propuestos por las tiendas", () => {
  it("detecta solo lo que cambia", () => {
    expect(diffProduct(chorizo, { ...chorizo })).toEqual([]);
    expect(diffProduct(chorizo, { ...chorizo, image_url: null })).toEqual([]); // sin foto nueva
    expect(diffProduct(chorizo, { ...chorizo, description: "  Embutido de la casa " })).toEqual([]);
    const diffs = diffProduct(chorizo, { ...chorizo, price_cents: 1550, image_url: "https://fotos/nueva.jpg" });
    expect(diffs.map((d) => d.field)).toEqual(["price_cents", "image_url"]);
    expect([plain(diffs[0].from), plain(diffs[0].to)]).toEqual(["14,90 €/kg", "15,50 €/kg"]);
  });

  it("al cambiar la unidad enseña también el precio con la unidad nueva", () => {
    const diffs = diffProduct(chorizo, { ...chorizo, unit: "bandeja", price_cents: 600 });
    expect(diffs.map((d) => d.field)).toEqual(["unit", "price_cents"]);
    expect(plain(diffs[1].to)).toBe("6,00 €/bandeja");
  });

  it("escribe el aviso para el admin", () => {
    const who = requesterName("Óscar Martínez", "Oskiñez");
    expect(who).toBe("Óscar (Oskiñez)");
    expect(requesterName(null, "Oskiñez")).toBe("Oskiñez");
    expect(requesterName("Oskiñez", "Oskiñez")).toBe("Oskiñez");
    // La cuenta de la tienda con el nombre de la tienda: solo la tienda
    expect(requesterName("Frutería A", "Frutería A (por concretar)")).toBe("Frutería A (por concretar)");

    const price = diffProduct(chorizo, { ...chorizo, price_cents: 1550 });
    expect(plain(describeChange(who, "editar", "Chorizo casero", price))).toBe(
      "Óscar (Oskiñez) quiere cambiar el precio de «Chorizo casero» (14,90 €/kg → 15,50 €/kg)",
    );
    const several = diffProduct(chorizo, { ...chorizo, name: "Chorizo de la casa", price_cents: 1550, image_url: "x" });
    expect(describeChange(who, "editar", "Chorizo casero", several)).toBe(
      "Óscar (Oskiñez) quiere cambiar el nombre, el precio y la foto de «Chorizo casero»",
    );
    expect(describeChange("Oskiñez", "crear", "Morcilla")).toBe("Oskiñez quiere añadir «Morcilla»");
    expect(describeChange("Oskiñez", "eliminar", "Morcilla")).toBe("Oskiñez quiere eliminar «Morcilla»");
  });
});
