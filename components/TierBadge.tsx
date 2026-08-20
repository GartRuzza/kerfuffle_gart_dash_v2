// Distinct color per tier so a close call *looks* close (vision principle 4:
// tiers over false precision). Colors come from the `tier-*` design tokens
// (tailwind.config.ts); classes are written out in full so Tailwind's content
// scanner keeps them.
const TIER_STYLES: Record<number, string> = {
  1: "bg-tier-1",
  2: "bg-tier-2",
  3: "bg-tier-3",
  4: "bg-tier-4",
  5: "bg-tier-5",
  6: "bg-tier-6",
};

export default function TierBadge({ tier }: { tier: number }) {
  const cls = TIER_STYLES[tier] ?? "bg-ink-faint";
  return (
    <span
      className={`inline-flex h-6 min-w-[2rem] items-center justify-center rounded-full px-2 text-xs font-bold text-white ring-1 ring-inset ring-black/10 ${cls}`}
      title={`Tier ${tier}`}
    >
      T{tier}
    </span>
  );
}
