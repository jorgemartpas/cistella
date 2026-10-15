import type { ProductCategory } from "./orders";

export type SeasonHighlight = {
  title: string;
  text: string;
  emojis: string[];
  category: ProductCategory;
  /** Degradado de fondo del destacado */
  colors: [string, string];
};

const AUTUMN: SeasonHighlight = {
  title: "Llegan los kakis de la Ribera",
  text: "Y las primeras mandarinas clemenules, recién cogidas.",
  emojis: ["🍊", "🍂", "🍐"],
  category: "fruta",
  colors: ["#5a2a0c", "#c25a12"],
};
const WINTER: SeasonHighlight = {
  title: "Naranjas y mandarinas de aquí",
  text: "Cítricos de la Ribera en su mejor momento.",
  emojis: ["🍊", "🍋", "🍊"],
  category: "fruta",
  colors: ["#6a3a05", "#e08a12"],
};
const SPRING: SeasonHighlight = {
  title: "Alcachofas, habas y fresas",
  text: "La huerta valenciana en primavera.",
  emojis: ["🥬", "🍓", "🫛"],
  category: "verdura",
  colors: ["#1f4a22", "#4c8a2e"],
};
const SUMMER: SeasonHighlight = {
  title: "Tomate valenciano, melón y sandía",
  text: "Lo más fresco para el verano.",
  emojis: ["🍅", "🍉", "🍈"],
  category: "verdura",
  colors: ["#6b1414", "#d0402a"],
};
const SEPTEMBER: SeasonHighlight = {
  title: "Uva y granadas recién llegadas",
  text: "La fruta del final del verano.",
  emojis: ["🍇", "🍎", "🍐"],
  category: "fruta",
  colors: ["#3a1450", "#7c3a8f"],
};

/** Destacado de «Productos del momento» según el mes (1 = enero … 12 = diciembre). */
export function seasonHighlight(month: number): SeasonHighlight {
  if (month === 9) return SEPTEMBER;
  if (month === 10 || month === 11) return AUTUMN;
  if (month === 12 || month <= 2) return WINTER;
  if (month <= 5) return SPRING;
  return SUMMER;
}
