// Source-profiling generator (issue #11). Walks the latest raw snapshot (issue
// #10) and emits a COMMITTED field profile — shape only, no real league values —
// plus the /rules scoring config in full, and a human-readable PROFILE.md.
//
// Re-run after each pull; a git diff then shows source drift (a new column, a
// changed type, a blank-rate jump), not day-to-day data churn.
//
// RUN:  npm run profile           (profiles data/raw/<latest>/)
//       node tools/profile/generate.mjs <run-folder-name>   (a specific run)
//
// SAFETY: every player/roster/market value is masked to its shape; only curated
// non-private structural enums list real values. A leak self-check runs at the
// end and FAILS the build if any private field would publish a real value.

import { join, basename } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import {
  RAW_ROOT, PROFILE_OUT, findLatestRun, readManifest, readText, readJson,
  writeJson, writeTextFile,
} from "./shared.mjs";
import { parseTables, primaryTable, parseRoster } from "./parse-cbs.mjs";
import { parseScoring, parseSettingsTables } from "./parse-scoring.mjs";
import { profileFpFile } from "./parse-fp.mjs";
import { profileTable, profileColumn } from "./profile-core.mjs";
import { isLeakFree } from "./sanitize.mjs";

// ---------- resolve which run to profile ----------

function resolveRun() {
  const arg = process.argv[2];
  if (arg) {
    const dir = join(RAW_ROOT, arg);
    if (!existsSync(dir)) { console.error(`Run not found: ${dir}`); process.exit(1); }
    return dir;
  }
  const latest = findLatestRun();
  if (!latest) {
    console.error("No raw archive found under data/raw/. Run `npm run archive` first (issue #10).");
    process.exit(1);
  }
  return latest;
}

// ---------- CBS ----------

const CBS_GENERIC_PAGES = [
  "teams-myteam", "teams-roster-grid", "players-available", "transactions",
  "transactions-trade", "standings-overall", "draft-results", "history",
  "scoring-live", "players-rankings",
];

