// Raw snapshot archival — append-only history layer for CBS + FantasyPros (issue #10).
//
// Promotes the throwaway spike pulls (spikes/cbs-api/pull.mjs,
// spikes/fantasypros-api/pull.mjs) into one repeatable tool. Each run writes every
// fetched response VERBATIM into data/raw/{run-id}/{source}/{page}.{html|json},
// plus a per-run manifest.json listing every response (source, URL, fetched_at,
// HTTP status). APPEND-ONLY: a fresh dated folder every run — nothing is ever
// overwritten. Read-only (HTTP GET only); it never writes to CBS or FantasyPros.
//
// Why this exists (issue #10): two problems are still unsolved — programmatic
// historical-CBS-season retrieval and FAB winning-bid amounts — so any week we
// don't snapshot is unrecoverable history for the price curve and backtest. A
// wrong parser later is fixed by re-parsing this archive, never by re-fetching.
//
// OUT OF SCOPE (deliberately): parsing/normalization, any database, scheduling.
// Historical seasons are NOT captured — the CBS year switch isn't a URL param
// (see docs/cbs_data_discovery.md); this archives the CURRENT season only.
//
// RUN (from project root):  npm run archive   (or: node tools/archive/capture.mjs)
// Node 18+ (built-in fetch). No npm install. Credentials come from the spike .env
// files: spikes/cbs-api/.env (CBS_COOKIE) and spikes/fantasypros-api/.env (FP_API_KEY).

import { writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { RAW_ROOT, CBS_ENV_DIR, FP_ENV_DIR, loadEnv, makeRunId, ensureDir } from "./shared.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- CBS: the spike's page set, roster report expanded to all 12 teams ----------

function cbsPages() {
  const pages = [
    { name: "teams-myteam", path: "/teams" },
    { name: "teams-roster-grid", path: "/teams/roster-grid" },
  ];
  // The spike pulled only teams 1-2; issue #10 archives ALL 12 team rosters.
  for (let t = 1; t <= 12; t++) {
    pages.push({ name: `roster-report-t${t}`, path: `/teams/roster-report/${t}/1` });
  }
  pages.push(
    { name: "players-available", path: "/players" },
    { name: "players-rankings", path: "/players/rankings" },
    { name: "transactions", path: "/transactions" },
    { name: "transactions-trade", path: "/transactions/trade" },
    { name: "standings-overall", path: "/standings/overall" },
    { name: "rules", path: "/rules" },
    { name: "history", path: "/history" },
    { name: "draft-results", path: "/draft/results" },
    { name: "scoring-live", path: "/scoring/live" },
  );
  return pages;
}

async function captureCbs(runDir, responses) {
  const env = loadEnv(CBS_ENV_DIR);
  const cookie = env.CBS_COOKIE || "";
  const host = env.CBS_LEAGUE_HOST || "kerfuffle.football.cbssports.com";
  ensureDir(join(runDir, "cbs"));

  if (!cookie) {
    console.log("  (skipped — no CBS_COOKIE in spikes/cbs-api/.env)");
    responses.push({
      source: "cbs", page: null, url: null, file: null,
      fetched_at: new Date().toISOString(), status: null, error: "no CBS_COOKIE",
    });
    return { attempted: false, ok: 0, failed: 0 };
  }

  let ok = 0, failed = 0, loginRedirects = 0;
  for (const page of cbsPages()) {
    const url = `https://${host}${page.path}`;
    const fetched_at = new Date().toISOString();
    try {
      const res = await fetch(url, {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/json,*/*",
          Cookie: cookie,
        },
      });
      const body = await res.text();
      const location = res.headers.get("location") || "";
      const loginRedirect =
        /\/login/.test(location) || /Please sign in|user_login/i.test(body.slice(0, 4000));
      const file = `cbs/${page.name}.html`;
      writeFileSync(join(runDir, file), body);
      responses.push({
        source: "cbs", page: page.name, url, file, fetched_at,
        status: res.status, bytes: body.length, login_redirect: loginRedirect,
      });
      if (loginRedirect) loginRedirects++;
      if (res.status >= 200 && res.status < 400 && !loginRedirect) ok++; else failed++;
      console.log(
        `  cbs/${page.name.padEnd(20)} ${String(res.status).padEnd(4)} ${String(body.length).padStart(8)} bytes` +
          (loginRedirect ? "  ⚠ LOGIN REDIRECT (cookie expired?)" : "")
      );
    } catch (err) {
      failed++;
      responses.push({
        source: "cbs", page: page.name, url, file: null, fetched_at,
        status: null, error: String(err?.message || err),
      });
      console.log(`  cbs/${page.name.padEnd(20)} ERROR ${err?.message || err}`);
    }
  }
  if (loginRedirects > 0) {
    console.log(
      `\n  ⚠ ${loginRedirects} CBS page(s) redirected to login — your cookie is likely expired.` +
        `\n    Refresh it in spikes/cbs-api/.env, then re-run.  (Check first: npm run archive:check-cookie)`
    );
  }
  return { attempted: true, host, ok, failed, login_redirects: loginRedirects };
}

// ---------- FantasyPros: the spike's probe set, run with the (now active) HOF key ----------

function fpProbes(sport, season) {
  return [
    { name: "ecr-draft-ppr-all",   path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "ALL" } },
    { name: "ecr-draft-half-all",  path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "HALF", position: "ALL" } },
    { name: "ecr-draft-std-all",   path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "STD",  position: "ALL" } },
    { name: "ecr-draft-ppr-qb",    path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "QB" } },
    { name: "ecr-draft-ppr-rb",    path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "RB" } },
    { name: "ecr-draft-ppr-op",    path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "OP" } }, // OP = superflex
    { name: "ecr-dynasty-ppr-all", path: `/${sport}/${season}/consensus-rankings`, q: { type: "dynasty", scoring: "PPR",  position: "ALL" } },
    { name: "ecr-dynasty-ppr-qb",  path: `/${sport}/${season}/consensus-rankings`, q: { type: "dynasty", scoring: "PPR",  position: "QB" } },
    { name: "ecr-ros-ppr-all",     path: `/${sport}/${season}/consensus-rankings`, q: { type: "ros",     scoring: "PPR",  position: "ALL" } },
    { name: "ecr-weekly-ppr-all",  path: `/${sport}/${season}/consensus-rankings`, q: { type: "weekly",  scoring: "PPR",  position: "ALL", week: "1" } },
    { name: "projections-all",     path: `/${sport}/${season}/projections`,        q: { position: "ALL", week: "draft" } },
    { name: "projections-qb",      path: `/${sport}/${season}/projections`,        q: { position: "QB",  week: "draft" } },
    { name: "players",             path: `/${sport}/players`,                       q: {} },
    { name: "adp",                 path: `/${sport}/${season}/adp`,                 q: { position: "ALL" } },
    { name: "news",                path: `/${sport}/news`,                          q: {} },
  ];
}

// Count the player-like array in a FP payload, for an at-a-glance manifest signal
// (e.g. ~520 rows + public_api_limited:false confirms the HOF key is unlocking the
// full board rather than the free tier's 10-of-520 preview).
function countRows(json) {
  if (Array.isArray(json)) return json.length;
  if (json && typeof json === "object") {
    for (const k of ["players", "rankings", "data", "items", "results", "projections"]) {
      if (Array.isArray(json[k])) return json[k].length;
    }
  }
  return null;
}

async function captureFp(runDir, responses) {
  const env = loadEnv(FP_ENV_DIR);
  const apiKey = env.FP_API_KEY || "";
  const host = env.FP_API_HOST || "api.fantasypros.com";
  const basePath = env.FP_BASE_PATH || "/public/v2/json";
  const sport = env.FP_SPORT || "nfl";
  const season = env.FP_SEASON || "2026";
  const delayMs = Number(env.FP_REQUEST_DELAY_MS || 1500); // spike spacing; harmless on HOF
  ensureDir(join(runDir, "fantasypros"));

  if (!apiKey) {
    console.log("  (skipped — no FP_API_KEY in spikes/fantasypros-api/.env)");
    responses.push({
      source: "fantasypros", page: null, url: null, file: null,
      fetched_at: new Date().toISOString(), status: null, error: "no FP_API_KEY",
    });
    return { attempted: false, ok: 0, failed: 0 };
  }

  let ok = 0, failed = 0;
  for (const probe of fpProbes(sport, season)) {
    const qs = new URLSearchParams(probe.q).toString();
    const url = `https://${host}${basePath}${probe.path}${qs ? `?${qs}` : ""}`;
    const fetched_at = new Date().toISOString();
    try {
      const res = await fetch(url, {
        headers: {
          "x-api-key": apiKey,
          Accept: "application/json",
          "User-Agent": "gart-dash-archive/1.0 (read-only snapshot)",
        },
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* keep raw text (HTML error page, etc.) */ }
      const ext = json ? "json" : "txt";
      const file = `fantasypros/${probe.name}.${ext}`;
      writeFileSync(join(runDir, file), json ? JSON.stringify(json, null, 2) : text);
      const rows = json ? countRows(json) : null;
      responses.push({
        source: "fantasypros", page: probe.name, url, file, fetched_at,
        status: res.status, bytes: text.length, is_json: !!json, rows,
        public_api_limited: json && typeof json === "object" ? json.public_api_limited ?? null : null,
        tier: json && typeof json === "object" ? json.tier ?? null : null,
      });
      if (res.ok) ok++; else failed++;
      console.log(
        `  fantasypros/${probe.name.padEnd(18)} ${String(res.status).padEnd(4)} ${String(text.length).padStart(8)} bytes  rows=${rows ?? "-"}`
      );
    } catch (err) {
      failed++;
      responses.push({
        source: "fantasypros", page: probe.name, url, file: null, fetched_at,
        status: null, error: String(err?.message || err),
      });
      console.log(`  fantasypros/${probe.name.padEnd(18)} ERROR ${err?.message || err}`);
    }
    await sleep(delayMs);
  }
  return { attempted: true, host, sport, season, ok, failed };
}

// ---------- Orchestration ----------

async function main() {
  // Append-only: a fresh, filesystem-safe dated folder every run. Guard against the
  // (near-impossible) same-second collision so an existing run is never overwritten.
  const startedAt = new Date();
  const baseId = makeRunId(startedAt);
  let runDir = join(RAW_ROOT, baseId);
  let suffix = 2;
  while (existsSync(runDir)) runDir = join(RAW_ROOT, `${baseId}-${suffix++}`);
  ensureDir(runDir);
  const runFolder = basename(runDir);

  console.log(`\nRaw snapshot archival — run ${runFolder}`);
  console.log(`Writing to data/raw/${runFolder}/  (append-only, git-ignored)\n`);

  const responses = [];
  console.log("CBS — 12 team rosters + league pages:");
  const cbs = await captureCbs(runDir, responses);
  console.log("\nFantasyPros — HOF probe set:");
  const fp = await captureFp(runDir, responses);

  const manifest = {
    run_id: runFolder,
    tool: "tools/archive/capture.mjs",
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    sources: { cbs, fantasypros: fp },
    response_count: responses.length,
    responses,
  };
  writeFileSync(join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\nDone — ${responses.length} responses archived to data/raw/${runFolder}/`);
  console.log(`  CBS:         ${cbs.attempted ? `${cbs.ok} ok, ${cbs.failed} failed${cbs.login_redirects ? `, ${cbs.login_redirects} login-redirect` : ""}` : "skipped (no cookie)"}`);
  console.log(`  FantasyPros: ${fp.attempted ? `${fp.ok} ok, ${fp.failed} failed` : "skipped (no key)"}`);
  console.log(`  Manifest:    data/raw/${runFolder}/manifest.json`);
  console.log(`Nothing was overwritten — this is a new dated folder.\n`);
}

main();
