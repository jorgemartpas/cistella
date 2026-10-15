import { Field, Input, Select } from "@/components/ui";
import type { Shop } from "@/lib/types";

/** Campos comunes del formulario de alta y edición de tienda. */
export function ShopFields({ shop, defaultCommission }: { shop?: Shop; defaultCommission: number }) {
  return (
    <>
      {shop && <input type="hidden" name="id" value={shop.id} />}
      <Field label="Nombre">
        <Input name="name" defaultValue={shop?.name} required maxLength={80} />
      </Field>
      {!shop && (
        <Field label="Tipo" hint="No se puede cambiar después.">
          <Select name="type" required defaultValue="">
            <option value="" disabled>
              Elige…
            </option>
            <option value="carniceria">Carnicería</option>
            <option value="pescaderia">Pescadería</option>
            <option value="fruteria">Frutería (fruta y verdura)</option>
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Comisión (%)" hint="Sobre lo vendido">
          <Input
            name="commission_pct"
            inputMode="decimal"
            defaultValue={String(shop?.commission_pct ?? defaultCommission).replace(".", ",")}
            required
          />
        </Field>
        <Field label="Orden de rotación" hint="Menor = antes">
          <Input name="rotation_order" type="number" min={0} max={99} defaultValue={shop?.rotation_order ?? 1} required />
        </Field>
      </div>
      <Field label="Teléfono (opcional)">
        <Input name="phone" type="tel" defaultValue={shop?.phone ?? ""} />
      </Field>
      <Field label="Dirección (opcional)" hint="Para la ruta de recogidas">
        <Input name="address" defaultValue={shop?.address ?? ""} />
      </Field>
      <label className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <input type="checkbox" name="active" defaultChecked={shop?.active ?? true} className="size-5 accent-[var(--primary)]" />
        <span>
          <span className="block font-medium">Activa</span>
          <span className="block text-sm text-muted">Las tiendas inactivas no reciben pedidos ni entran en la rotación.</span>
        </span>
      </label>
    </>
  );
}
