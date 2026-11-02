"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UploadIcon } from "./icons";

/** A header link, underlined when it's the page being shown. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`relative flex h-9 items-center rounded-full px-3 text-[14px] font-medium transition hover:text-ink ${
        current ? "text-ink after:absolute after:inset-x-3 after:-bottom-[14px] after:h-0.5 after:rounded-full after:bg-accent" : "text-ink-2"
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * "Upload data" for administrators: a labelled pill from tablet width up, the
 * icon alone on a phone, so it's always one tap away.
 */
export function UploadLink() {
  const current = usePathname().startsWith("/upload");
  return (
    <Link
      href="/upload"
      aria-current={current ? "page" : undefined}
      title="Upload data"
      className={`ml-1 flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold transition sm:px-3.5 ${
        current ? "bg-accent text-accent-ink" : "text-accent-text ring-1 ring-accent/40 hover:bg-accent-soft"
      }`}
    >
      <UploadIcon size={16} />
      <span className="sr-only sm:not-sr-only">Upload data</span>
    </Link>
  );
}
