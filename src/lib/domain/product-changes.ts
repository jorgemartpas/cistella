import { formatUnitPrice, UNIT_LABELS, type ProductUnit } from "./money";

/** Cambios que una tienda propone y el admin revisa */
export type ChangeKind = "crear" | "editar" | "eliminar";

/** Datos de un producto que se pueden cambiar con revisión */
export type ReviewedFields = {
  name: string;
  description: string | null;
  unit: ProductUnit;
  price_cents: number;
  image_url: string | null;
};

export type FieldDiff = {
  field: keyof ReviewedFields;
  label: string;
  from: string | null;
  to: string | null;
};

const LABELS: Record<keyof ReviewedFields, string> = {
  name: "Nombre",
  description: "Descripción",
  unit: "Se vende por",
  price_cents: "Precio",
  image_url: "Foto",
};
/** Cómo se nombra cada cambio en el aviso: «cambiar el precio y la foto» */
const SPOKEN: Record<keyof ReviewedFields, string> = {
  name: "el nombre",
  description: "la descripción",
  unit: "la unidad",
  price_cents: "el precio",
  image_url: "la foto",
};

/**
 * Qué cambia entre el producto y la propuesta. `proposed.image_url` null = sin foto nueva.
 * El precio se compara con su unidad (3,50 €/kg → 3,80 €/kg).
 */
export function diffProduct(current: ReviewedFields, proposed: ReviewedFields): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const text = (value: string | null) => (value?.trim() ? value.trim() : null);
  if (text(current.name) !== text(proposed.name)) {
    diffs.push({ field: "name", label: LABELS.name, from: current.name, to: proposed.name });
  }
  if (text(current.description) !== text(proposed.description)) {
    diffs.push({ field: "description", label: LABELS.description, from: text(current.description), to: text(proposed.description) });
  }
  if (current.unit !== proposed.unit) {
    diffs.push({ field: "unit", label: LABELS.unit, from: UNIT_LABELS[current.unit].singular, to: UNIT_LABELS[proposed.unit].singular });
  }
  if (current.price_cents !== proposed.price_cents || current.unit !== proposed.unit) {
    diffs.push({
      field: "price_cents",
      label: LABELS.price_cents,
      from: formatUnitPrice(current.price_cents, current.unit),
      to: formatUnitPrice(proposed.price_cents, proposed.unit),
    });
  }
  if (proposed.image_url && proposed.image_url !== current.image_url) {
    diffs.push({ field: "image_url", label: LABELS.image_url, from: current.image_url, to: proposed.image_url });
  }
  return diffs;
}

/** «Óscar (Oskiñez)», o solo la tienda si la cuenta no tiene un nombre de persona distinto. */
export function requesterName(fullName: string | null | undefined, shopName: string): string {
  const first = fullName?.trim().split(/\s+/)[0];
  if (!first || shopName.toLocaleLowerCase("es").includes(first.toLocaleLowerCase("es"))) return shopName;
  return `${first} (${shopName})`;
}

function joinSpanish(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items.at(-1)}` : (items[0] ?? "");
}

/** Qué pide, sin quién: «cambiar el precio de «Chorizo» (14,90 €/kg → 15,50 €/kg)», «añadir «Morcilla»»… */
export function changeSummary(kind: ChangeKind, productName: string, diffs: FieldDiff[] = []): string {
  if (kind === "crear") return `añadir «${productName}»`;
  if (kind === "eliminar") return `eliminar «${productName}»`;
  if (diffs.length === 1 && diffs[0].field === "price_cents") {
    return `cambiar el precio de «${productName}» (${diffs[0].from} → ${diffs[0].to})`;
  }
  return `cambiar ${joinSpanish(diffs.map((d) => SPOKEN[d.field]))} de «${productName}»`;
}

/** El aviso para el admin: «Óscar (Oskiñez) quiere cambiar el precio de «Chorizo» (14,90 €/kg → 15,50 €/kg)». */
export function describeChange(who: string, kind: ChangeKind, productName: string, diffs: FieldDiff[] = []): string {
  return `${who} quiere ${changeSummary(kind, productName, diffs)}`;
}
