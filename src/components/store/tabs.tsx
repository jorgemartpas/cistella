import Link from "next/link";
import { cx } from "../ui";

/** Pestañas con la raya verde debajo de la activa. */
export function Tabs({ tabs, current }: { tabs: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <nav className="-mx-4 mb-8 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
      <ul className="flex gap-2">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              scroll={false}
              aria-current={tab.key === current ? "page" : undefined}
              className={cx(
                "relative block whitespace-nowrap px-5 py-3.5 text-[15px] font-semibold",
                tab.key === current
                  ? "text-text after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded-t-full after:bg-primary"
                  : "text-muted hover:text-text",
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