function profileCbs(runDir) {
  const cbsDir = join(runDir, "cbs");
  const out = { rosters: null, scoring_source: "cbs/rules.html", pages: {} };

  // --- 12 rosters: pool columns + structural analysis ---
  const rosterHeaders = [];
  const pooledRows = [];
  const perTeam = [];
  let pooledHeader = null;
  for (let t = 1; t <= 12; t++) {
    const html = readText(join(cbsDir, `roster-report-t${t}.html`));
    if (!html) continue;
    const r = parseRoster(html);
    const prim = primaryTable(html);
    if (prim && prim.header.length) {
      pooledHeader = pooledHeader || prim.header;
      for (const row of prim.rows) pooledRows.push(row);
    }
    if (r) {
      rosterHeaders.push(r.header.join("|"));
      perTeam.push({
        team: t,
        players: r.playerCount,
        active: r.activeCount,
        reserve: r.reserveCount,
        injured: r.injuredCount,
        practice_squad: r.practiceCount,
        pseudo_rows: r.pseudoRowCount,
        sections: r.sections,
      });
    }
  }

  // Pseudo-row characterization: pull any across all teams (dead-cap rows).
  const pseudoSamples = [];
  for (let t = 1; t <= 12; t++) {
    const html = readText(join(cbsDir, `roster-report-t${t}.html`));
    if (!html) continue;
    const r = parseRoster(html);
    if (r) for (const p of r.pseudoRows) pseudoSamples.push({ team: t, section: p.section, shape: p.cells.map((c) => c).join(" | ") });
  }

  out.rosters = {
    source: "cbs/roster-report-t{1..12}.html",
    teams_profiled: perTeam.length,
    header_consistent_across_teams: new Set(rosterHeaders).size === 1,
    distinct_headers: [...new Set(rosterHeaders)].length,
    per_team: perTeam,
    totals: {
      players: perTeam.reduce((a, b) => a + b.players, 0),
      practice_squad: perTeam.reduce((a, b) => a + b.practice_squad, 0),
      pseudo_rows: perTeam.reduce((a, b) => a + b.pseudo_rows, 0),
    },
    pseudo_row_samples: pseudoSamples.slice(0, 20).map((s) => ({
      team: s.team, section: s.section,
      shape: s.shape.replace(/[A-Z]/g, "A").replace(/[a-z]/g, "a").replace(/[0-9]/g, "9").slice(0, 80),
    })),
    column_profile: pooledHeader
      ? profileTable("roster lineup (12 teams pooled)", pooledHeader, pooledRows)
      : null,
  };

  // --- generic pages: profile the primary static table, or flag JS-rendered ---
  for (const page of CBS_GENERIC_PAGES) {
    const html = readText(join(cbsDir, `${page}.html`));
    if (html == null) { out.pages[page] = { present: false }; continue; }
    const prim = primaryTable(html);
    const playerLinks = (html.match(/playerpage/g) || []).length;
    // CBS paginates via a "Pages:" nav of start_row= links (not ?page=).
    const paginated = /Pages:\s*(<|\d)/i.test(html) || /[?&](start_row|page)=/i.test(html);
    if (prim && prim.header.length && prim.rows.length) {
      // Does any data cell carry a $-amount? (Q4: FAB bid amounts in transactions.)
      const hasDollar = prim.rows.some((r) => r.some((c) => /\$\s*\d/.test(c)));
      out.pages[page] = {
        present: true,
        bytes: html.length,
        static_table: true,
        paginated,
        player_links_in_html: playerLinks,
        dollar_amounts_in_cells: hasDollar,
        all_tables: parseTables(html).map((t) => ({ header: t.header, rows: t.rows.length })),
        profile: profileTable(page, prim.header, prim.rows),
      };
    } else {
      out.pages[page] = {
        present: true,
        bytes: html.length,
        static_table: false,
        note: "No parseable static <table> with data rows — content is JS-rendered/collapsed or empty in the snapshot.",
        player_links_in_html: playerLinks,
        paginated,
      };
    }
  }
  return out;
}

function profileScoring(runDir) {
  const html = readText(join(runDir, "cbs", "rules.html"));
  if (!html) return { present: false };
  const scoring = parseScoring(html);
  const { settings, rosterLimits } = parseSettingsTables(html);
  return {
    present: true,
    source: "cbs/rules.html",
    note: "League RULES, committed in full. Parsed from the page, never hardcoded (scoring changed as recently as 2024).",
    scoring_rules: scoring,
    roster_limits: rosterLimits,
    league_settings: settings,
  };
}

// ---------- FantasyPros ----------

function profileFp(runDir) {
  const fpDir = join(runDir, "fantasypros");
  const manifest = readManifest(runDir);
  const httpByFile = {};
  if (manifest) for (const r of manifest.responses || []) {
    if (r.source === "fantasypros" && r.file) httpByFile[basename(r.file)] = r;
  }
  if (!existsSync(fpDir)) return { present: false };
  const files = readdirSync(fpDir).filter((f) => f.endsWith(".json") || f.endsWith(".txt")).sort();
  const endpoints = files.map((f) => {
    const json = f.endsWith(".json") ? readJson(join(fpDir, f)) : null;
    const h = httpByFile[f] || {};
    return profileFpFile(f.replace(/\.(json|txt)$/, ""), json, {
      http_status: h.status ?? null,
      url_shape: (h.url || "").replace(/x-api-key=[^&]*/i, "x-api-key=REDACTED"),
    });
  });
  return { present: true, endpoints };
}

// ---------- leak self-check ----------

