// Filled, color-coded position badge — QB green, RB red, WR blue, TE tan, DST
// purple. Colors come from the `pos-*` design tokens. Classes are written in
// full so Tailwind's content scanner keeps them.
const POS_BG: Record<string, string> = {
  QB: "bg-pos-qb",
  RB: "bg-pos-rb",
  WR: "bg-pos-wr",
  TE: "bg-pos-te",
  DST: "bg-pos-dst",
};

export default function PositionBadge({ pos }: { pos: string }) {
  const bg = POS_BG[pos] ?? "bg-ink-faint";
  return (
    <span
      className={`inline-flex min-w-[2.1rem] items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold tracking-wide text-white ${bg}`}
    >
      {pos}
    </span>
  );
}
