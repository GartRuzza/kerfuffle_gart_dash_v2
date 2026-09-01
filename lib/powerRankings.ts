import { FREE_AGENT, type Player, type Position } from "./types";

/**
 * League Power Rankings — the PURE aggregation core (issue #32, decision D-20).
 *
 * "Team strength" is NOT a new model. It is each team's players' existing Kerf
 * projected points (the engine's per-player number, `Player.projPts`), added up
 * the superflex-correct way. This module is the glass-box that does the adding:
 * no database, no React, no filesystem — deterministic transforms over the
 * `Player[]` the data layer already produces, so every number is unit-testable
 * and reproducible.
 *
 * OFFENSE ONLY (D-20): the projection engine can't score defenses, so DST is
 * excluded from the lineup, the totals, the positional groups, and the radar.
 *
 * The pipeline:
 *   buildLineup     — a team's optimal superflex starting lineup (mirrors the
 *                     valuation engine's lineup order: dedicated slots, then FLEX,
 *                     then SFLEX, greedy by points).
 *   teamStrength    — Starter Strength (lineup sum), Total Roster (everyone),
 *                     bench, per-group starter strength, bench-by-position.
 *   computeLeague   — ranks the 12 teams (overall + per group + per slot),
 *                     normalizes to a 0–100 score, and tiers them (Jenks, k=3).
 */

// The KERFUFFLE offensive starting lineup, as ordered fill slots. DST is omitted
// (offense-only, D-20). Two FLEX + one SFLEX after the dedicated slots — the same
// LINEUP the valuation engine uses ({QB:1, RB:2, WR:2, TE:1, FLEX:2, SFLEX:1}).
export const STARTER_SLOTS = [
  "QB",
  "RB1",
  "RB2",
  "WR1",
  "WR2",
  "TE",
  "FLX1",
  "FLX2",
  "SFLX",
] as const;
export type StarterSlot = (typeof STARTER_SLOTS)[number];

/** Which real positions each slot may hold. */
const SLOT_ELIGIBILITY: Record<StarterSlot, Position[]> = {
  QB: ["QB"],
  RB1: ["RB"],
  RB2: ["RB"],
  WR1: ["WR"],
  WR2: ["WR"],
  TE: ["TE"],
  FLX1: ["RB", "WR", "TE"],
  FLX2: ["RB", "WR", "TE"],
  SFLX: ["QB", "RB", "WR", "TE"],
};

/** Display label for a slot (the two flex slots both read "FLX", per the image). */
export const SLOT_LABEL: Record<StarterSlot, string> = {
  QB: "QB",
  RB1: "RB1",
  RB2: "RB2",
  WR1: "WR1",
  WR2: "WR2",
  TE: "TE",
  FLX1: "FLX",
  FLX2: "FLX",
  SFLX: "SFLX",
};

/** The positional groups shown on the Positional Rankings + radar (offense only). */
export const POS_GROUPS = ["QB", "RB", "WR", "TE", "FLEX", "SFLX"] as const;
export type PosGroup = (typeof POS_GROUPS)[number];

/** Which starter slots feed each positional group's starter strength. */
const GROUP_SLOTS: Record<PosGroup, StarterSlot[]> = {
  QB: ["QB"],
  RB: ["RB1", "RB2"],
  WR: ["WR1", "WR2"],
  TE: ["TE"],
  FLEX: ["FLX1", "FLX2"],
  SFLX: ["SFLX"],
};

/** The offensive positions the rankings count (DST excluded). */
export const OFFENSE_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];

/** One filled (or empty) lineup slot. */
export interface LineupSlot {
  slot: StarterSlot;
  label: string;
  player: Player | null;
  points: number; // the player's Kerf points, or 0 when the slot is unfilled
}