function leakCheck(...profiles) {
  const problems = [];
  const walkColumns = (cols, where) => {
    for (const c of cols || []) {
      const priv = c.category === "private" || c.category === "identifier" || c.category === "freeform";
      if (priv && c.distinct_values) problems.push(`${where}/${c.field}: private field published distinct_values`);
      if (c.example && !isLeakFree(c.example)) problems.push(`${where}/${c.field}: example not leak-free ("${c.example}")`);
    }
  };
  const walk = (node, where) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.columns)) walkColumns(node.columns, where);
    for (const [k, v] of Object.entries(node)) {
      if (k === "columns") continue;
      if (v && typeof v === "object") walk(v, `${where}.${k}`);
    }
  };
  for (const p of profiles) walk(p, p && p.__name ? p.__name : "profile");
  return problems;
}

// ---------- markdown ----------

function md(cbs, scoring, fp, runId) {
  const L = [];
  L.push(`# Source field profile — Gart Dash (issue #11)`);
  L.push("");
  L.push(`> **Generated by** \`npm run profile\` (\`tools/profile/generate.mjs\`) from raw run \`${runId}\`.`);
  L.push(`> **Shape only** — no real player/roster/market values are committed. League *rules* (scoring) are committed in full in [\`cbs_scoring_rules.json\`](cbs_scoring_rules.json).`);
  L.push(`> Machine-readable detail: [\`cbs_field_profile.json\`](cbs_field_profile.json), [\`fantasypros_field_profile.json\`](fantasypros_field_profile.json). Re-run after each pull; the git diff is your source-drift alarm.`);
  L.push("");
  L.push(`## The six questions`);
  L.push("");

  // Q1
  const rp = cbs.rosters;
  L.push(`### 1. Full column inventory for the ingestion pages`);
  L.push(`Rosters, transactions, standings, draft results, and rules were profiled. Full per-column detail (type, shape example, blank rate, cardinality) is in \`cbs_field_profile.json\`. Headline: the **roster lineup table parses cleanly and consistently across all 12 teams** (header consistent: **${rp.header_consistent_across_teams}**), but **several pages are JS-rendered/paginated and their data is _not_ in the static snapshot** (see the corrected risk table in \`cbs_data_discovery.md\`).`);
  L.push("");
  L.push(`| Page | Static table? | Notes |`);
  L.push(`| --- | --- | --- |`);
  L.push(`| roster-report (×12) | ✅ | ${rp.column_profile ? rp.column_profile.column_count : "?"} columns, pooled ${rp.column_profile ? rp.column_profile.row_count : "?"} rows |`);
  for (const [page, info] of Object.entries(cbs.pages)) {
    if (!info.present) { L.push(`| ${page} | — | not in snapshot |`); continue; }
    const cols = info.profile ? `${info.profile.column_count} cols, ${info.profile.row_count} rows` : "—";
    L.push(`| ${page} | ${info.static_table ? "✅" : "❌ JS/empty"} | ${info.static_table ? cols : info.note}${info.paginated ? " · paginated (page 1 only)" : ""} |`);
  }
  L.push("");

  // Q2
  L.push(`### 2. Extracted \`/rules\` scoring values (parsed, not hardcoded)`);
  if (scoring.present) {
    L.push(`All **${scoring.scoring_rules.length}** scoring rules were parsed from the page into structured form — see [\`cbs_scoring_rules.json\`](cbs_scoring_rules.json). Three value formats are handled: flat, per-unit (e.g. yards), and tiered (Points Against). Roster limits and general league settings are captured alongside.`);
    L.push("");
    L.push(`⚠ **The live page is authoritative and can differ from the written constitution.** Verify \`cbs_scoring_rules.json\` against the constitution before the engine uses it — an observed example is called out in \`cbs_data_discovery.md\`. This is exactly why the values are parsed, never hardcoded (scoring changed as recently as 2024: Turnover on Downs).`);
  } else {
    L.push(`\`rules.html\` not found in this run.`);
  }
  L.push("");

  // Q3
  L.push(`### 3. All 12 rosters — dead-cap pseudo-rows and Practice Squad`);
  L.push(`Profiled **${rp.teams_profiled}/12** rosters. Rows are classified by section (\`Active\` / \`Reserves\` / \`Injured\` / \`Practice\`) and by whether the row links to a real CBS player id.`);
  L.push("");
  L.push(`- **Real players (with CBS id):** ${rp.totals.players} across the league.`);
  L.push(`- **Practice-Squad players:** ${rp.totals.practice_squad} (real players sitting in a \`Practice\` section — they carry an id like any player; they differ only by section/status, and per the rules count against the $500 cap but not active-roster limits).`);
  L.push(`- **Dead-cap pseudo-rows (commissioner-added, no player id):** ${rp.totals.pseudo_rows}${rp.totals.pseudo_rows === 0 ? " — **none in this snapshot.** They appear as inactive rows the commissioner adds after a cut; this pre-auction snapshot has none. When present they are detectable as a roster row with a salary but **no `playerpage` link** (no CBS id) — the schema decision for them stays the owner's (roadmap open decision #7)." : " — see samples (shape only) in `cbs_field_profile.json`."}`);
  L.push("");
  L.push(`| Team | Players | Active | Reserve | Injured | Practice | Pseudo |`);
  L.push(`| --- | --- | --- | --- | --- | --- | --- |`);
  for (const t of rp.per_team) L.push(`| ${t.team} | ${t.players} | ${t.active} | ${t.reserve} | ${t.injured} | ${t.practice_squad} | ${t.pseudo_rows} |`);
  L.push("");

  // Q4
  const tx = cbs.pages["transactions"] || {};
  L.push(`### 4. Transaction types + FAB winning-bid amounts`);
  L.push(`The default \`/transactions\` view profiles as columns **${tx.profile ? tx.profile.columns.map((c) => c.field).join(", ") : "(none parsed)"}**. Findings:`);
  L.push(`- **No dedicated "type" column** and **no bid-amount column** in the default view. Dollar amounts in data cells: **${tx.dollar_amounts_in_cells ? "yes" : "no"}**.`);
  L.push(`- The log is **paginated** (${tx.paginated ? "yes — only page 1 was archived" : "no"}); a full enumeration needs the \`All\` page and/or the type-filtered views.`);
  L.push(`- **FAB winning-bid amounts remain unresolved here** (as the discovery doc flagged). The winning bid *becomes the player's salary*, which **is** visible on the roster pages — so bid outcomes are recoverable via salary even though the bid event isn't itemized in this view.`);
  L.push("");

  // Q5
  L.push(`### 5. FantasyPros HOF re-pull`);
  if (fp.present) {
    const ok = fp.endpoints.filter((e) => e.http_status === 200);
    const withRows = ok.filter((e) => e.row_count > 0);
    const tiers = [...new Set(fp.endpoints.map((e) => e.envelope && e.envelope.tier).filter(Boolean))];
    const rankingExperts = fp.endpoints
      .filter((e) => /^ecr/.test(e.endpoint))
      .map((e) => e.envelope && e.envelope.total_experts)
      .filter(Boolean);
    const expertsMax = rankingExperts.length ? Math.max(...rankingExperts) : "?";
    L.push(`Profiled **${fp.endpoints.length}** endpoints; per-field detail in [\`fantasypros_field_profile.json\`](fantasypros_field_profile.json).`);
    L.push("");
    L.push(`- **The full board is unlocked:** ranking endpoints return the whole universe (hundreds of rows, not the free tier's 10-of-520 preview), \`tier\` reports **${tiers.join(", ") || "?"}**, and consensus draws on **up to ${expertsMax} experts**.`);
    L.push(`- **⚠ \`public_api_limited\` still reports \`true\`** on the HOF key — the issue expected \`false\`. **That flag is _not_ the reliable signal**; row count + \`tier\` are. Corrected in \`fantasypros_data_discovery.md\`.`);
    L.push(`- **Previously-\`403\` endpoints now return data:** projections, player metadata, and news are **200**. **Only ADP is still \`403\`** — its path/params look genuinely wrong, not merely gated (nice-to-have, not blocking).`);
    L.push("");
    L.push(`| Endpoint | HTTP | Rows | limited | tier |`);
    L.push(`| --- | --- | --- | --- | --- |`);
    for (const e of fp.endpoints) {
      const env = e.envelope || {};
      L.push(`| ${e.endpoint} | ${e.http_status ?? "?"} | ${e.row_count ?? "—"} | ${env.public_api_limited ?? "—"} | ${env.tier ?? "—"} |`);
    }
  } else {
    L.push(`No FantasyPros snapshot in this run.`);
  }
  L.push("");

  // Q6
  L.push(`### 6. Are CBS's displayed projections KERFUFFLE-scored?`);
  L.push(`**Strong evidence: yes.** The roster/scoring pages render on the league's own CBS site, which applies KERFUFFLE scoring settings to all fantasy points it shows — the \`2025\` (prior-season actual) and \`Proj\` columns sit in that same league-scored context, and CBS actuals are the authoritative KERFUFFLE record. This supports the backtest's second baseline (beating CBS's own scored projections, not just raw ECR).`);
  L.push(`**To confirm definitively (deferred to the engine):** join a player across sources by \`cbs_player_id\`, run their FantasyPros raw stat-line projection through the parsed \`cbs_scoring_rules.json\`, and check it lands near CBS's displayed \`Proj\`. That is engine work (#7), out of scope for this spike.`);
  L.push("");
  L.push(`---`);
  L.push(`*Regenerate with \`npm run profile\`. Related: [\`../cbs_data_discovery.md\`](../cbs_data_discovery.md), [\`../fantasypros_data_discovery.md\`](../fantasypros_data_discovery.md), [\`../data_model.md\`](../data_model.md).*`);
  return L.join("\n");
}

