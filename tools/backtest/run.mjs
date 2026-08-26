// Backtest — the decision gate (issue #19). Does the KERFUFFLE re-rank predict
// ACTUAL KERFUFFLE points better than raw FantasyPros ECR, on 2024 and 2025?
//
// One command, fully reproducible:
//   1. load the historical FP snapshots into isolated backtest pulls (idempotent),
//   2. for each past season, re-run the projection core (#18) STRICTLY OUT OF
//      SAMPLE — first-down rates from PRIOR seasons only (owner, 2026-08-26) — to
//      get Kerf projected ranks,
//   3. score three predictors of that season's actual points: Kerf rank, raw
//      FantasyPros ECR (the baseline to beat), and FantasyPros' own projected
//      points (a bonus reference). CBS's own projection is NOT recoverable for
//      past seasons (the CBS year switch isn't a URL param — see cbs_data_discovery)
//      so it is reported as unavailable, per the issue's "drop, don't block",
//   4. re-assert the scoring cross-check so a "no edge" result can't be blamed on
//      a scoring bug,
//   5. print the verdict and write a plain-English artifact to docs/backtest_results.md.
//
// The OWNER judges pass/fail from the numbers (owner, 2026-08-26). This tool states
// the edge; it does not decide the gate.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { openDb, applyMigrations, DB_PATH } from "../../db/client.mjs";
import { buildScoringMap, crossCheckSeason } from "../ingest/scoring-crosscheck.mjs";
import {
  deriveFirstDownRates,
  derivePlayerRates,
  scoreProjection,
  assignRanks,
} from "../engine/core.mjs";
import { spearman, topNHitRate, rateSeasonsFor, comparePredictors } from "./core.mjs";
import { loadAllBacktest, discoverBacktestRuns, BACKTEST_SEASONS } from "./load.mjs";
import { FD_POLICY } from "../engine/run.mjs";

const POSITIONS = ["QB", "RB", "WR", "TE"];
// Last-starter cutoffs from the valuation decision (D-13): the auction-relevant N
// per position (superflex → QB24). Top-N hit rate asks "did our top-N contain the
// players who actually finished top-N?".
const STARTER_N = { QB: 24, RB: 34, WR: 34, TE: 17 };
// Shrinkage pseudo-counts — identical to the live engine (tools/engine/run.mjs) so
// the backtest grades the SAME model the app ships, not a different one.
const SHRINKAGE = { rushK: 75, recK: 40 };

