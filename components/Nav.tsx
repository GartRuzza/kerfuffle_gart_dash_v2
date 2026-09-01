"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top navigation between the two screens (issue #32): the player table and the
 * standalone Power Rankings board. Kept minimal — two links, the active one
 * highlighted. Client component only for the active-route highlight.
 */
const LINKS = [
  { href: "/", label: "Player Table" },
  { href: "/power-rankings", label: "Power Rankings" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center justify-center gap-1 border-b border-line bg-surface px-4 py-1.5">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
              active
                ? "bg-accent text-accent-contrast"
                : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
