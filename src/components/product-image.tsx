import type { ProductCategory } from "@/lib/domain/orders";
import { cx } from "./ui";

const ICONS: Record<ProductCategory, string> = { fruta: "🍊", verdura: "🥬", pescado: "🐟", carne: "🥩" };
const BACKGROUNDS: Record<ProductCategory, string> = {
  fruta: "bg-accent-soft",
  verdura: "bg-primary-soft",
  pescado: "bg-info-soft",
  carne: "bg-danger-soft",
};

/** Foto del producto o, si no tiene, un icono de su categoría. */
export function ProductImage({
  product,
  className = "size-16",
}: {
  product: { name: string; image_url: string | null; category: ProductCategory };
  className?: string;
}) {
  if (product.image_url) {
    return (
      // Fotos pequeñas servidas desde Supabase Storage; no hace falta optimizarlas con next/image
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.image_url}
        alt=""
        loading="lazy"
        className={cx("shrink-0 rounded-lg object-cover bg-surface-2", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cx("flex shrink-0 items-center justify-center rounded-lg text-3xl", BACKGROUNDS[product.category], className)}
    >
      {ICONS[product.category]}
    </div>
  );
}
