import Link from "next/link";
import { CATEGORY_LABELS, type ProductCategory } from "@/lib/domain/orders";
import { cx } from "./ui";

const ICONS: Record<ProductCategory, string> = { fruta: "🍊", verdura: "🥬", pescado: "🐟", carne: "🥩" };

export function CategoryTabs({
  categories,
  current,
  hrefFor,
}: {
  categories: ProductCategory[];
  current: ProductCategory;
  hrefFor: (c: ProductCategory) => string;
}) {
  return (
    <nav aria-label="Categorías" className="-mx-4 mb-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {categories.map((c) => (
          <li key={c}>
            <Link
              href={hrefFor(c)}
              scroll={false}
              aria-current={c === current ? "page" : undefined}
              className={cx(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold",
                c === current ? "bg-text text-bg" : "bg-surface border border-border text-text",
              )}
            >
              <span aria-hidden>{ICONS[c]}</span>
              {CATEGORY_LABELS[c]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
