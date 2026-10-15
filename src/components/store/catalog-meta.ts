import type { ProductCategory } from "@/lib/domain/orders";

/** Cómo se presenta cada categoría en la tienda */
export const CATEGORY_META: Record<ProductCategory, { title: string; home: string; subtitle: string; icon: string }> = {
  fruta: { title: "Fruta", home: "Fruta de temporada", subtitle: "De la frutería de turno de cada reparto", icon: "🍊" },
  verdura: { title: "Verdura", home: "Verdura y hortalizas", subtitle: "De la huerta, en la frutería de turno", icon: "🥬" },
  pescado: { title: "Pescado", home: "Pescado fresco", subtitle: "De la pescadería de turno de cada reparto", icon: "🐟" },
  carne: { title: "Carne", home: "De tus carnicerías", subtitle: "Eliges de qué carnicería es cada producto", icon: "🥩" },
};
