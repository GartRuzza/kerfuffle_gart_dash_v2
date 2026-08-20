import { FREE_AGENT, MY_TEAM, POSITIONS, type Player, type Position } from "./types";

/** The hand-authored fields. Everything else on `Player` is derived below. */
type RawPlayer = Omit<
  Player,
  | "projPts"
  | "kerfOvrRank"
  | "kerfPosRank"
  | "posEcr"
  | "dynPosEcr"
  | "kerfOvrTier"
  | "kerfPosTier"
  | "ovrEcrTier"
  | "posEcrTier"
  | "dynOvrTier"
  | "dynPosTier"
>;

/**
 * ⚠ MOCK DATA — NOT REAL LEAGUE DATA.
 *
 * ~80 real NFL players with entirely INVENTED salaries, values, tiers, and
 * rankings, authored by hand for the UI prototype (Issue #1). Numbers are
 * shaped only to exercise the table: KERF Value deliberately diverges from
 * Market Price so the "Edge" column shows a realistic mix of green (we value
 * him above market) and red (below). Nothing here is computed by an engine and
 * nothing is real. This is the single module that real CBS / FantasyPros data
 * replaces later (roadmap #2–3).
 *
 * Rankings (ecr / dynastyEcr) are treated as OVERALL ranks in a superflex
 * league — quarterbacks cluster near the top on purpose.
 */

// Rival fantasy teams (the owner's team is MY_TEAM = "Rangoon Raccoons").
export const BAVARIAN = "Bavarian Bandits";
export const NASHVILLE = "Nashville Narwhals";
export const SYDNEY = "Sydney Sasquatch";

