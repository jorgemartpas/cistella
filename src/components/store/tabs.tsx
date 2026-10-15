import Link from "next/link";
import { cx } from "../ui";

/** Pestañas con la raya verde debajo de la activa. */
export function Tabs({ tabs, current }: { tabs: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <nav className="-mx-4 -mt-2 mb-4 overflow-x-auto px-4 pb-4 pt-2 md:mx-0 md:overflow-visible md:px-0">
      <ul className="flex gap-2">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              scroll={false}
              aria-current={tab.key === current ? "page" : undefined}
              className={cx(
                "block whitespace-nowrap rounded-full px-5 py-2.5 text-[15px] font-bold",
                tab.key === current
                  ? "bg-primary text-primary-ink shadow-[0_10px_22px_-12px_rgb(18_132_63/0.8)]"
                  : "bg-surface text-muted shadow-sm hover:text-text",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
