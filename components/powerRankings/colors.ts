import { rankBand } from "@/lib/powerRankings";

/** Bar fill class for a rank within an N-team league (top green, mid blue, low red). */
export function bandBg(rank: number, total: number): string {
  return { strong: "bg-rank-strong", middle: "bg-rank-middle", weak: "bg-rank-weak" }[
    rankBand(rank, total)
  ];
}

/** Text color matching the band (for the rank ordinal + badge). */
export function bandText(rank: number, total: number): string {
  return { strong: "text-rank-strong", middle: "text-rank-middle", weak: "text-rank-weak" }[
    rankBand(rank, total)
  ];
}