const RAW_PLAYERS: RawPlayer[] = [
  // ---- Quarterbacks (superflex → premium) ----
  { id: "qb-allen", name: "Josh Allen", pos: "QB", nflTeam: "BUF", owner: MY_TEAM, tier: 1, kerfValue: 68, marketPrice: 60, ecr: 1, dynastyEcr: 2, salary: 62, contractYears: 2 },
  { id: "qb-mahomes", name: "Patrick Mahomes", pos: "QB", nflTeam: "KC", owner: BAVARIAN, tier: 1, kerfValue: 64, marketPrice: 66, ecr: 3, dynastyEcr: 1, salary: 65, contractYears: 2 },
  { id: "qb-lamar", name: "Lamar Jackson", pos: "QB", nflTeam: "BAL", owner: NASHVILLE, tier: 1, kerfValue: 66, marketPrice: 58, ecr: 2, dynastyEcr: 4, salary: 58, contractYears: 2 },
  { id: "qb-hurts", name: "Jalen Hurts", pos: "QB", nflTeam: "PHI", owner: SYDNEY, tier: 1, kerfValue: 61, marketPrice: 57, ecr: 5, dynastyEcr: 5, salary: 55, contractYears: 2 },
  { id: "qb-burrow", name: "Joe Burrow", pos: "QB", nflTeam: "CIN", owner: MY_TEAM, tier: 1, kerfValue: 62, marketPrice: 63, ecr: 4, dynastyEcr: 3, salary: 60, contractYears: 2 },
  { id: "qb-daniels", name: "Jayden Daniels", pos: "QB", nflTeam: "WAS", owner: BAVARIAN, tier: 1, kerfValue: 60, marketPrice: 54, ecr: 6, dynastyEcr: 3, salary: 40, contractYears: 2 },
  { id: "qb-stroud", name: "C.J. Stroud", pos: "QB", nflTeam: "HOU", owner: NASHVILLE, tier: 2, kerfValue: 50, marketPrice: 46, ecr: 12, dynastyEcr: 7, salary: 35, contractYears: 2 },
  { id: "qb-herbert", name: "Justin Herbert", pos: "QB", nflTeam: "LAC", owner: SYDNEY, tier: 2, kerfValue: 48, marketPrice: 50, ecr: 10, dynastyEcr: 9, salary: 44, contractYears: 2 },
  { id: "qb-love", name: "Jordan Love", pos: "QB", nflTeam: "GB", owner: MY_TEAM, tier: 2, kerfValue: 47, marketPrice: 44, ecr: 11, dynastyEcr: 8, salary: 38, contractYears: 2 },
  { id: "qb-nix", name: "Bo Nix", pos: "QB", nflTeam: "DEN", owner: BAVARIAN, tier: 3, kerfValue: 40, marketPrice: 33, ecr: 15, dynastyEcr: 12, salary: 22, contractYears: 2 },
  { id: "qb-purdy", name: "Brock Purdy", pos: "QB", nflTeam: "SF", owner: NASHVILLE, tier: 3, kerfValue: 38, marketPrice: 40, ecr: 14, dynastyEcr: 13, salary: 30, contractYears: 1 },
  { id: "qb-kyler", name: "Kyler Murray", pos: "QB", nflTeam: "ARI", owner: SYDNEY, tier: 3, kerfValue: 37, marketPrice: 39, ecr: 16, dynastyEcr: 15, salary: 33, contractYears: 1 },
  { id: "qb-baker", name: "Baker Mayfield", pos: "QB", nflTeam: "TB", owner: MY_TEAM, tier: 3, kerfValue: 39, marketPrice: 35, ecr: 13, dynastyEcr: 16, salary: 26, contractYears: 1 },
  { id: "qb-caleb", name: "Caleb Williams", pos: "QB", nflTeam: "CHI", owner: BAVARIAN, tier: 4, kerfValue: 33, marketPrice: 28, ecr: 20, dynastyEcr: 10, salary: 20, contractYears: 2 },
  { id: "qb-maye", name: "Drake Maye", pos: "QB", nflTeam: "NE", owner: NASHVILLE, tier: 4, kerfValue: 31, marketPrice: 25, ecr: 22, dynastyEcr: 11, salary: 18, contractYears: 2 },
  { id: "qb-dak", name: "Dak Prescott", pos: "QB", nflTeam: "DAL", owner: FREE_AGENT, tier: 3, kerfValue: 36, marketPrice: 34, ecr: 17, dynastyEcr: 18, salary: 0, contractYears: null },
  { id: "qb-penix", name: "Michael Penix Jr.", pos: "QB", nflTeam: "ATL", owner: FREE_AGENT, tier: 5, kerfValue: 22, marketPrice: 18, ecr: 30, dynastyEcr: 20, salary: 0, contractYears: null },

  // ---- Running backs ----
  { id: "rb-bijan", name: "Bijan Robinson", pos: "RB", nflTeam: "ATL", owner: MY_TEAM, tier: 1, kerfValue: 57, marketPrice: 60, ecr: 7, dynastyEcr: 5, salary: 52, contractYears: 2 },
  { id: "rb-saquon", name: "Saquon Barkley", pos: "RB", nflTeam: "PHI", owner: BAVARIAN, tier: 1, kerfValue: 55, marketPrice: 58, ecr: 8, dynastyEcr: 14, salary: 50, contractYears: 2 },
  { id: "rb-gibbs", name: "Jahmyr Gibbs", pos: "RB", nflTeam: "DET", owner: NASHVILLE, tier: 1, kerfValue: 56, marketPrice: 54, ecr: 9, dynastyEcr: 6, salary: 48, contractYears: 2 },
  { id: "rb-achane", name: "De'Von Achane", pos: "RB", nflTeam: "MIA", owner: SYDNEY, tier: 2, kerfValue: 49, marketPrice: 52, ecr: 13, dynastyEcr: 10, salary: 40, contractYears: 2 },
  { id: "rb-jeanty", name: "Ashton Jeanty", pos: "RB", nflTeam: "LV", owner: MY_TEAM, tier: 2, kerfValue: 47, marketPrice: 44, ecr: 18, dynastyEcr: 8, salary: 30, contractYears: 2 },
  { id: "rb-cmc", name: "Christian McCaffrey", pos: "RB", nflTeam: "SF", owner: SYDNEY, tier: 2, kerfValue: 44, marketPrice: 48, ecr: 16, dynastyEcr: 25, salary: 46, contractYears: 1 },
  { id: "rb-henry", name: "Derrick Henry", pos: "RB", nflTeam: "BAL", owner: BAVARIAN, tier: 2, kerfValue: 46, marketPrice: 43, ecr: 19, dynastyEcr: 40, salary: 34, contractYears: 1 },
  { id: "rb-jtaylor", name: "Jonathan Taylor", pos: "RB", nflTeam: "IND", owner: NASHVILLE, tier: 2, kerfValue: 43, marketPrice: 45, ecr: 21, dynastyEcr: 17, salary: 38, contractYears: 2 },
  { id: "rb-breece", name: "Breece Hall", pos: "RB", nflTeam: "NYJ", owner: SYDNEY, tier: 3, kerfValue: 40, marketPrice: 42, ecr: 23, dynastyEcr: 15, salary: 33, contractYears: 1 },
  { id: "rb-jacobs", name: "Josh Jacobs", pos: "RB", nflTeam: "GB", owner: MY_TEAM, tier: 3, kerfValue: 39, marketPrice: 37, ecr: 24, dynastyEcr: 22, salary: 28, contractYears: 2 },
  { id: "rb-kyren", name: "Kyren Williams", pos: "RB", nflTeam: "LAR", owner: BAVARIAN, tier: 3, kerfValue: 36, marketPrice: 34, ecr: 27, dynastyEcr: 24, salary: 24, contractYears: 1 },
  { id: "rb-bucky", name: "Bucky Irving", pos: "RB", nflTeam: "TB", owner: NASHVILLE, tier: 3, kerfValue: 38, marketPrice: 31, ecr: 26, dynastyEcr: 12, salary: 16, contractYears: 2 },
  { id: "rb-chasebrown", name: "Chase Brown", pos: "RB", nflTeam: "CIN", owner: SYDNEY, tier: 3, kerfValue: 35, marketPrice: 30, ecr: 28, dynastyEcr: 19, salary: 15, contractYears: 2 },
  { id: "rb-cook", name: "James Cook", pos: "RB", nflTeam: "BUF", owner: MY_TEAM, tier: 3, kerfValue: 34, marketPrice: 36, ecr: 25, dynastyEcr: 21, salary: 22, contractYears: 1 },
  { id: "rb-kwalker", name: "Kenneth Walker III", pos: "RB", nflTeam: "SEA", owner: BAVARIAN, tier: 4, kerfValue: 31, marketPrice: 33, ecr: 32, dynastyEcr: 23, salary: 20, contractYears: 1 },
  { id: "rb-pacheco", name: "Isiah Pacheco", pos: "RB", nflTeam: "KC", owner: NASHVILLE, tier: 4, kerfValue: 27, marketPrice: 29, ecr: 36, dynastyEcr: 30, salary: 17, contractYears: 1 },
  { id: "rb-mixon", name: "Joe Mixon", pos: "RB", nflTeam: "HOU", owner: SYDNEY, tier: 4, kerfValue: 30, marketPrice: 32, ecr: 31, dynastyEcr: 38, salary: 21, contractYears: 1 },
  { id: "rb-kamara", name: "Alvin Kamara", pos: "RB", nflTeam: "NO", owner: FREE_AGENT, tier: 4, kerfValue: 29, marketPrice: 28, ecr: 33, dynastyEcr: 45, salary: 0, contractYears: null },
  { id: "rb-montgomery", name: "David Montgomery", pos: "RB", nflTeam: "DET", owner: FREE_AGENT, tier: 4, kerfValue: 28, marketPrice: 26, ecr: 35, dynastyEcr: 42, salary: 0, contractYears: null },
  { id: "rb-pollard", name: "Tony Pollard", pos: "RB", nflTeam: "TEN", owner: FREE_AGENT, tier: 5, kerfValue: 24, marketPrice: 22, ecr: 41, dynastyEcr: 48, salary: 0, contractYears: null },
  { id: "rb-ajones", name: "Aaron Jones", pos: "RB", nflTeam: "MIN", owner: FREE_AGENT, tier: 5, kerfValue: 23, marketPrice: 24, ecr: 44, dynastyEcr: 55, salary: 0, contractYears: null },
  { id: "rb-brobinson", name: "Brian Robinson Jr.", pos: "RB", nflTeam: "WAS", owner: FREE_AGENT, tier: 5, kerfValue: 22, marketPrice: 20, ecr: 46, dynastyEcr: 50, salary: 0, contractYears: null },

  // ---- Wide receivers ----
  { id: "wr-chase", name: "Ja'Marr Chase", pos: "WR", nflTeam: "CIN", owner: MY_TEAM, tier: 1, kerfValue: 71, marketPrice: 58, ecr: 6, dynastyEcr: 3, salary: 54, contractYears: 2 },
  { id: "wr-jefferson", name: "Justin Jefferson", pos: "WR", nflTeam: "MIN", owner: BAVARIAN, tier: 1, kerfValue: 63, marketPrice: 61, ecr: 5, dynastyEcr: 4, salary: 56, contractYears: 2 },
  { id: "wr-ceedee", name: "CeeDee Lamb", pos: "WR", nflTeam: "DAL", owner: NASHVILLE, tier: 1, kerfValue: 60, marketPrice: 59, ecr: 7, dynastyEcr: 6, salary: 53, contractYears: 2 },
  { id: "wr-arsb", name: "Amon-Ra St. Brown", pos: "WR", nflTeam: "DET", owner: SYDNEY, tier: 1, kerfValue: 59, marketPrice: 52, ecr: 9, dynastyEcr: 8, salary: 47, contractYears: 2 },
  { id: "wr-puka", name: "Puka Nacua", pos: "WR", nflTeam: "LAR", owner: MY_TEAM, tier: 1, kerfValue: 57, marketPrice: 50, ecr: 11, dynastyEcr: 7, salary: 40, contractYears: 2 },
  { id: "wr-nabers", name: "Malik Nabers", pos: "WR", nflTeam: "NYG", owner: BAVARIAN, tier: 2, kerfValue: 54, marketPrice: 49, ecr: 12, dynastyEcr: 5, salary: 34, contractYears: 2 },
  { id: "wr-nico", name: "Nico Collins", pos: "WR", nflTeam: "HOU", owner: NASHVILLE, tier: 2, kerfValue: 50, marketPrice: 47, ecr: 14, dynastyEcr: 12, salary: 36, contractYears: 2 },
  { id: "wr-btj", name: "Brian Thomas Jr.", pos: "WR", nflTeam: "JAX", owner: SYDNEY, tier: 2, kerfValue: 51, marketPrice: 45, ecr: 15, dynastyEcr: 9, salary: 30, contractYears: 2 },
  { id: "wr-ajbrown", name: "A.J. Brown", pos: "WR", nflTeam: "PHI", owner: MY_TEAM, tier: 2, kerfValue: 49, marketPrice: 51, ecr: 13, dynastyEcr: 16, salary: 44, contractYears: 2 },
  { id: "wr-london", name: "Drake London", pos: "WR", nflTeam: "ATL", owner: BAVARIAN, tier: 2, kerfValue: 48, marketPrice: 44, ecr: 17, dynastyEcr: 11, salary: 32, contractYears: 2 },
  { id: "wr-ladd", name: "Ladd McConkey", pos: "WR", nflTeam: "LAC", owner: NASHVILLE, tier: 2, kerfValue: 46, marketPrice: 40, ecr: 29, dynastyEcr: 14, salary: 24, contractYears: 2 },
  { id: "wr-gwilson", name: "Garrett Wilson", pos: "WR", nflTeam: "NYJ", owner: SYDNEY, tier: 2, kerfValue: 45, marketPrice: 46, ecr: 18, dynastyEcr: 13, salary: 34, contractYears: 2 },
  { id: "wr-higgins", name: "Tee Higgins", pos: "WR", nflTeam: "CIN", owner: MY_TEAM, tier: 3, kerfValue: 42, marketPrice: 44, ecr: 34, dynastyEcr: 26, salary: 36, contractYears: 2 },
  { id: "wr-mhj", name: "Marvin Harrison Jr.", pos: "WR", nflTeam: "ARI", owner: BAVARIAN, tier: 3, kerfValue: 43, marketPrice: 46, ecr: 37, dynastyEcr: 10, salary: 28, contractYears: 2 },
  { id: "wr-evans", name: "Mike Evans", pos: "WR", nflTeam: "TB", owner: NASHVILLE, tier: 3, kerfValue: 41, marketPrice: 39, ecr: 38, dynastyEcr: 33, salary: 31, contractYears: 1 },
  { id: "wr-metcalf", name: "DK Metcalf", pos: "WR", nflTeam: "PIT", owner: MY_TEAM, tier: 3, kerfValue: 39, marketPrice: 41, ecr: 39, dynastyEcr: 27, salary: 32, contractYears: 2 },
  { id: "wr-davante", name: "Davante Adams", pos: "WR", nflTeam: "LAR", owner: SYDNEY, tier: 3, kerfValue: 40, marketPrice: 42, ecr: 35, dynastyEcr: 35, salary: 33, contractYears: 1 },
  { id: "wr-mclaurin", name: "Terry McLaurin", pos: "WR", nflTeam: "WAS", owner: SYDNEY, tier: 3, kerfValue: 37, marketPrice: 35, ecr: 40, dynastyEcr: 31, salary: 27, contractYears: 1 },
  { id: "wr-olave", name: "Chris Olave", pos: "WR", nflTeam: "NO", owner: NASHVILLE, tier: 3, kerfValue: 36, marketPrice: 34, ecr: 43, dynastyEcr: 20, salary: 25, contractYears: 2 },
  { id: "wr-jsn", name: "Jaxon Smith-Njigba", pos: "WR", nflTeam: "SEA", owner: NASHVILLE, tier: 4, kerfValue: 35, marketPrice: 33, ecr: 42, dynastyEcr: 17, salary: 22, contractYears: 2 },
  { id: "wr-zayflowers", name: "Zay Flowers", pos: "WR", nflTeam: "BAL", owner: MY_TEAM, tier: 4, kerfValue: 34, marketPrice: 31, ecr: 45, dynastyEcr: 22, salary: 20, contractYears: 2 },
  { id: "wr-jameson", name: "Jameson Williams", pos: "WR", nflTeam: "DET", owner: BAVARIAN, tier: 4, kerfValue: 33, marketPrice: 29, ecr: 47, dynastyEcr: 21, salary: 17, contractYears: 2 },
  { id: "wr-odunze", name: "Rome Odunze", pos: "WR", nflTeam: "CHI", owner: BAVARIAN, tier: 4, kerfValue: 32, marketPrice: 30, ecr: 49, dynastyEcr: 18, salary: 18, contractYears: 2 },
  { id: "wr-worthy", name: "Xavier Worthy", pos: "WR", nflTeam: "KC", owner: SYDNEY, tier: 4, kerfValue: 31, marketPrice: 28, ecr: 50, dynastyEcr: 24, salary: 16, contractYears: 2 },
  { id: "wr-devonta", name: "DeVonta Smith", pos: "WR", nflTeam: "PHI", owner: SYDNEY, tier: 4, kerfValue: 34, marketPrice: 33, ecr: 44, dynastyEcr: 28, salary: 24, contractYears: 1 },
  { id: "wr-sutton", name: "Courtland Sutton", pos: "WR", nflTeam: "DEN", owner: BAVARIAN, tier: 4, kerfValue: 30, marketPrice: 32, ecr: 48, dynastyEcr: 34, salary: 19, contractYears: 1 },
  { id: "wr-ridley", name: "Calvin Ridley", pos: "WR", nflTeam: "TEN", owner: FREE_AGENT, tier: 5, kerfValue: 26, marketPrice: 27, ecr: 52, dynastyEcr: 44, salary: 0, contractYears: null },
  { id: "wr-kupp", name: "Cooper Kupp", pos: "WR", nflTeam: "SEA", owner: FREE_AGENT, tier: 5, kerfValue: 25, marketPrice: 28, ecr: 53, dynastyEcr: 52, salary: 0, contractYears: null },
  { id: "wr-keon", name: "Keon Coleman", pos: "WR", nflTeam: "BUF", owner: FREE_AGENT, tier: 6, kerfValue: 20, marketPrice: 17, ecr: 60, dynastyEcr: 32, salary: 0, contractYears: null },

  // ---- Tight ends ----
  { id: "te-bowers", name: "Brock Bowers", pos: "TE", nflTeam: "LV", owner: MY_TEAM, tier: 1, kerfValue: 52, marketPrice: 46, ecr: 10, dynastyEcr: 6, salary: 30, contractYears: 2 },
  { id: "te-mcbride", name: "Trey McBride", pos: "TE", nflTeam: "ARI", owner: BAVARIAN, tier: 2, kerfValue: 44, marketPrice: 41, ecr: 20, dynastyEcr: 15, salary: 28, contractYears: 2 },
  { id: "te-kittle", name: "George Kittle", pos: "TE", nflTeam: "SF", owner: NASHVILLE, tier: 2, kerfValue: 42, marketPrice: 44, ecr: 22, dynastyEcr: 29, salary: 30, contractYears: 1 },
  { id: "te-laporta", name: "Sam LaPorta", pos: "TE", nflTeam: "DET", owner: SYDNEY, tier: 2, kerfValue: 40, marketPrice: 38, ecr: 27, dynastyEcr: 16, salary: 26, contractYears: 2 },
  { id: "te-andrews", name: "Mark Andrews", pos: "TE", nflTeam: "BAL", owner: MY_TEAM, tier: 3, kerfValue: 33, marketPrice: 35, ecr: 41, dynastyEcr: 40, salary: 24, contractYears: 1 },
  { id: "te-hockenson", name: "T.J. Hockenson", pos: "TE", nflTeam: "MIN", owner: BAVARIAN, tier: 3, kerfValue: 31, marketPrice: 30, ecr: 45, dynastyEcr: 36, salary: 20, contractYears: 1 },
  { id: "te-njoku", name: "David Njoku", pos: "TE", nflTeam: "CLE", owner: NASHVILLE, tier: 3, kerfValue: 30, marketPrice: 32, ecr: 46, dynastyEcr: 37, salary: 19, contractYears: 1 },
  { id: "te-kincaid", name: "Dalton Kincaid", pos: "TE", nflTeam: "BUF", owner: SYDNEY, tier: 4, kerfValue: 27, marketPrice: 24, ecr: 51, dynastyEcr: 29, salary: 15, contractYears: 2 },
  { id: "te-engram", name: "Evan Engram", pos: "TE", nflTeam: "DEN", owner: FREE_AGENT, tier: 5, kerfValue: 22, marketPrice: 23, ecr: 55, dynastyEcr: 54, salary: 0, contractYears: null },
  { id: "te-kraft", name: "Tucker Kraft", pos: "TE", nflTeam: "GB", owner: FREE_AGENT, tier: 5, kerfValue: 23, marketPrice: 20, ecr: 54, dynastyEcr: 31, salary: 0, contractYears: null },
  { id: "te-loveland", name: "Colston Loveland", pos: "TE", nflTeam: "CHI", owner: FREE_AGENT, tier: 6, kerfValue: 18, marketPrice: 15, ecr: 62, dynastyEcr: 34, salary: 0, contractYears: null },
];