/** One team's aggregated strength — the raw numbers before league-wide ranking. */
export interface TeamStrength {
  team: string;
  /** Sum of the optimal starting lineup's Kerf points. */
  starterStrength: number;
  /** Sum of every rostered offensive player's Kerf points (depth counts). */
  totalRoster: number;
  /** Total Roster − Starter Strength: the bench's contribution. */
  benchStrength: number;
  lineup: LineupSlot[];
  /** Starter-slot Kerf points per positional group (QB/RB/WR/TE/FLEX/SFLX). */
  groupStarters: Record<PosGroup, number>;
  /** Bench (non-starter) Kerf points, summed per real offensive position. */
  benchByPos: Record<Position, number>;
  /** Count of projected bench players per real offensive position (for averages). */
  benchCountByPos: Record<Position, number>;
}

/** Min / median / max of a metric across the league — drives bar+radar scaling. */
export interface Stats {
  min: number;
  median: number;
  max: number;
}

/** A team after league-wide ranking, scoring and tiering. */
export interface RankedTeam extends TeamStrength {
  /** 1 = strongest starters. Distinct 1..N (ties broken by team name). */
  rank: number;
  /** 0–100, Starter Strength normalized to the top team. */
  score: number;
  /** 1 = contenders, 2 = middle, 3 = rebuilders (Jenks on Starter Strength). */
  tier: number;
  totalRosterRank: number;
  /** Rank among teams per group ("QB".."SFLX" + "STARTERS" + "BENCH"). */
  groupRank: Record<string, number>;
  /** Rank among teams per starter slot (for Starter Rankings + lineup badges). */
  slotRank: Record<StarterSlot, number>;
  /**
   * AVERAGE bench Kerf points per radar axis (owner's spec): QB/RB/WR/TE = the mean
   * of that team's bench players at the position; FLEX = mean over bench RB/WR/TE;
   * SFLX = mean over all bench offensive players. 0 when the team benches none there.
   */
  benchAvgByGroup: Record<PosGroup, number>;
  /** Rank among teams of that average-bench value per axis (radar Bench hover). */
  benchRank: Record<PosGroup, number>;
}

export interface LeagueRankings {
  /** All teams, strongest first. */
  teams: RankedTeam[];
  /** Per-metric league distribution (min/median/max) for the positional-group bars
   *  (POS_GROUPS + "STARTERS" + "BENCH"). Drives value-relative bar length + median tick. */
  groupStats: Record<string, Stats>;
  /** Per-starter-slot league distribution (Starter Rankings + Starting Lineup). */
  slotStats: Record<StarterSlot, Stats>;
  /** Per-axis league distribution of AVERAGE bench value (radar Bench view). */
  benchAxisStats: Record<PosGroup, Stats>;
}

/** Min / median / max of a numeric list. Empty → all zero. */
export function computeStats(values: number[]): Stats {
  if (values.length === 0) return { min: 0, median: 0, max: 0 };
  const s = values.slice().sort((a, b) => a - b);
  const n = s.length;
  const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  return { min: s[0], median: round1(median), max: s[n - 1] };
}

/**
 * Normalize a value to 0..1 across a metric's league range (min → 0, max → 1),
 * clamped. When every team is equal (max == min) there is no spread: return 1 for
 * the top value, else 0. This is the "relative to the league" scale the owner asked
 * for — the worst team sits at the axis origin, the best at the far end.
 */
export function normalize(value: number, st: Stats): number {
  if (st.max <= st.min) return value >= st.max ? 1 : 0;
  return Math.max(0, Math.min(1, (value - st.min) / (st.max - st.min)));
}

const pts = (p: Player): number => (typeof p.projPts === "number" ? p.projPts : 0);

/**
 * Build a team's optimal superflex starting lineup from its offensive players.
 * Fill order matches the valuation engine: dedicated slots first, then FLEX (best
 * remaining RB/WR/TE), then SFLEX (best remaining QB/RB/WR/TE), each greedily by
 * Kerf points. A slot with no eligible player left is returned with player: null,
 * points: 0 (an incomplete roster never crashes — it just scores less).
 */
