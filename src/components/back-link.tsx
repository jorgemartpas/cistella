import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-ml-1 mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-text">
      <Icon name="back" className="size-4" />
      {children}
    </Link>
  );
}