// --- Derived fields (all mock) ---------------------------------------------
// projPts: a mock projected-KERFUFFLE-points number, shaped from Kerf value with
// a small deterministic wobble so it reads like an independent projection.
// Ranks: overall + positional, by Kerf value / ECR / dynasty ECR.
// Tiers: one dimension per rank column that shows bands. Real tiers come from the
// engine (Kerf) and FantasyPros (ECR) later — these are bucketed by rank for now.

const POS_PROJ_BASE: Record<Position, number> = { QB: 120, RB: 90, WR: 90, TE: 80 };
const POS_PROJ_SCALE: Record<Position, number> = { QB: 3.4, RB: 3.6, WR: 3.1, TE: 3.4 };

function mockProjPts(p: RawPlayer): number {
  const texture = ((p.ecr * 3 + p.dynastyEcr) % 9) - 4;
  return Math.round(
    POS_PROJ_BASE[p.pos] + p.kerfValue * POS_PROJ_SCALE[p.pos] + texture,
  );
}

// Cumulative upper-bound of each tier's rank. Rank 1..6 = tier 1, 7..12 = tier 2…
const OVERALL_TIER_BREAKS = [6, 12, 20, 30, 42, 56, 72];
const POSITIONAL_TIER_BREAKS = [3, 6, 10, 15, 21];

