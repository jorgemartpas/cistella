import Link from "next/link";

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--primary)" />
      <circle cx="40" cy="20" r="8" fill="var(--accent)" />
      <path d="M38 13c2-3 5-4 8-3" stroke="var(--primary-ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path
        d="M12 28h40l-4.5 22a4 4 0 0 1-3.9 3.2H20.4a4 4 0 0 1-3.9-3.2z"
        fill="var(--primary-ink)"
      />
      <path d="M22 34v13M32 34v13M42 34v13" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-bold text-lg tracking-tight">
      <LogoMark className="size-8" />
      LaCistella
    </Link>
  );
}
