// Distinct color per tier so a close call *looks* close (vision principle 4:
// tiers over false precision). Classes are written out in full so Tailwind's
// content scanner keeps them.
const TIER_STYLES: Record<number, string> = {
  1: "bg-violet-600 text-white ring-violet-700",
  2: "bg-blue-600 text-white ring-blue-700",
  3: "bg-emerald-600 text-white ring-emerald-700",
  4: "bg-amber-500 text-white ring-amber-600",
  5: "bg-orange-500 text-white ring-orange-600",
  6: "bg-rose-500 text-white ring-rose-600",
};

export default function TierBadge({ tier }: { tier: number }) {
  const cls = TIER_STYLES[tier] ?? "bg-slate-500 text-white ring-slate-600";
  return (
    <span
      className={`inline-flex h-6 min-w-[2rem] items-center justify-center rounded-full px-2 text-xs font-bold ring-1 ${cls}`}
      title={`Tier ${tier}`}
    >
      T{tier}
    </span>
  );
}
