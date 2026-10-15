import type { ProductCategory } from "@/lib/domain/orders";

/** Cómo se presenta cada categoría en la tienda */
export const CATEGORY_META: Record<ProductCategory, { title: string; subtitle: string; icon: string }> = {
  fruta: { title: "Fruta", subtitle: "De la frutería de turno de cada reparto", icon: "🍊" },
  verdura: { title: "Verdura", subtitle: "De la huerta, en la frutería de turno", icon: "🥬" },
  pescado: { title: "Pescado", subtitle: "De la pescadería de turno de cada reparto", icon: "🐟" },
  carne: { title: "Carne", subtitle: "Eliges de qué carnicería es cada producto", icon: "🥩" },
};