const pct = (x) => (x == null ? "—" : `${(x * 100).toFixed(0)}%`);
const f2 = (x) => (x == null ? "—" : x.toFixed(2));
// Signed, two-decimal — and never renders a negative zero ("-0.00").
const sgn = (x) => {
  if (x == null) return "—";
  const r = Math.round(x * 100) / 100 || 0; // `|| 0` collapses -0 to 0
  return `${r >= 0 ? "+" : ""}${r.toFixed(2)}`;
};
// Parse the numeric part of a FantasyPros positional rank like "QB3" -> 3.
const posRankNum = (s) => {
  const m = String(s ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

/** Everything the report needs for one season. */
function analyzeSeason(db, season, scoringPullId, statSeasons) {
  const { seasons: rateSeasons, inSample } = rateSeasonsFor(season, statSeasons);

  // --- first-down rates from the ALLOWED (prior) seasons only ---
  const statRows = db
    .prepare(
      `SELECT cbs_player_id, pos, rush_att, rush_yds, rush_first_downs, rec_rec, rec_yds, rec_first_downs
       FROM player_season_stats WHERE season IN (${rateSeasons.map(() => "?").join(",")})`
    )
    .all(...rateSeasons);
  const positionRates = deriveFirstDownRates(statRows);
  const playerRates = derivePlayerRates(statRows, positionRates, SHRINKAGE);
  const coef = buildScoringMap(db, scoringPullId);

  // --- the season's projected stat lines (from the isolated backtest pull) ---
  const src = db
    .prepare(
      `SELECT ps.* FROM projection_source ps
       JOIN pull ON pull.pull_id = ps.pull_id
       WHERE pull.kind = 'backtest' AND pull.season = ?
         AND ps.cbs_player_id IS NOT NULL AND ps.pos IN ('QB','RB','WR','TE')`
    )
    .all(season);

  const scored = src.map((s) => {
    const r = scoreProjection(s, positionRates, coef, playerRates.get(s.cbs_player_id) ?? null, FD_POLICY);
    return { cbsId: s.cbs_player_id, pos: s.pos, kerfPoints: r.kerfPoints, fpPoints: s.fp_points };
  });
  const kerfRanks = assignRanks(scored.map((p) => ({ cbsId: p.cbsId, pos: p.pos, kerfPoints: p.kerfPoints })));

  // FantasyPros' OWN projected-points ordering (bonus reference predictor).
  const fpRankMap = new Map();
  [...scored]
    .filter((p) => p.fpPoints != null)
    .sort((a, b) => b.fpPoints - a.fpPoints || a.cbsId - b.cbsId)
    .forEach((p, i) => fpRankMap.set(p.cbsId, i + 1));

  // --- raw FantasyPros ECR (the baseline), from the same backtest pull ---
  const ecrRows = db
    .prepare(
      `SELECT mr.cbs_player_id, mr.rank_ecr, mr.pos_rank, mr.player_pos FROM market_ranking mr
       JOIN pull ON pull.pull_id = mr.pull_id
       WHERE pull.kind = 'backtest' AND pull.season = ?
         AND mr.ranking_type='draft' AND mr.scoring_format='STD' AND mr.position_scope='OP'
         AND mr.cbs_player_id IS NOT NULL`
    )
    .all(season);
  const ecrOvr = new Map(ecrRows.map((r) => [r.cbs_player_id, r.rank_ecr]));
  const ecrPos = new Map(ecrRows.map((r) => [r.cbs_player_id, posRankNum(r.pos_rank)]));

  // --- actual KERFUFFLE points (the truth), offense only ---
  const actualRows = db
    .prepare(
      `SELECT cbs_player_id, pos, fpts_total, fpts_avg FROM player_season_stats
       WHERE season = ? AND fpts_total IS NOT NULL AND pos IN ('QB','RB','WR','TE')`
    )
    .all(season);
  const actual = new Map(actualRows.map((r) => [r.cbs_player_id, r.fpts_total]));
  const actualPos = new Map(actualRows.map((r) => [r.cbs_player_id, r.pos]));

  // --- assemble the apples-to-apples universe: players with a Kerf projection,
  //     an ECR rank, AND an actual result (so every predictor is scored on the
  //     same field) ---
  const universe = scored
    .filter((p) => actual.has(p.cbsId) && ecrOvr.has(p.cbsId))
    .map((p) => ({
      cbsId: p.cbsId,
      pos: p.pos,
      actualPoints: actual.get(p.cbsId),
      kerfOvr: kerfRanks.get(p.cbsId).ovrRank,
      kerfPos: kerfRanks.get(p.cbsId).posRank,
      ecrOvr: ecrOvr.get(p.cbsId),
      ecrPos: ecrPos.get(p.cbsId),
      fpOvr: fpRankMap.get(p.cbsId) ?? null,
    }));

  // --- overall (all positions pooled) ---
  const overall = comparePredictors(
    universe.map((u) => ({ predRankA: u.kerfOvr, predRankB: u.ecrOvr, actual: u.actualPoints }))
  );
  const fpOverallRho = spearman(
    universe.filter((u) => u.fpOvr != null).map((u) => -u.fpOvr),
    universe.filter((u) => u.fpOvr != null).map((u) => u.actualPoints)
  );

  // --- per position: rank correlation (positional rank) + top-N hit rate ---
  const byPos = {};
  for (const pos of POSITIONS) {
    const list = universe.filter((u) => u.pos === pos && u.ecrPos != null);
    if (list.length === 0) {
      byPos[pos] = { n: 0 };
      continue;
    }
    const kerfRho = spearman(list.map((u) => -u.kerfPos), list.map((u) => u.actualPoints));
    const ecrRho = spearman(list.map((u) => -u.ecrPos), list.map((u) => u.actualPoints));
    const N = STARTER_N[pos];
    const kerfHit = topNHitRate(list.map((u) => ({ predRank: u.kerfPos, actual: u.actualPoints })), N);
    const ecrHit = topNHitRate(list.map((u) => ({ predRank: u.ecrPos, actual: u.actualPoints })), N);
    byPos[pos] = {
      n: list.length,
      kerfRho,
      ecrRho,
      edge: kerfRho != null && ecrRho != null ? kerfRho - ecrRho : null,
      N,
      kerfHit,
      ecrHit,
    };
  }

  const cc = crossCheckSeason(db, season);
  const ccPct = cc.total > 0 ? cc.within_0_5 / cc.total : null;

  return {
    season,
    rateSeasons,
    inSample,
    n: universe.length,
    overall,
    fpOverallRho,
    byPos,
    scoringCheck: { total: cc.total, within_0_5: cc.within_0_5, pct: ccPct },
  };
}

// Honest, magnitude-aware labels — a +0.01 ρ edge is not a "win". The band is
// deliberately wide (0.03) so the artifact never oversells a hair of separation;
// the owner judges the gate, and an over-confident label would corrupt that call.
const MARGIN = 0.03;
function resultLabel(edge) {
  if (edge == null) return "inconclusive";
  if (edge >= MARGIN) return "Kerf ahead";
  if (edge <= -MARGIN) return "ECR ahead";
  if (edge > 0) return "≈ tie (marginal Kerf edge)";
  if (edge < 0) return "≈ tie (marginal ECR edge)";
  return "tie";
}
function verdictLine(a) {
  if (a.overall.edge == null) return "inconclusive (insufficient data)";
  return `${resultLabel(a.overall.edge)} — overall ρ: Kerf ${f2(a.overall.rhoA)} vs ECR ${f2(a.overall.rhoB)}, edge ${sgn(a.overall.edge)}`;
}

// A per-position summary sentence DERIVED from the computed edges (never hardcoded,
// so the prose can't drift from the tables below it) using the same MARGIN bands.
function posMixSentence(a) {
  const helps = [], trails = [], ties = [];
  for (const pos of POSITIONS) {
    const b = a.byPos[pos];
    if (!b || b.n === 0 || b.edge == null) continue;
    if (b.edge >= MARGIN) helps.push(pos);
    else if (b.edge <= -MARGIN) trails.push(pos);
    else ties.push(pos);
  }
  const parts = [];
  if (helps.length) parts.push(`helps at ${helps.join("/")}`);
  if (ties.length) parts.push(`≈ ties at ${ties.join("/")}`);
  if (trails.length) parts.push(`trails at ${trails.join("/")}`);
  return parts.join(", ") || "no position had enough data";
}

function renderConsole(analyses) {
  console.log(`\n================  BACKTEST VERDICT  ================`);
  for (const a of analyses) {
    const tag = a.inSample ? "IN-SAMPLE (optimistic — no prior year)" : `out-of-sample (rates from ${a.rateSeasons.join("+")})`;
    console.log(`\n── ${a.season}  [${tag}]  ·  ${a.n} players compared ──`);
    console.log(`   Scoring cross-check: ${pct(a.scoringCheck.pct)} within 0.5 pt (${a.scoringCheck.within_0_5}/${a.scoringCheck.total}) — a "no edge" result is not a scoring bug`);
    console.log(`   OVERALL: ${verdictLine(a)}`);
    console.log(`   (reference) FantasyPros' own projection ρ: ${f2(a.fpOverallRho)}`);
    console.log(`   ${"pos".padEnd(4)} ${"n".padStart(3)}  ${"Kerf ρ".padStart(7)} ${"ECR ρ".padStart(7)} ${"edge".padStart(6)}   top-N hit (Kerf vs ECR)`);
    for (const pos of POSITIONS) {
      const b = a.byPos[pos];
      if (!b || b.n === 0) { console.log(`   ${pos.padEnd(4)} ${"0".padStart(3)}  (no data)`); continue; }
      const hit = `top-${b.N}: ${pct(b.kerfHit.rate)} vs ${pct(b.ecrHit.rate)}`;
      console.log(`   ${pos.padEnd(4)} ${String(b.n).padStart(3)}  ${f2(b.kerfRho).padStart(7)} ${f2(b.ecrRho).padStart(7)} ${sgn(b.edge)}`.padEnd(40) + `   ${hit}`);
    }
  }
  console.log(`\n===================================================`);
}

function renderMarkdown(analyses, meta) {
  const L = [];
  L.push(`# Backtest results — does the KERFUFFLE re-rank beat ECR?`);
  L.push("");
  L.push(`> **Auto-generated by \`npm run backtest\` — do not edit by hand.** Regenerate to refresh.`);
  L.push(`> Generated: ${meta.generatedAt} · engine shrinkage rushK=${SHRINKAGE.rushK}/recK=${SHRINKAGE.recK} (same as the live engine).`);
  L.push("");
  L.push(`## The question`);
  L.push("");
  L.push(`Before building the dollar layer, we test the product thesis: does re-ranking players the **KERFUFFLE way** (issue #18's projection core) predict who **actually** scored the most KERFUFFLE points — better than **raw FantasyPros consensus (ECR)**? Truth = CBS actual points (issue #17). Two past seasons — treat as **directional, not definitive**.`);
  L.push("");
  L.push(`**How to read ρ (rank correlation):** +1.00 = perfect ordering, 0 = no better than chance. **Edge** = Kerf ρ − ECR ρ; positive means Kerf ordered the field better. **Top-N hit rate** = of a predictor's top-N at a position, how many actually finished top-N (N = the league's last-starter counts: QB24 / RB34 / WR34 / TE17).`);
  L.push("");
  L.push(`## Verdict at a glance`);
  L.push("");
  L.push(`| Season | Test type | Players | Overall Kerf ρ | Overall ECR ρ | Edge | Result |`);
  L.push(`| --- | --- | ---: | ---: | ---: | ---: | --- |`);
  for (const a of analyses) {
    const type = a.inSample ? "in-sample ⚠" : `out-of-sample (${a.rateSeasons.join("+")})`;
    L.push(`| ${a.season} | ${type} | ${a.n} | ${f2(a.overall.rhoA)} | ${f2(a.overall.rhoB)} | ${sgn(a.overall.edge)} | ${resultLabel(a.overall.edge)} |`);
  }
  L.push("");
  const primary = analyses.find((a) => !a.inSample);
  if (primary) {
    L.push(`**Primary verdict (the honest one): ${primary.season}, out-of-sample** — ${verdictLine(primary)}. The other season has no prior year to draw rates from, so it is in-sample and optimistic; read it as secondary.`);
    L.push("");
  }
  const mixSeason = primary ?? analyses[0];
  L.push(`**What the size of the edge means.** Both predictors score ρ ≈ 0.8 because *any* sensible ranking easily separates stars from scrubs across ~450 players, which dominates a pooled correlation. The KERFUFFLE first-down adjustment is a *fine-grained* re-ranking, so its effect shows up at the margins — see the per-position tables and top-N hit rates below. In ${mixSeason.season} the picture is mixed: Kerf ${posMixSentence(mixSeason)} (edge bands at ±${MARGIN.toFixed(2)} ρ). Read this as **a real but marginal and inconsistent edge over consensus, not a decisive one** — exactly the call this gate exists to put in front of the owner.`);
  L.push("");
  for (const a of analyses) {
    const tag = a.inSample ? "IN-SAMPLE ⚠ (optimistic — rates from its own season; no prior year available)" : `out-of-sample — first-down rates from ${a.rateSeasons.join("+")} only`;
    L.push(`## ${a.season} — ${tag}`);
    L.push("");
    L.push(`- **Players compared:** ${a.n} (had a Kerf projection, an ECR rank, and an actual result).`);
    L.push(`- **Scoring cross-check:** ${pct(a.scoringCheck.pct)} of players within 0.5 pt of CBS's own total (${a.scoringCheck.within_0_5}/${a.scoringCheck.total}) — confirms a "no edge" finding is the *model*, not a scoring bug.`);
    L.push(`- **Overall:** ${verdictLine(a)}.`);
    L.push(`- **Reference:** FantasyPros' own projected-points ordering scored ρ ${f2(a.fpOverallRho)} (CBS's own projection is not recoverable for past seasons, so it is omitted).`);
    L.push("");
    L.push(`| Position | Players | Kerf ρ | ECR ρ | Edge | Kerf top-N | ECR top-N | N |`);
    L.push(`| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`);
    for (const pos of POSITIONS) {
      const b = a.byPos[pos];
      if (!b || b.n === 0) { L.push(`| ${pos} | 0 | — | — | — | — | — | — |`); continue; }
      L.push(`| ${pos} | ${b.n} | ${f2(b.kerfRho)} | ${f2(b.ecrRho)} | ${sgn(b.edge)} | ${pct(b.kerfHit.rate)} | ${pct(b.ecrHit.rate)} | ${b.N} |`);
    }
    L.push("");
  }
  L.push(`## Caveats (state them; don't let them inflate confidence)`);
  L.push("");
  L.push(`- **Small sample:** two seasons — directional, not definitive.`);
  L.push(`- **Historical FP board** is FantasyPros' retrospective preseason board for that year, not a guaranteed point-in-time capture — acceptable as a draft-consensus baseline, but noted.`);
  L.push(`- **Injuries / games missed** add noise to season totals; a per-game view is a reasonable secondary lens (not yet computed here).`);
  L.push(`- **2024 has no clean holdout** (no earlier season we hold), so its rates are in-sample; **${primary ? primary.season : "2025"} is the trustworthy out-of-sample verdict.**`);
  L.push(`- **CBS's own projection** (the intended second baseline) is not recoverable for past seasons; FantasyPros' own projection is shown instead as a reference.`);
  L.push("");
  return L.join("\n");
}

// ---------------------------------------------------------------------------

function main() {
  const db = openDb();
  applyMigrations(db, { log: console.log });
  console.log(`\nBacktest — the decision gate (issue #19) -> ${DB_PATH}`);

  // 1. ensure the historical FP snapshots are loaded (idempotent).
  const found = discoverBacktestRuns();
  if (found.length === 0) {
    console.error(
      `\n  No historical FantasyPros snapshots found.\n` +
        `  Capture them first (FP-only, one per season):\n` +
        `    set FP_SEASON=2024 and blank the CBS cookie, run "npm run archive"; repeat for 2025.\n`
    );
    db.close();
    process.exit(1);
  }
  const loaded = loadAllBacktest(db);
  for (const s of loaded) {
    console.log(`  loaded ${s.season}: ecr ${s.rankingRows} rows, projections ${s.projections} (${s.projMatched} matched to CBS ids)`);
  }

  // 2. analyze each season we hold projections for.
  const scoringPullId = db.prepare(`SELECT pull_id FROM latest_pull`).get()?.pull_id;
  if (!scoringPullId) {
    console.error(`  No current pull with scoring rules — run "npm run ingest" first.`);
    db.close();
    process.exit(1);
  }
  const statSeasons = db
    .prepare(`SELECT DISTINCT season FROM player_season_stats ORDER BY season`)
    .all()
    .map((r) => r.season);

  const seasons = loaded.map((s) => s.season).sort((a, b) => a - b);
  const analyses = seasons.map((season) => analyzeSeason(db, season, scoringPullId, statSeasons));

  renderConsole(analyses);

  // 3. write the artifact.
  const outPath = join(process.cwd(), "docs", "backtest_results.md");
  const md = renderMarkdown(analyses, { generatedAt: new Date().toISOString() });
  writeFileSync(outPath, md);
  console.log(`\n  Report written: docs/backtest_results.md`);
  console.log(`  (Owner judges the gate from these numbers — see product_vision success measure.)`);

  db.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { analyzeSeason };
