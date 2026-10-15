"use client";

import { proposeProductChange } from "@/lib/actions/product-changes";
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
  canMarkSeasonal = false,
  forShop = false,
}: {
  product?: Product;
  categories: ProductCategory[];
  defaultCategory: ProductCategory;
  /** Precio ya formateado para el campo ("3,50") */
  priceInput?: string;
  /** Solo el admin marca qué es de temporada (sale en la portada) */
  canMarkSeasonal?: boolean;
  /** Tienda: no guarda, propone el cambio y queda pendiente de revisión del admin */
  forShop?: boolean;
}) {
  return (
    <ActionForm action={forShop ? proposeProductChange : saveProduct}>
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
{!forShop && (
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
      )}
      {canMarkSeasonal && (
        <label className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <input
            type="checkbox"
            name="seasonal"
            defaultChecked={product?.seasonal ?? false}
            className="size-5 accent-[var(--primary)]"
          />
          <span>
            <span className="block font-medium">De temporada</span>
            <span className="block text-sm text-muted">
              Sale en la portada, en «Productos de temporada», y el primero de su categoría.
            </span>
          </span>
        </label>
      )}
      {forShop ? (
        <>
          <p className="text-sm text-muted">
            El equipo de LaCistella revisa los cambios antes de que salgan en la tienda. Mientras, se sigue viendo como
            ahora.
          </p>
          <SubmitButton className="w-full" pendingText="Enviando…">
            Enviar a revisión
          </SubmitButton>
        </>
      ) : (
        <SubmitButton className="w-full">{product ? "Guardar cambios" : "Crear producto"}</SubmitButton>
      )}
    </ActionForm>
  );
}