export function buildLineup(roster: Player[]): LineupSlot[] {
  // Eligible, projected offensive players, richest first.
  const pool = roster
    .filter((p) => OFFENSE_POSITIONS.includes(p.pos) && typeof p.projPts === "number")
    .slice()
    .sort((a, b) => pts(b) - pts(a) || a.name.localeCompare(b.name));

  const used = new Set<string>();
  const out: LineupSlot[] = [];
  for (const slot of STARTER_SLOTS) {
    const eligible = SLOT_ELIGIBILITY[slot];
    const pick = pool.find((p) => !used.has(p.id) && eligible.includes(p.pos));
    if (pick) {
      used.add(pick.id);
      out.push({ slot, label: SLOT_LABEL[slot], player: pick, points: pts(pick) });
    } else {
      out.push({ slot, label: SLOT_LABEL[slot], player: null, points: 0 });
    }
  }
  return out;
}

/** Aggregate one team's roster into its raw strength numbers. */
export function teamStrength(team: string, roster: Player[]): TeamStrength {
  const offense = roster.filter((p) => OFFENSE_POSITIONS.includes(p.pos));
  const lineup = buildLineup(roster);
  const starterIds = new Set(lineup.filter((s) => s.player).map((s) => s.player!.id));

  const starterStrength = lineup.reduce((s, slot) => s + slot.points, 0);
  const totalRoster = offense.reduce((s, p) => s + pts(p), 0);

  const bySlot: Record<StarterSlot, number> = Object.fromEntries(
    lineup.map((s) => [s.slot, s.points])
  ) as Record<StarterSlot, number>;
  const groupStarters = Object.fromEntries(
    POS_GROUPS.map((g) => [g, GROUP_SLOTS[g].reduce((s, slot) => s + bySlot[slot], 0)])
  ) as Record<PosGroup, number>;

  const benchByPos: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, DST: 0 };
  const benchCountByPos: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, DST: 0 };
  for (const p of offense) {
    // Only projected, non-starting players count toward bench sums/averages — an
    // unprojected offensive player is not a "0-point bench player" dragging averages.
    if (!starterIds.has(p.id) && typeof p.projPts === "number") {
      benchByPos[p.pos] += pts(p);
      benchCountByPos[p.pos] += 1;
    }
  }

  return {
    team,
    starterStrength: round1(starterStrength),
    totalRoster: round1(totalRoster),
    benchStrength: round1(totalRoster - starterStrength),
    lineup,
    groupStarters: mapVals(groupStarters, round1),
    benchByPos: mapVals(benchByPos, round1),
    benchCountByPos,
  };
}

/**
 * Rank, score and tier every team from the full player board. Free agents and
 * defenses are ignored (offense-only). Teams are discovered from the rostered
 * offensive players, so an empty/degenerate board yields an empty league safely.
 */
