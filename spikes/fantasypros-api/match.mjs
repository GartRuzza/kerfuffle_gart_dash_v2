// FantasyPros <-> CBS join experiment (GitHub issue #7, roadmap #3)
//
// THE UGLIEST PART. The valuation engine needs, for each CBS player, that player's
// FantasyPros ECR/tier. That requires lining up two independent player universes.
// This script measures how well we can:
//   1. join on a shared ID (does FantasyPros expose an id that maps to CBS's?), and
//   2. fall back to normalized name (+ position/team) matching,
// and reports a real match RATE plus the players that DON'T match and why.
//
// CBS side: parsed from the CBS spike's already-saved, read-only output
//   (spikes/cbs-api/output/*.html) — real KERFUFFLE players with real CBS ids.
// FantasyPros side: parsed from this spike's output (run pull.mjs first).
//
// RUN (from project root):  node spikes/fantasypros-api/match.mjs
// Needs Node 18+. No npm install. Read-only: it only reads local files.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FP_OUT = join(HERE, "output");
const CBS_OUT = join(HERE, "..", "cbs-api", "output");

// --- normalization: the heart of name matching ---
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
function normName(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/&#\d+;/g, " ")       // stray HTML entities
    .replace(/[.,'’]/g, "")         // punctuation
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w && !SUFFIXES.has(w))
    .join(" ")
    .trim();
}
const TEAM_FIX = { jac: "jax", wsh: "was", was: "was", la: "lar", stl: "lar", oak: "lv", sd: "lac" };
const normTeam = (t) => { const x = String(t || "").toLowerCase(); return TEAM_FIX[x] || x; };
const normPos = (p) => String(p || "").toUpperCase().replace("DST", "DEF").replace("D/ST", "DEF");

// --- CBS side: parse players (id, name, pos, team) from the saved roster HTML ---
function loadCbsPlayers() {
  if (!existsSync(CBS_OUT)) return [];
  const files = readdirSync(CBS_OUT).filter((f) => f.endsWith(".html"));
  const byId = new Map();
  // e.g. playerpage/26695775'>Caleb Williams</a> <span class='playerPositionAndTeam'>QB &#149; CHI</span>
  const re = /playerpage\/(\d+)['"]?>([^<]+)<\/a>\s*<span class=['"]playerPositionAndTeam['"]>([A-Za-z/]+)\s*(?:&#149;|&bull;|·|•)\s*([A-Za-z]+)/g;
  for (const f of files) {
    const html = readFileSync(join(CBS_OUT, f), "utf8");
    let m;
    while ((m = re.exec(html))) {
      const [, id, name, pos, team] = m;
      if (!byId.has(id)) byId.set(id, { cbsId: id, name: name.trim(), pos: normPos(pos), team: normTeam(team) });
    }
  }
  return [...byId.values()];
}

// --- FantasyPros side: pull the player array out of whatever pull.mjs saved ---
const ID_HINTS = ["player_id", "fantasypros_id", "fpid", "mfl_id", "sportsdata_id",
  "sportradar_id", "gsis_id", "pfr_id", "sleeper_id", "yahoo_id", "cbs_id", "stats_id", "rotowire_id", "id"];
function firstArray(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    for (const k of ["players", "rankings", "data", "items", "results"]) if (Array.isArray(json[k])) return json[k];
    for (const v of Object.values(json)) if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
  }
  return [];
}
function pick(obj, names) {
  for (const n of names) for (const k of Object.keys(obj)) if (k.toLowerCase() === n) return obj[k];
  for (const n of names) for (const k of Object.keys(obj)) if (k.toLowerCase().includes(n)) return obj[k];
  return undefined;
}
function loadFpPlayers() {
  if (!existsSync(FP_OUT)) return { players: [], idFields: [], source: null };
  // Prefer a rankings file (has ECR + ids); fall back to a players file.
  const files = readdirSync(FP_OUT).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const preferred = files.find((f) => f.startsWith("ecr-draft-ppr-all")) ||
    files.find((f) => f.startsWith("ecr-")) || files.find((f) => f.startsWith("players")) || files[0];
  if (!preferred) return { players: [], idFields: [], source: null };
  const json = JSON.parse(readFileSync(join(FP_OUT, preferred), "utf8"));
  const rows = firstArray(json);
  const idFieldSet = new Set();
  const players = rows.map((r) => {
    const ids = {};
    for (const k of Object.keys(r)) if (ID_HINTS.some((h) => k.toLowerCase() === h || k.toLowerCase().includes(h))) { ids[k] = r[k]; idFieldSet.add(k); }
    return {
      name: pick(r, ["player_name", "name", "fantasy_player_name"]) ?? "",
      pos: normPos(pick(r, ["player_position_id", "position_id", "position", "pos"])),
      team: normTeam(pick(r, ["player_team_id", "team_id", "team"])),
      // FantasyPros publishes the CBS id directly — this is the join key.
      cbsId: (r.cbs_player_id ?? r.cbs_id ?? "") ? String(r.cbs_player_id ?? r.cbs_id) : "",
      ids,
    };
  }).filter((p) => p.name);
  return { players, idFields: [...idFieldSet], source: preferred };
}

// --- run ---
const cbs = loadCbsPlayers();
const { players: fp, idFields, source } = loadFpPlayers();

console.log(`\nCBS<->FantasyPros join experiment`);
console.log(`CBS players parsed:  ${cbs.length}  (from spikes/cbs-api/output/*.html)`);
console.log(`FP players parsed:   ${fp.length}   (from spikes/fantasypros-api/output/${source || "—"})`);

if (!cbs.length) {
  console.error("\n✗ No CBS players found. Run the CBS spike first so its output/*.html exists.\n");
  process.exit(1);
}
if (!fp.length) {
  console.error("\n✗ No FantasyPros players found. Run `node spikes/fantasypros-api/pull.mjs` first.\n");
  process.exit(1);
}

// Build CBS lookups.
const cbsById = new Map(cbs.map((p) => [p.cbsId, p]));
const cbsIdSet = new Set(cbs.map((p) => p.cbsId));
const cbsByName = new Map();
for (const p of cbs) {
  const key = normName(p.name);
  if (!cbsByName.has(key)) cbsByName.set(key, []);
  cbsByName.get(key).push(p);
}

// 1) THE JOIN: FantasyPros publishes cbs_player_id. Match FP players directly to
//    our CBS players by that id — no name guessing. Of the FP players that carry a
//    cbs_player_id AND whose id is in our KERFUFFLE set, list the confirmed pairs.
const fpWithCbsId = fp.filter((p) => p.cbsId);
const directPairs = [];
for (const p of fpWithCbsId) {
  if (cbsIdSet.has(p.cbsId)) directPairs.push({ fpName: p.name, cbsName: cbsById.get(p.cbsId)?.name, cbsId: p.cbsId });
}
const directIdHits = directPairs.length;

// 2) Name (+pos/team) matching, measured over the CBS universe (each CBS player: do we find its FP ECR?).
const fpByName = new Map();
for (const p of fp) {
  const key = normName(p.name);
  if (!fpByName.has(key)) fpByName.set(key, []);
  fpByName.get(key).push(p);
}
let matched = 0, ambiguous = 0;
const unmatched = [];
const ambiguousList = [];
for (const c of cbs) {
  const cands = fpByName.get(normName(c.name)) || [];
  if (cands.length === 1) { matched++; continue; }
  if (cands.length > 1) {
    const byPos = cands.filter((x) => x.pos === c.pos);
    if (byPos.length === 1) { matched++; continue; }
    const byPosTeam = byPos.filter((x) => x.team === c.team);
    if (byPosTeam.length === 1) { matched++; continue; }
    ambiguous++; ambiguousList.push({ name: c.name, pos: c.pos, team: c.team, candidates: cands.length });
    continue;
  }
  unmatched.push({ name: c.name, pos: c.pos, team: c.team });
}

const rate = ((matched / cbs.length) * 100).toFixed(1);
const fpCbsIdCoverage = ((fpWithCbsId.length / fp.length) * 100).toFixed(0);
console.log(`\n--- THE JOIN: direct cbs_player_id ---`);
console.log(`FP id fields present: ${idFields.length ? idFields.join(", ") : "(none found)"}`);
console.log(`FP players carrying a cbs_player_id: ${fpWithCbsId.length}/${fp.length} (${fpCbsIdCoverage}%)`);
console.log(`Of those, confirmed present in our KERFUFFLE set: ${directIdHits}`);
for (const d of directPairs.slice(0, 15)) {
  const flag = normName(d.fpName) === normName(d.cbsName) ? "✓" : "≠ NAME";
  console.log(`  ${flag}  cbs ${d.cbsId}: FP "${d.fpName}"  =  CBS "${d.cbsName}"`);
}
console.log(`\n--- Fallback name (+pos/team) match, over ${cbs.length} CBS players ---`);
console.log(`(Coverage here is capped by the free tier only returning ${fp.length} FP players.)`);
console.log(`matched:    ${matched}  (${rate}%)`);
console.log(`ambiguous:  ${ambiguous}  (same normalized name, couldn't disambiguate)`);
console.log(`unmatched:  ${unmatched.length}  (no FP ranking — often deep bench / non-fantasy-relevant)`);

const showUnmatched = unmatched.slice(0, 25);
if (showUnmatched.length) {
  console.log(`\nUnmatched CBS players (first ${showUnmatched.length}):`);
  for (const u of showUnmatched) console.log(`  · ${u.name} (${u.pos} ${u.team})`);
}
if (ambiguousList.length) {
  console.log(`\nAmbiguous (first ${Math.min(10, ambiguousList.length)}):`);
  for (const a of ambiguousList.slice(0, 10)) console.log(`  ? ${a.name} (${a.pos} ${a.team}) — ${a.candidates} FP candidates`);
}

writeFileSync(join(FP_OUT, "_match_report.json"), JSON.stringify({
  cbsPlayers: cbs.length, fpPlayers: fp.length, fpSource: source,
  fpIdFields: idFields,
  fpWithCbsId: fpWithCbsId.length, directIdHits, directPairs,
  matched, matchRatePct: Number(rate), ambiguous, unmatched: unmatched.length,
  unmatchedList: unmatched, ambiguousList,
}, null, 2));
console.log(`\nFull report → spikes/fantasypros-api/output/_match_report.json (git-ignored).\n`);
