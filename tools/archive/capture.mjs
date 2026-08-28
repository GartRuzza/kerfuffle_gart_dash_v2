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
// The transaction log IS captured completely (issue #12): the ?print_rows=9999
// print-all view plus a walk of every ?start_row=N pagination page.
//
// RUN (from project root):  npm run archive   (or: node tools/archive/capture.mjs)
// Node 18+ (built-in fetch). No npm install. Credentials come from the spike .env
// files: spikes/cbs-api/.env (CBS_COOKIE) and spikes/fantasypros-api/.env (FP_API_KEY).

import { writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { RAW_ROOT, CBS_ENV_DIR, FP_ENV_DIR, loadEnv, makeRunId, ensureDir } from "./shared.mjs";
import { currentNflWeek } from "./nfl-week.mjs";

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

  // Fetch one CBS page, write it verbatim, record it in the manifest.
  // Returns the body so the transaction-pagination walk can discover further pages.
  async function fetchCbsPage(page) {
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
      return { body, ok: res.status >= 200 && res.status < 400 && !loginRedirect };
    } catch (err) {
      failed++;
      responses.push({
        source: "cbs", page: page.name, url, file: null, fetched_at,
        status: null, error: String(err?.message || err),
      });
      console.log(`  cbs/${page.name.padEnd(20)} ERROR ${err?.message || err}`);
      return { body: "", ok: false };
    }
  }

  let transactionsPage1 = null;
  for (const page of cbsPages()) {
    const result = await fetchCbsPage(page);
    if (page.name === "transactions") transactionsPage1 = result;
  }

  // The transaction log is paginated (30 rows/page, plain ?start_row=N links) and
  // page 1 also links a ?print_rows=9999 "print all" view. Un-captured pages are
  // unrecoverable history, so capture BOTH: the print-all view (one complete page)
  // and every start_row page discovered by walking the pagination links — the
  // belt-and-suspenders in case either form is ever incomplete.
  if (transactionsPage1?.ok) {
    await fetchCbsPage({ name: "transactions-all", path: "/transactions?print_rows=9999" });
    const TX_PAGE_CAP = 50; // safety cap; ~30 rows/page => covers 1500 transactions
    const seen = new Set();
    const queue = [];
    const discover = (body) => {
      for (const m of body.matchAll(/\/transactions\?start_row=(\d+)/g)) {
        const startRow = Number(m[1]);
        if (startRow > 1 && !seen.has(startRow)) {
          seen.add(startRow);
          queue.push(startRow);
        }
      }
    };
    discover(transactionsPage1.body);
    let fetched = 0;
    while (queue.length > 0 && fetched < TX_PAGE_CAP) {
      const startRow = queue.shift();
      await sleep(250); // be gentle
      const result = await fetchCbsPage({
        name: `transactions-p${startRow}`,
        path: `/transactions?start_row=${startRow}`,
      });
      fetched++;
      if (result.ok) discover(result.body); // windowed pagers reveal pages incrementally
    }
    if (queue.length > 0) {
      console.log(`  ⚠ transaction pagination cap (${TX_PAGE_CAP}) hit — ${queue.length} page(s) NOT captured`);
    }
  } else {
    console.log("  ⚠ transactions page 1 failed — skipping pagination walk + print-all view");
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

// `week` is the current NFL week (issue #27) — the in-season probes below request
// it explicitly. Preseason it's Week 1 (FantasyPros publishes the upcoming week
// early); the season projection stays `week=draft` (full-season, ingested as week 0).
function fpProbes(sport, season, week) {
  return [
    { name: "ecr-draft-ppr-all",   path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "ALL" } },
    { name: "ecr-draft-half-all",  path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "HALF", position: "ALL" } },
    { name: "ecr-draft-std-all",   path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "STD",  position: "ALL" } },
    { name: "ecr-draft-ppr-qb",    path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "QB" } },
    { name: "ecr-draft-ppr-rb",    path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "RB" } },
    { name: "ecr-draft-ppr-op",    path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "PPR",  position: "OP" } }, // OP = superflex
    // THE display board (owner decision 2026-08-26): standard scoring + superflex.
    // KERFUFFLE starts two QBs, so a 1-QB board ranks QBs ~20 spots too low.
    { name: "ecr-draft-std-op",    path: `/${sport}/${season}/consensus-rankings`, q: { type: "draft",   scoring: "STD",  position: "OP" } },
    { name: "ecr-dynasty-op",      path: `/${sport}/${season}/consensus-rankings`, q: { type: "dynasty", scoring: "STD",  position: "OP" } }, // dynasty is scoring-agnostic
    { name: "ecr-dynasty-ppr-all", path: `/${sport}/${season}/consensus-rankings`, q: { type: "dynasty", scoring: "PPR",  position: "ALL" } },
    { name: "ecr-dynasty-std-all", path: `/${sport}/${season}/consensus-rankings`, q: { type: "dynasty", scoring: "STD",  position: "ALL" } },
    { name: "ecr-dynasty-ppr-qb",  path: `/${sport}/${season}/consensus-rankings`, q: { type: "dynasty", scoring: "PPR",  position: "QB" } },
    // --- In-season boards in the league's display format (STD / superflex), issue #27 ---
    // ROS (rest-of-season) consensus. Preseason FantasyPros returns the DRAFT board
    // here (fallback_for:"ROS"); ingestion detects that and does NOT store it as ROS.
    { name: "ecr-ros-std-op",      path: `/${sport}/${season}/consensus-rankings`, q: { type: "ros",     scoring: "STD",  position: "OP" } },
    // Weekly consensus for the current week — carries opponent + expert start/sit lean.
    { name: "ecr-weekly-std-op",   path: `/${sport}/${season}/consensus-rankings`, q: { type: "weekly",  scoring: "STD",  position: "OP", week: String(week) } },
    // Kept for continuity/context (PPR/ALL variants), now tracking the current week too.
    { name: "ecr-ros-ppr-all",     path: `/${sport}/${season}/consensus-rankings`, q: { type: "ros",     scoring: "PPR",  position: "ALL" } },
    { name: "ecr-weekly-ppr-all",  path: `/${sport}/${season}/consensus-rankings`, q: { type: "weekly",  scoring: "PPR",  position: "ALL", week: String(week) } },
    // Projections: the full-season line (ingested as week 0 — the ROS lens reads it)
    // AND the current week's line (ingested as week N — the weekly lens reads it).
    { name: "projections-all",         path: `/${sport}/${season}/projections`,    q: { position: "ALL", week: "draft" } },
    { name: "projections-qb",          path: `/${sport}/${season}/projections`,    q: { position: "QB",  week: "draft" } },
    { name: `projections-week-${week}`, path: `/${sport}/${season}/projections`,   q: { position: "ALL", week: String(week) } },
    { name: "players",             path: `/${sport}/players`,                       q: {} },
    { name: "adp",                 path: `/${sport}/${season}/adp`,                 q: { position: "ALL" } },
    { name: "news",                path: `/${sport}/news`,                          q: {} },
  ];
}

