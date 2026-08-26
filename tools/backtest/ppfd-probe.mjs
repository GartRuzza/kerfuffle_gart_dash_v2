// PPFD probe (issue #19 follow-up, owner question 2026-08-26) — NOT a shipped tool.
//
// The overall backtest washes out because most players sit near their position's
// first-down (FD) conversion rate. This probe isolates the SIGNAL: for players
// whose 2024 FD rate is materially above/below their position average, does the
// KERFUFFLE first-down adjustment move their 2025 projection vs ECR — and in the
// RIGHT direction, judged against their actual 2025 finish? It also checks the
// make-or-break prerequisite: is FD conversion rate even sticky year to year?
//
// Strictly out-of-sample: 2024 rates predict 2025 (same as the backtest).
// Run: node tools/backtest/ppfd-probe.mjs

import { openDb, DB_PATH } from "../../db/client.mjs";
import { buildScoringMap } from "../ingest/scoring-crosscheck.mjs";
import { deriveFirstDownRates, derivePlayerRates, scoreProjection } from "../engine/core.mjs";
import { spearman } from "./core.mjs";

const SHRINKAGE = { rushK: 75, recK: 40 };
// Adequate 2024 sample to call a player's own rate "real" (not noise).
const MIN_RUSH_ATT = 50;
const MIN_REC = 30;
const f2 = (x) => (x == null ? "—" : x.toFixed(2));
const f3 = (x) => (x == null ? "—" : x.toFixed(3));

const db = openDb({ path: DB_PATH, readonly: false });

// ---- rates + samples from 2024 (the ONLY season the 2025 backtest may use) ----
const stat24 = db
  .prepare(`SELECT cbs_player_id, pos, rush_att, rush_yds, rush_first_downs, rec_rec, rec_yds, rec_first_downs
            FROM player_season_stats WHERE season = 2024`)
  .all();
const posRates24 = deriveFirstDownRates(stat24);
const playerRates24 = derivePlayerRates(stat24, posRates24, SHRINKAGE);
const own24 = new Map(); // cbsId -> {pos, rushAtt, rushRate, recRec, recRate}
for (const s of stat24) {
  own24.set(s.cbs_player_id, {
    pos: s.pos,
    rushAtt: s.rush_att, rushRate: s.rush_att >= 1 ? s.rush_first_downs / s.rush_att : null,
    recRec: s.rec_rec, recRate: s.rec_rec >= 1 ? s.rec_first_downs / s.rec_rec : null,
  });
}

// ---- 2025 own rates (for the persistence check) + actual points ----
const stat25 = db
  .prepare(`SELECT cbs_player_id, pos, rush_att, rush_first_downs, rec_rec, rec_first_downs, fpts_total
            FROM player_season_stats WHERE season = 2025`)
  .all();
const own25 = new Map();
const actual25 = new Map();
for (const s of stat25) {
  own25.set(s.cbs_player_id, {
    pos: s.pos,
    rushAtt: s.rush_att, rushRate: s.rush_att >= 1 ? s.rush_first_downs / s.rush_att : null,
    recRec: s.rec_rec, recRate: s.rec_rec >= 1 ? s.rec_first_downs / s.rec_rec : null,
  });
  if (s.fpts_total != null) actual25.set(s.cbs_player_id, s.fpts_total);
}

// ============================================================================
// A. PERSISTENCE — does a player's 2024 FD rate predict his 2025 FD rate?
//    If not, projecting 2025 from 2024 rates adds noise, not signal.
// ============================================================================
console.log(`\n==== A. FD-rate persistence 2024 -> 2025 (Spearman, adequate sample both years) ====`);
for (const [label, key, minKey, minN] of [
  ["Rushing FD/carry (RB)", "rushRate", "rushAtt", MIN_RUSH_ATT],
  ["Receiving FD/rec (WR+TE)", "recRate", "recRec", MIN_REC],
]) {
  const xs = [], ys = [];
  for (const [id, a] of own24) {
    const b = own25.get(id);
    if (!b) continue;
    if (label.startsWith("Rushing") && !(a.pos === "RB")) continue;
    if (label.startsWith("Receiving") && !(a.pos === "WR" || a.pos === "TE")) continue;
    if (a[minKey] >= minN && b[minKey] >= minN && a[key] != null && b[key] != null) {
      xs.push(a[key]); ys.push(b[key]);
    }
  }
  console.log(`  ${label.padEnd(26)} n=${String(xs.length).padStart(3)}  ρ(2024,2025) = ${f2(spearman(xs, ys))}`);
}

// ============================================================================
// B. IMPACT — for 2025 projected players with a real 2024 sample, split by
//    whether their 2024 FD rate was ABOVE / BELOW position average, and measure
//    how the adjustment moved their projection vs ECR and vs their actual finish.
// ============================================================================
const scoringPull = db.prepare(`SELECT pull_id FROM latest_pull`).get().pull_id;
const coef = buildScoringMap(db, scoringPull);

const src25 = db
  .prepare(`SELECT ps.* FROM projection_source ps JOIN pull ON pull.pull_id = ps.pull_id
            WHERE pull.kind='backtest' AND pull.season=2025 AND ps.cbs_player_id IS NOT NULL
              AND ps.pos IN ('QB','RB','WR','TE')`)
  .all();
const ecr25 = new Map();
for (const r of db
  .prepare(`SELECT mr.cbs_player_id, mr.pos_rank FROM market_ranking mr JOIN pull ON pull.pull_id=mr.pull_id
            WHERE pull.kind='backtest' AND pull.season=2025 AND mr.ranking_type='draft'
              AND mr.scoring_format='STD' AND mr.position_scope='OP' AND mr.cbs_player_id IS NOT NULL`)
  .all()) {
  const m = String(r.pos_rank ?? "").match(/(\d+)/);
  if (m) ecr25.set(r.cbs_player_id, Number(m[1]));
}