export function computeLeague(players: Player[]): LeagueRankings {
  const rostered = players.filter((p) => p.owner && p.owner !== FREE_AGENT);
  const byTeam = new Map<string, Player[]>();
  for (const p of rostered) {
    if (!OFFENSE_POSITIONS.includes(p.pos)) continue;
    (byTeam.get(p.owner) ?? byTeam.set(p.owner, []).get(p.owner)!).push(p);
  }

  const strengths = [...byTeam.entries()]
    .map(([team, roster]) => teamStrength(team, roster))
    .sort((a, b) => b.starterStrength - a.starterStrength || a.team.localeCompare(b.team));

  const maxStarter = strengths.reduce((m, t) => Math.max(m, t.starterStrength), 0);

  // AVERAGE bench value per radar axis (owner's spec): pooled mean of the bench
  // players feeding that axis. FLEX pools bench RB/WR/TE; SFLX pools all bench
  // offense. 0 when the team benches nobody eligible for that axis.
  const avg = (sum: number, count: number): number => (count > 0 ? round1(sum / count) : 0);
  const benchAvgByGroupOf = (t: TeamStrength): Record<PosGroup, number> => {
    const c = t.benchCountByPos;
    const b = t.benchByPos;
    return {
      QB: avg(b.QB, c.QB),
      RB: avg(b.RB, c.RB),
      WR: avg(b.WR, c.WR),
      TE: avg(b.TE, c.TE),
      FLEX: avg(b.RB + b.WR + b.TE, c.RB + c.WR + c.TE),
      SFLX: avg(b.QB + b.RB + b.WR + b.TE, c.QB + c.RB + c.WR + c.TE),
    };
  };

  // Distinct ranks per metric (sorted desc, ties broken by team name).
  const rankBy = (value: (t: TeamStrength) => number): Map<string, number> => {
    const order = strengths
      .slice()
      .sort((a, b) => value(b) - value(a) || a.team.localeCompare(b.team));
    return new Map(order.map((t, i) => [t.team, i + 1]));
  };

  const overallRank = rankBy((t) => t.starterStrength);
  const totalRank = rankBy((t) => t.totalRoster);
  const groupRankMaps: Record<string, Map<string, number>> = {};
  for (const g of POS_GROUPS) groupRankMaps[g] = rankBy((t) => t.groupStarters[g]);
  groupRankMaps.STARTERS = rankBy((t) => t.starterStrength);
  groupRankMaps.BENCH = rankBy((t) => t.benchStrength);
  const slotRankMaps: Record<string, Map<string, number>> = {};
  for (const slot of STARTER_SLOTS) {
    slotRankMaps[slot] = rankBy((t) => t.lineup.find((s) => s.slot === slot)!.points);
  }
  const benchRankMaps: Record<string, Map<string, number>> = {};
  for (const g of POS_GROUPS) benchRankMaps[g] = rankBy((t) => benchAvgByGroupOf(t)[g]);

  const tierMap = assignTiers(strengths.map((t) => t.starterStrength));

  const teams: RankedTeam[] = strengths.map((t, i) => ({
    ...t,
    rank: overallRank.get(t.team)!,
    score: maxStarter > 0 ? Math.round((100 * t.starterStrength) / maxStarter) : 0,
    tier: tierMap[i],
    totalRosterRank: totalRank.get(t.team)!,
    groupRank: Object.fromEntries(
      Object.keys(groupRankMaps).map((k) => [k, groupRankMaps[k].get(t.team)!])
    ),
    slotRank: Object.fromEntries(
      STARTER_SLOTS.map((s) => [s, slotRankMaps[s].get(t.team)!])
    ) as Record<StarterSlot, number>,
    benchAvgByGroup: benchAvgByGroupOf(t),
    benchRank: Object.fromEntries(
      POS_GROUPS.map((g) => [g, benchRankMaps[g].get(t.team)!])
    ) as Record<PosGroup, number>,
  }));

  // Per-metric league distributions (min/median/max) for value-relative scaling.
  const groupStats: Record<string, Stats> = {};
  for (const g of POS_GROUPS) groupStats[g] = computeStats(teams.map((t) => t.groupStarters[g]));
  groupStats.STARTERS = computeStats(teams.map((t) => t.starterStrength));
  groupStats.BENCH = computeStats(teams.map((t) => t.benchStrength));
  const slotStats = Object.fromEntries(
    STARTER_SLOTS.map((slot) => [
      slot,
      computeStats(teams.map((t) => t.lineup.find((s) => s.slot === slot)!.points)),
    ])
  ) as Record<StarterSlot, Stats>;
  const benchAxisStats = Object.fromEntries(
    POS_GROUPS.map((g) => [g, computeStats(teams.map((t) => t.benchAvgByGroup[g]))])
  ) as Record<PosGroup, Stats>;

  return { teams, groupStats, slotStats, benchAxisStats };
}

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

const round1 = (x: number): number => Math.round(x * 10) / 10;