/** Map a 1-based rank to a tier number given cumulative break points. */
export function tierFromRank(rank: number, breaks: number[]): number {
  for (let i = 0; i < breaks.length; i++) {
    if (rank <= breaks[i]) return i + 1;
  }
  return breaks.length + 1;
}

/** Assign 1-based ranks over a list, best-first per `betterFirst`. */
function rankMap(
  players: RawPlayer[],
  betterFirst: (a: RawPlayer, b: RawPlayer) => number,
): Record<string, number> {
  const out: Record<string, number> = {};
  [...players].sort(betterFirst).forEach((p, i) => {
    out[p.id] = i + 1;
  });
  return out;
}

// Overall ranks (best first)
const kerfOvrRankById = rankMap(RAW_PLAYERS, (a, b) => b.kerfValue - a.kerfValue);
const ovrEcrRankById = rankMap(RAW_PLAYERS, (a, b) => a.ecr - b.ecr);
const dynOvrRankById = rankMap(RAW_PLAYERS, (a, b) => a.dynastyEcr - b.dynastyEcr);

// Positional ranks (within each position)
const kerfPosRankById: Record<string, number> = {};
const posEcrById: Record<string, number> = {};
const dynPosById: Record<string, number> = {};
for (const pos of POSITIONS) {
  const group = RAW_PLAYERS.filter((p) => p.pos === pos);
  Object.assign(kerfPosRankById, rankMap(group, (a, b) => b.kerfValue - a.kerfValue));
  Object.assign(posEcrById, rankMap(group, (a, b) => a.ecr - b.ecr));
  Object.assign(dynPosById, rankMap(group, (a, b) => a.dynastyEcr - b.dynastyEcr));
}

