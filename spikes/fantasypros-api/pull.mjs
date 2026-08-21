// FantasyPros data spike — read-only API probe (GitHub issue #7, roadmap #3)
//
// WHAT THIS ANSWERS: FantasyPros now has an official JSON REST API. This script
// probes it read-only with a FREE self-serve API key to discover (a) what the
// free tier actually returns vs. what's gated behind a paid HOF/commercial plan
// — especially DYNASTY ECR and TIERS — and (b) how players are identified, which
// feeds the CBS<->FantasyPros join test in match.mjs.
//
// It ONLY reads (HTTP GET). It never writes anything to FantasyPros.
//
// RUN (from project root):  node spikes/fantasypros-api/pull.mjs
// Needs Node 18+. No npm install. Auth comes from spikes/fantasypros-api/.env (FP_API_KEY).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "output");

function loadEnv() {
  const cfg = {};
  for (const file of [".env", ".env.local"]) {
    const p = join(HERE, file);
    if (!existsSync(p)) continue;
    for (const raw of readFileSync(p, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      cfg[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  return cfg;
}

const env = loadEnv();
const API_KEY = env.FP_API_KEY || "";
const API_HOST = env.FP_API_HOST || "api.fantasypros.com";
const BASE_PATH = env.FP_BASE_PATH || "/public/v2/json";
const SPORT = env.FP_SPORT || "nfl";
const SEASON = env.FP_SEASON || "2026";

if (!API_KEY) {
  console.error("\n✗ No FP_API_KEY in spikes/fantasypros-api/.env — see README.md.\n");
  process.exit(1);
}

// The probes. We don't know FantasyPros' exact parameter names for certain, so we
// try a spread of reasonable combinations and save whatever comes back. Non-200
// responses are saved too — their error messages tell us the real param names and
// which data is gated behind a paid tier.
const PROBES = [
  // --- Expert Consensus Rankings: the core of what Gart Dash needs ---
  { name: "ecr-draft-ppr-all",   path: `/${SPORT}/${SEASON}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "ALL" } },
  { name: "ecr-draft-half-all",  path: `/${SPORT}/${SEASON}/consensus-rankings`, q: { type: "draft",   scoring: "HALF", position: "ALL" } },
  { name: "ecr-draft-std-all",   path: `/${SPORT}/${SEASON}/consensus-rankings`, q: { type: "draft",   scoring: "STD",  position: "ALL" } },
  { name: "ecr-draft-ppr-qb",    path: `/${SPORT}/${SEASON}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "QB" } },
  { name: "ecr-draft-ppr-rb",    path: `/${SPORT}/${SEASON}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "RB" } },
  { name: "ecr-draft-ppr-op",    path: `/${SPORT}/${SEASON}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "OP" } }, // OP = superflex/offensive player
  // --- Dynasty ECR: the one most likely to be gated behind a paid tier ---
  { name: "ecr-dynasty-ppr-all", path: `/${SPORT}/${SEASON}/consensus-rankings`, q: { type: "dynasty", scoring: "PPR",  position: "ALL" } },
  { name: "ecr-dynasty-ppr-qb",  path: `/${SPORT}/${SEASON}/consensus-rankings`, q: { type: "dynasty", scoring: "PPR",  position: "QB" } },
  // --- Rest-of-season + weekly, for completeness ---
  { name: "ecr-ros-ppr-all",     path: `/${SPORT}/${SEASON}/consensus-rankings`, q: { type: "ros",     scoring: "PPR",  position: "ALL" } },
  { name: "ecr-weekly-ppr-all",  path: `/${SPORT}/${SEASON}/consensus-rankings`, q: { type: "weekly",  scoring: "PPR",  position: "ALL", week: "1" } },
  // --- Projections ---
  { name: "projections-all",     path: `/${SPORT}/${SEASON}/projections`,        q: { position: "ALL", week: "draft" } },
  { name: "projections-qb",      path: `/${SPORT}/${SEASON}/projections`,         q: { position: "QB",  week: "draft" } },
  // --- Player metadata: the raw material for the CBS<->FP join (cross-ref IDs) ---
  { name: "players",             path: `/${SPORT}/players`,                       q: {} },
  // --- ADP (was absent from the rankings payload — probe it directly) ---
  { name: "adp",                 path: `/${SPORT}/${SEASON}/adp`,                 q: { position: "ALL" } },
  // --- News / injuries ---
  { name: "news",                path: `/${SPORT}/news`,                          q: {} },
];

// The free tier rate-limits bursts (429s). Space requests out so a full run is clean.
const REQUEST_DELAY_MS = Number(env.FP_REQUEST_DELAY_MS || 1500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildUrl(probe) {
  const qs = new URLSearchParams(probe.q).toString();
  return `https://${API_HOST}${BASE_PATH}${probe.path}${qs ? `?${qs}` : ""}`;
}

// Look for an array of player-like records anywhere near the top of the JSON.
function findRows(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    for (const key of ["players", "rankings", "data", "items", "results", "projections"]) {
      if (Array.isArray(json[key])) return json[key];
    }
    // one level deeper (e.g. { total: {...}, players: [...] } style wrappers)
    for (const v of Object.values(json)) {
      if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
    }
  }
  return [];
}

// From a sample record, note which fields matter to us.
const ID_HINTS = ["id", "player_id", "fantasypros_id", "fpid", "mfl_id", "sportsdata_id",
  "sportradar_id", "gsis_id", "pfr_id", "sleeper_id", "yahoo_id", "cbs_id", "cbs", "stats_id", "rotowire_id"];
function fieldSignals(rows) {
  const sample = rows.find((r) => r && typeof r === "object") || {};
  const keys = Object.keys(sample);
  const lower = keys.map((k) => k.toLowerCase());
  const has = (needle) => lower.some((k) => k.includes(needle));
  const idKeys = keys.filter((k) => ID_HINTS.some((h) => k.toLowerCase() === h || k.toLowerCase().includes(h)));
  return {
    rows: rows.length,
    hasTier: has("tier"),
    hasEcr: has("ecr") || has("rank_ecr") || has("rank"),
    hasAdp: has("adp"),
    hasProj: has("proj") || has("points") || has("fpts"),
    idKeys, // the cross-reference IDs we can potentially join to CBS on
    sampleKeys: keys.slice(0, 30),
  };
}

async function probe(p) {
  const u = buildUrl(p);
  let res;
  try {
    res = await fetch(u, {
      headers: {
        "x-api-key": API_KEY,
        Accept: "application/json",
        "User-Agent": "gart-dash-spike/1.0 (read-only discovery)",
      },
    });
  } catch (err) {
    return { probe: p.name, url: u, error: String(err?.message || err) };
  }
  const status = res.status;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON (HTML error page, etc.) */ }
  writeFileSync(join(OUT_DIR, `${p.name}.json`), json ? JSON.stringify(json, null, 2) : text);

  if (!json) {
    return { probe: p.name, url: u, status, isJson: false, snippet: text.slice(0, 200) };
  }
  const rows = findRows(json);
  const sig = fieldSignals(rows);
  // surface any error/message the API returned even on a 200-shaped body
  const message = json.error || json.message || json.errors || null;
  return { probe: p.name, url: u, status, isJson: true, topKeys: Object.keys(json).slice(0, 12), message, ...sig };
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`\nFantasyPros API probe — host ${API_HOST}${BASE_PATH} · sport ${SPORT} · season ${SEASON}`);
console.log("All read-only GETs. Auth: x-api-key ✓\n");
console.log("probe".padEnd(22) + "stat  json  rows   tier  ecr  adp  proj  idKeys");
console.log("-".repeat(92));

const results = [];
for (const p of PROBES) {
  const r = await probe(p);
  results.push(r);
  await sleep(REQUEST_DELAY_MS); // avoid the free-tier burst rate limit
  if (r.error) {
    console.log(`${p.name.padEnd(22)}ERROR ${r.error}`);
    continue;
  }
  if (!r.isJson) {
    console.log(`${p.name.padEnd(22)}${String(r.status).padEnd(6)}no    (non-JSON) ${r.snippet?.slice(0, 40) || ""}`);
    continue;
  }
  console.log(
    p.name.padEnd(22) +
      String(r.status).padEnd(6) +
      "yes ".padEnd(6) +
      String(r.rows).padStart(5) +
      "   " +
      (r.hasTier ? "✓" : "·").padEnd(5) +
      (r.hasEcr ? "✓" : "·").padEnd(4) +
      (r.hasAdp ? "✓" : "·").padEnd(4) +
      (r.hasProj ? "✓" : "·").padEnd(5) +
      " " + (r.idKeys?.join(",") || "—")
  );
  if (r.message) console.log(`  ↳ message: ${JSON.stringify(r.message).slice(0, 160)}`);
}

writeFileSync(join(OUT_DIR, "_summary.json"), JSON.stringify(results, null, 2));
console.log(
  "\nLegend: rows=records returned, tier/ecr/adp/proj=whether that field is present," +
    "\nidKeys=cross-reference IDs on each player (the potential CBS join key)." +
    "\nA 401/403 or an error message on the dynasty rows = that data is gated behind a paid tier." +
    "\nRaw JSON saved to spikes/fantasypros-api/output/ (git-ignored).\n"
);