// name lookup for examples
const nameOf = new Map(db.prepare(`SELECT cbs_player_id, name FROM player`).all().map((r) => [r.cbs_player_id, r.name]));

// actual within-position rank (by 2025 fpts_total)
function actualPosRankMap(pos) {
  const rows = [...actual25.entries()]
    .filter(([id]) => (own25.get(id)?.pos ?? null) === pos)
    .sort((a, b) => b[1] - a[1]);
  const m = new Map();
  rows.forEach(([id], i) => m.set(id, i + 1));
  return m;
}

// Score each 2025 player two ways: with his own (2024-shrunk) FD rate, and with
// the position-average FD rate (the ablation). The difference is the pure
// player-specific FD effect.
const scored = src25.map((s) => {
  const withPlayer = scoreProjection(s, posRates24, coef, playerRates24.get(s.cbs_player_id) ?? null);
  const withPos = scoreProjection(s, posRates24, coef, null);
  return {
    id: s.cbs_player_id, pos: s.pos,
    ptsPlayer: withPlayer.kerfPoints, ptsPos: withPos.kerfPoints,
    fdDeltaPts: withPlayer.kerfPoints - withPos.kerfPoints,
  };
});

console.log(`\n==== B. Does the FD adjustment move the right players (2025, out-of-sample)? ====`);
for (const [posLabel, positions, rateKey, sampleKey, minN] of [
  ["RB (rush FD)", ["RB"], "rushRate", "rushAtt", MIN_RUSH_ATT],
  ["WR (rec FD)", ["WR"], "recRate", "recRec", MIN_REC],
  ["TE (rec FD)", ["TE"], "recRate", "recRec", MIN_REC],
]) {
  const posRate = positions[0] === "RB" ? posRates24.RB.rushFdPerAtt : posRates24[positions[0]].recFdPerRec;
  const actRank = new Map();
  for (const p of positions) for (const [id, r] of actualPosRankMap(p)) actRank.set(id, r);

  // players projected in 2025, with a real 2024 sample AND an ECR rank AND an actual
  const pool = scored
    .filter((sc) => positions.includes(sc.pos))
    .map((sc) => {
      const o = own24.get(sc.id);
      return {
        ...sc,
        own24Rate: o ? o[rateKey] : null,
        sample: o ? o[sampleKey] : 0,
        ecr: ecr25.get(sc.id) ?? null,
        act: actRank.get(sc.id) ?? null,
      };
    })
    .filter((x) => x.sample >= minN && x.own24Rate != null && x.ecr != null && x.act != null);

  // Kerf projected positional rank (within this position pool, by ptsPlayer) and
  // the position-only rank (by ptsPos) — the difference is the FD-driven move.
  const byPlayer = [...pool].sort((a, b) => b.ptsPlayer - a.ptsPlayer);
  byPlayer.forEach((x, i) => (x.kerfRank = i + 1));
  const byPos = [...pool].sort((a, b) => b.ptsPos - a.ptsPos);
  byPos.forEach((x, i) => (x.posRank = i + 1));

  const above = pool.filter((x) => x.own24Rate > posRate);
  const below = pool.filter((x) => x.own24Rate < posRate);
  const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null);

  console.log(`\n  ${posLabel}  (2024 position rate = ${f3(posRate)}/opp; n=${pool.length} with sample≥${minN})`);
  for (const [gLabel, g] of [["ABOVE-avg converters", above], ["BELOW-avg converters", below]]) {
    if (g.length === 0) { console.log(`    ${gLabel}: none`); continue; }
    // Did FD move them (Kerf-with-FD rank vs position-only rank)? + = boosted up.
    const moveVsPos = avg(g, (x) => x.posRank - x.kerfRank);
    // Did they beat consensus? ecr - actual, + = finished better than ECR ranked.
    const beatEcr = avg(g, (x) => x.ecr - x.act);
    // Ranking error vs actual: does Kerf's positional rank land closer than ECR's?
    const kerfErr = avg(g, (x) => Math.abs(x.kerfRank - x.act));
    const ecrErr = avg(g, (x) => Math.abs(x.ecr - x.act));
    const fdPts = avg(g, (x) => x.fdDeltaPts);
    console.log(
      `    ${gLabel.padEnd(22)} n=${String(g.length).padStart(2)}  FD±pts ${fdPts >= 0 ? "+" : ""}${f2(fdPts)}  ` +
        `FDmovedRank ${moveVsPos >= 0 ? "+" : ""}${f2(moveVsPos)}  beatECR(spots) ${beatEcr >= 0 ? "+" : ""}${f2(beatEcr)}  ` +
        `|err| Kerf ${f2(kerfErr)} vs ECR ${f2(ecrErr)}`
    );
  }

  // The three biggest FD-driven boosts/docks, with how they actually finished.
  const ranked = [...pool].sort((a, b) => b.fdDeltaPts - a.fdDeltaPts);
  const show = (x) => `${(nameOf.get(x.id) || x.id).padEnd(20)} own ${f3(x.own24Rate)} vs pos ${f3(posRate)} · FD ${x.fdDeltaPts >= 0 ? "+" : ""}${f2(x.fdDeltaPts)}pt · ECR#${x.ecr} Kerf#${x.kerfRank} Actual#${x.act}`;
  console.log(`    biggest boosts: ` + ranked.slice(0, 3).map(show).join("\n                    "));
  console.log(`    biggest docks:  ` + ranked.slice(-3).reverse().map(show).join("\n                    "));
}

db.close();