// ---------- main ----------

function main() {
  const runDir = resolveRun();
  const runId = basename(runDir);
  console.log(`\nSource profiling — reading raw run ${runId}`);

  const cbs = profileCbs(runDir);
  const scoring = profileScoring(runDir);
  const fp = profileFp(runDir);

  // Leak self-check BEFORE writing anything committed.
  const problems = leakCheck({ __name: "cbs", ...cbs }, { __name: "fantasypros", ...fp });
  if (problems.length) {
    console.error(`\n✗ LEAK CHECK FAILED (${problems.length}) — nothing written:`);
    for (const p of problems.slice(0, 40)) console.error("   - " + p);
    process.exit(1);
  }
  console.log("✓ leak check passed (no private field publishes a real value)");

  const meta = { source_run: runId, source: "data/raw (git-ignored, issue #10)", generator: "tools/profile/generate.mjs" };
  writeJson(join(PROFILE_OUT, "cbs_field_profile.json"), { _meta: meta, ...cbs });
  writeJson(join(PROFILE_OUT, "cbs_scoring_rules.json"), { _meta: meta, ...scoring });
  writeJson(join(PROFILE_OUT, "fantasypros_field_profile.json"), { _meta: meta, ...fp });
  writeTextFile(join(PROFILE_OUT, "PROFILE.md"), md(cbs, scoring, fp, runId));

  console.log(`\nWrote 4 files to docs/profiles/:`);
  console.log(`  cbs_field_profile.json         (rosters + ${Object.keys(cbs.pages).length} pages)`);
  console.log(`  cbs_scoring_rules.json         (${scoring.present ? scoring.scoring_rules.length : 0} scoring rules, in full)`);
  console.log(`  fantasypros_field_profile.json (${fp.present ? fp.endpoints.length : 0} endpoints)`);
  console.log(`  PROFILE.md                     (answers the six questions)`);
  console.log(`\nDone.\n`);
}

main();