function mapVals<K extends string>(
  obj: Record<K, number>,
  f: (n: number) => number
): Record<K, number> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v as number)])) as Record<
    K,
    number
  >;
}

/**
 * Jenks natural-breaks tiering into 3 bands (contenders / middle / rebuilders),
 * the same approach the engine uses for player tiers (tools/engine/core.mjs).
 * Ported to TypeScript here to keep this module dependency-free. Returns a tier
 * (1 = best) per input value, in input order. Fewer than 3 teams degrade safely.
 */
export function assignTiers(values: number[], k = 3): number[] {
  const n = values.length;
  if (n === 0) return [];
  // Clamp exactly as the engine does (core.mjs assignTiers) so the tier mapping is
  // identical, not merely similar — matters only when fewer than k values exist.
  const kUsed = Math.max(1, Math.min(k, n));
  const classes = jenksClasses(values, kUsed);
  return classes.map((c) => kUsed - c); // highest class (best) -> tier 1
}

/**
 * Fisher's exact 1-D Jenks classification (minimize within-class squared
 * deviation) into `k` classes; returns a class index 0..k-1 per value (0 =
 * lowest band), in input order. Deterministic. Mirrors `jenksClasses` in
 * tools/engine/core.mjs.
 */
export function jenksClasses(values: number[], k: number): number[] {
  const n = values.length;
  if (n === 0) return [];
  const kk = Math.max(1, Math.min(k, n));
  if (kk === 1) return values.map(() => 0);

  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b] || a - b);
  const x = order.map((i) => values[i]);

  const pre = new Float64Array(n + 1);
  const pre2 = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    pre[i + 1] = pre[i] + x[i];
    pre2[i + 1] = pre2[i] + x[i] * x[i];
  }
  const sse = (i: number, j: number): number => {
    const len = j - i + 1;
    const s = pre[j + 1] - pre[i];
    const s2 = pre2[j + 1] - pre2[i];
    return s2 - (s * s) / len;
  };

  const cost = Array.from({ length: kk + 1 }, () => new Float64Array(n + 1).fill(Infinity));
  const arg = Array.from({ length: kk + 1 }, () => new Int32Array(n + 1));
  for (let j = 1; j <= n; j++) cost[1][j] = sse(0, j - 1);
  for (let c = 2; c <= kk; c++) {
    for (let j = c; j <= n; j++) {
      let best = Infinity;
      let bm = c - 1;
      for (let m = c - 1; m <= j - 1; m++) {
        const cand = cost[c - 1][m] + sse(m, j - 1);
        if (cand < best) {
          best = cand;
          bm = m;
        }
      }
      cost[c][j] = best;
      arg[c][j] = bm;
    }
  }

  const classOfSorted = new Int32Array(n);
  let j = n;
  for (let c = kk; c >= 1; c--) {
    const m = c === 1 ? 0 : arg[c][j];
    for (let p = m; p < j; p++) classOfSorted[p] = c - 1;
    j = m;
  }

  const out = new Array<number>(n);
  for (let p = 0; p < n; p++) out[order[p]] = classOfSorted[p];
  return out;
}

// ---------------------------------------------------------------------------
// Presentation helpers (shared by the chart components + tests).
// ---------------------------------------------------------------------------

/** "1st", "2nd", "3rd", "11th" … */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Tier labels for the league table. */
export const TIER_LABEL: Record<number, string> = {
  1: "Contenders",
  2: "Middle",
  3: "Rebuilders",
};

/**
 * Rank → strength band, thirds of the league: top third strong, middle third
 * neutral, bottom third weak. Drives the green/blue/red bar colors (matching the
 * FantasyPros reference: top ranks green, middle blue, low red).
 */
export function rankBand(rank: number, total: number): "strong" | "middle" | "weak" {
  if (total <= 0) return "middle";
  const third = total / 3;
  if (rank <= Math.ceil(third)) return "strong";
  if (rank <= Math.ceil(third * 2)) return "middle";
  return "weak";
}
