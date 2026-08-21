// CBS data spike — read-only page pull (GitHub issue #5)
//
// WHAT WE LEARNED: CBS retired its old JSON API. The modern league site renders
// its data straight into the page HTML (tables), gated only by your logged-in
// session cookie. So the real ingestion path is: GET the clean league URLs with
// the cookie, and parse the HTML tables. This script does the GET half for a set
// of data pages, saves each HTML into output/, and reports what data signals each
// page contains. It ONLY reads (HTTP GET). It never writes anything to CBS.
//
// RUN (from project root):  node spikes/cbs-api/pull.mjs
// Needs Node 18+. No npm install. Auth comes from spikes/cbs-api/.env (CBS_COOKIE).

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
const COOKIE = env.CBS_COOKIE || "";
const LEAGUE_HOST = env.CBS_LEAGUE_HOST || "kerfuffle.football.cbssports.com";
const SEASON = env.CBS_SEASON || ""; // optional: append ?season=YYYY to test history

if (!COOKIE) {
  console.error("\n✗ No CBS_COOKIE in spikes/cbs-api/.env — see README.md.\n");
  process.exit(1);
}

// The real league data pages (discovered from the site's own nav links).
const PAGES = [
  { name: "teams-myteam", path: "/teams" },
  { name: "teams-roster-grid", path: "/teams/roster-grid" },
  { name: "roster-report-t1", path: "/teams/roster-report/1/1" },
  { name: "roster-report-t2", path: "/teams/roster-report/2/1" },
  { name: "players-available", path: "/players" },
  { name: "players-rankings", path: "/players/rankings" },
  { name: "transactions", path: "/transactions" },
  { name: "transactions-trade", path: "/transactions/trade" },
  { name: "standings-overall", path: "/standings/overall" },
  { name: "rules", path: "/rules" },
  { name: "history", path: "/history" },
  { name: "draft-results", path: "/draft/results" },
  { name: "scoring-live", path: "/scoring/live" },
];

function url(path) {
  return `https://${LEAGUE_HOST}${path}${SEASON ? `?season=${SEASON}` : ""}`;
}

function signals(html) {
  const c = (n) => html.toLowerCase().split(n).length - 1;
  return {
    playerRows: (html.match(/playerRow/g) || []).length,
    salary: c("salary"),
    contract: c("contract"),
    tables: c("<table"),
    trs: c("<tr"),
    playerLinks: (html.match(/playerpage\/\d+/g) || []).length,
  };
}

async function pull(page) {
  const u = url(page.path);
  let res;
  try {
    res = await fetch(u, {
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/json,*/*",
        Cookie: COOKIE,
      },
    });
  } catch (err) {
    return { page, error: String(err?.message || err) };
  }
  const status = res.status;
  const location = res.headers.get("location") || "";
  const body = await res.text();
  const isLogin = /\/login/.test(location) || /Please sign in|user_login/i.test(body.slice(0, 4000));
  const sig = signals(body);
  writeFileSync(join(OUT_DIR, `${page.name}.html`), body);
  return { page, status, bytes: body.length, isLogin, location, sig };
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`\nCBS data page pull — host ${LEAGUE_HOST}${SEASON ? ` (season=${SEASON})` : ""}`);
console.log("All read-only GETs. Auth: cookie ✓\n");
console.log(
  "page".padEnd(22) + "stat  bytes    login  pRows  salary contract tables  pLinks"
);
console.log("-".repeat(86));

const results = [];
for (const page of PAGES) {
  const r = await pull(page);
  results.push(r);
  if (r.error) {
    console.log(`${page.name.padEnd(22)}ERROR ${r.error}`);
    continue;
  }
  const s = r.sig;
  console.log(
    page.name.padEnd(22) +
      String(r.status).padEnd(6) +
      String(r.bytes).padStart(7) +
      "  " +
      (r.isLogin ? "YES  " : " no  ").padStart(6) +
      String(s.playerRows).padStart(6) +
      String(s.salary).padStart(7) +
      String(s.contract).padStart(8) +
      String(s.tables).padStart(7) +
      String(s.playerLinks).padStart(8)
  );
}

writeFileSync(
  join(OUT_DIR, "_pages_summary.json"),
  JSON.stringify(results.map((r) => ({ ...r, page: r.page?.name })), null, 2)
);
console.log(
  "\nLegend: pRows=roster table rows, pLinks=player links, login=YES means the cookie" +
    "\nexpired (re-copy it). Saved HTML is in spikes/cbs-api/output/ (git-ignored).\n"
);