// The in-season probes whose payload echoes a `week` we can cross-check against
// the week we requested (issue #27's transparency safety net). Names are matched
// exactly except the week-suffixed projection, matched by prefix.
function isWeeklyProbe(name) {
  return name === "ecr-weekly-std-op" || name === "ecr-weekly-ppr-all" || /^projections-week-\d+$/.test(name);
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

  // Which NFL week to request for the in-season probes (issue #27). Default: the
  // hardcoded 2026 date→week table (owner's choice). FP_WEEK in the .env is a
  // documented manual override for the rare case the table is wrong.
  const envWeek = Number(env.FP_WEEK);
  const weekOverride = Number.isInteger(envWeek) && envWeek > 0;
  const week = weekOverride ? envWeek : currentNflWeek(new Date());
  const weekSource = weekOverride ? "FP_WEEK override" : "2026 date→week table";
  console.log(`  current NFL week: ${week}  (${weekSource})`);

  if (!apiKey) {
    console.log("  (skipped — no FP_API_KEY in spikes/fantasypros-api/.env)");
    responses.push({
      source: "fantasypros", page: null, url: null, file: null,
      fetched_at: new Date().toISOString(), status: null, error: "no FP_API_KEY",
    });
    return { attempted: false, ok: 0, failed: 0, week, weekSource };
  }

  let ok = 0, failed = 0;
  const weekEchoes = []; // {page, echoed} — the week FantasyPros reports back
  for (const probe of fpProbes(sport, season, week)) {
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
      // The week FantasyPros echoes back — cross-checked against the week we asked
      // for, so an off-by-one in the date→week table surfaces in the manifest.
      const echoedWeek =
        json && typeof json === "object" && json.week != null && String(json.week).match(/^\d+$/)
          ? Number(json.week)
          : null;
      if (isWeeklyProbe(probe.name)) weekEchoes.push({ page: probe.name, echoed: echoedWeek });
      responses.push({
        source: "fantasypros", page: probe.name, url, file, fetched_at,
        status: res.status, bytes: text.length, is_json: !!json, rows,
        public_api_limited: json && typeof json === "object" ? json.public_api_limited ?? null : null,
        tier: json && typeof json === "object" ? json.tier ?? null : null,
        week_requested: isWeeklyProbe(probe.name) ? week : null,
        week_echoed: isWeeklyProbe(probe.name) ? echoedWeek : null,
      });
      if (res.ok) ok++; else failed++;
      console.log(
        `  fantasypros/${probe.name.padEnd(18)} ${String(res.status).padEnd(4)} ${String(text.length).padStart(8)} bytes  rows=${rows ?? "-"}` +
          (isWeeklyProbe(probe.name) ? `  week=${echoedWeek ?? "-"}` : "")
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

  // Transparency check (issue #27): warn if FantasyPros served a different week
  // than we requested. A real board echoes our week; a mismatch (or a null echo)
  // means the date→week table is off or the week isn't published yet.
  const mismatches = weekEchoes.filter((w) => w.echoed !== null && w.echoed !== week);
  const emptyEchoes = weekEchoes.filter((w) => w.echoed === null);
  if (mismatches.length > 0) {
    console.log(
      `\n  ⚠ requested week ${week} but FantasyPros echoed a different week: ` +
        mismatches.map((m) => `${m.page}=${m.echoed}`).join(", ") +
        `\n    Check the 2026 date→week table (tools/archive/nfl-week.mjs) or set FP_WEEK.`
    );
  }
  if (emptyEchoes.length > 0) {
    console.log(
      `  ⚠ ${emptyEchoes.length} weekly probe(s) returned no week (empty/unpublished): ` +
        emptyEchoes.map((m) => m.page).join(", ")
    );
  }

  return {
    attempted: true, host, sport, season, ok, failed,
    week, weekSource, weekEchoes,
    weekEchoMismatch: mismatches.length > 0,
  };
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
  console.log(`  FantasyPros: ${fp.attempted ? `${fp.ok} ok, ${fp.failed} failed (week ${fp.week}${fp.weekEchoMismatch ? " ⚠ echo mismatch" : ""})` : `skipped (no key)${fp.week ? ` — would use week ${fp.week}` : ""}`}`);
  console.log(`  Manifest:    data/raw/${runFolder}/manifest.json`);
  console.log(`Nothing was overwritten — this is a new dated folder.\n`);
}

main();
