"use client";

import { saveProduct } from "@/lib/actions/products";
import type { ProductCategory } from "@/lib/domain/orders";
import type { Product } from "@/lib/types";
import { ActionForm, SubmitButton } from "./forms";
import { ImageInput } from "./image-input";
import { Field, Input, Select } from "./ui";

const CATEGORY_NAMES: Record<ProductCategory, string> = {
  fruta: "Fruta",
  verdura: "Verdura",
  pescado: "Pescado",
  carne: "Carne",
};

export function ProductForm({
  product,
  categories,
  defaultCategory,
  priceInput,
}: {
  product?: Product;
  categories: ProductCategory[];
  defaultCategory: ProductCategory;
  /** Precio ya formateado para el campo ("3,50") */
  priceInput?: string;
}) {
  return (
    <ActionForm action={saveProduct}>
      {product && <input type="hidden" name="id" value={product.id} />}
      <Field label="Foto">
        <ImageInput name="photo" currentUrl={product?.image_url ?? null} />
      </Field>
      <Field label="Nombre">
        <Input name="name" defaultValue={product?.name} required maxLength={80} placeholder="Ej.: Naranjas de zumo" />
      </Field>
      <Field label="Descripción (opcional)" hint="Origen, formato, cuántas piezas trae…">
        <Input name="description" defaultValue={product?.description ?? ""} maxLength={200} />
      </Field>
      {categories.length > 1 ? (
        <Field label="Categoría">
          <Select name="category" defaultValue={product?.category ?? defaultCategory}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_NAMES[c]}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="category" value={product?.category ?? defaultCategory} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio (IVA incl.)" hint="En euros, p. ej. 3,50">
          <Input name="price" inputMode="decimal" defaultValue={priceInput} required placeholder="0,00" />
        </Field>
        <Field label="Se vende por">
          <Select name="unit" defaultValue={product?.unit ?? "kg"}>
            <option value="kg">kg</option>
            <option value="unidad">unidad</option>
            <option value="bandeja">bandeja</option>
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <input
          type="checkbox"
          name="active"
          defaultChecked={product?.active ?? true}
          className="size-5 accent-[var(--primary)]"
        />
        <span>
          <span className="block font-medium">Disponible</span>
          <span className="block text-sm text-muted">Si lo desmarcas, no aparece en el catálogo ni entra en pedidos.</span>
        </span>
      </label>
      {!categories.includes("carne") && (
        <label className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <input
            type="checkbox"
            name="seasonal"
            defaultChecked={product?.seasonal ?? false}
            className="size-5 accent-[var(--primary)]"
          />
          <span>
            <span className="block font-medium">De temporada</span>
            <span className="block text-sm text-muted">Sale en la portada, en «Productos de temporada».</span>
          </span>
        </label>
      )}
      <SubmitButton className="w-full">{product ? "Guardar cambios" : "Crear producto"}</SubmitButton>
    </ActionForm>
  );
}