export const MOCK_PLAYERS: Player[] = RAW_PLAYERS.map((p): Player => {
  const kerfOvrRank = kerfOvrRankById[p.id];
  const kerfPosRank = kerfPosRankById[p.id];
  const posEcr = posEcrById[p.id];
  const dynPosEcr = dynPosById[p.id];
  const ovrEcrRank = ovrEcrRankById[p.id];
  const dynOvrRank = dynOvrRankById[p.id];
  return {
    ...p,
    projPts: mockProjPts(p),
    kerfOvrRank,
    kerfPosRank,
    posEcr,
    dynPosEcr,
    kerfOvrTier: tierFromRank(kerfOvrRank, OVERALL_TIER_BREAKS),
    kerfPosTier: tierFromRank(kerfPosRank, POSITIONAL_TIER_BREAKS),
    ovrEcrTier: tierFromRank(ovrEcrRank, OVERALL_TIER_BREAKS),
    posEcrTier: tierFromRank(posEcr, POSITIONAL_TIER_BREAKS),
    dynOvrTier: tierFromRank(dynOvrRank, OVERALL_TIER_BREAKS),
    dynPosTier: tierFromRank(dynPosEcr, POSITIONAL_TIER_BREAKS),
  };
}).sort((a, b) => a.kerfOvrRank - b.kerfOvrRank);

/** Distinct fantasy-team names (excludes free agents), owner's team first. */
export const TEAMS: string[] = [
  MY_TEAM,
  ...Array.from(
    new Set(
      MOCK_PLAYERS.map((p) => p.owner).filter(
        (o) => o !== FREE_AGENT && o !== MY_TEAM,
      ),
    ),
  ).sort(),
];
