// Current-season actuals parser (issue #30). Reads the CBS stats table pages the
// archiver captures (tools/archive/stats-actuals.mjs) — the standard view (volume +
// FPTS Total) and the advanced view (rush/rec first downs) — into per-player stat
// lines keyed by CBS player id.
//
// This is the HTML twin of the historical CSV loader (parse-historical.mjs): the
// SAME components in the SAME shape as player_season_stats, so the same parsed
// scoring_rule recompute + CBS-FPTS cross-check applies (issue #17). The differences
// from the CSV loader are only in the source shape:
//   * The CBS player id is embedded in each row's Action cell
//     (CBSi.app.Stats.ActionButtons.players.push({<id>:…})) — an exact join key, so
//     we key by id, not by a name string.
//   * The columns are a clean single header row, but with repeated labels across
//     stat groups (1stD/2Pt/Avg ×3), so we map by FIXED INDEX and ANCHOR on the full
//     header sequence — a layout drift fails loudly rather than misaligning silently.

import { parse } from "node-html-parser";
import { IngestError } from "./parse-cbs-ingest.mjs";

const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();

const int = (raw) => {
  const s = clean(raw).replace(/,/g, "");
  if (s === "" || s === "—" || s === "-") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const num = (raw) => {
  const s = clean(raw).replace(/,/g, "");
  if (s === "" || s === "—" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// The exact column-header sequences observed on the league stats pages (issue #30
// discovery, 2026-08-28). We assert the header row matches before trusting the fixed
// indices below — the anchor that turns a CBS layout change into a loud failure.
const STANDARD_HEADER = [
  "Action", "Avail", "Player", "Opp", "OVP", "Bye", "Rost", "Start",
  "ATT", "Comp", "Yds", "TD", "Int",   // passing
  "Att", "Yds", "TD",                  // rushing
  "Tar", "Rec", "Yds", "TD",           // receiving
  "Lost", "Avg", "Total",              // fumbles lost, FPTS avg/total
];
const ADVANCED_HEADER = [
  "Action", "Avail", "Player", "Opp", "OVP", "Bye", "Rost", "Start",
  "Pct", "1stD", "2Pt", "Avg",         // passing (Pct, first downs, 2pt, avg)
  "1stD", "2Pt", "Avg",                // rushing
  "1stD", "2Pt", "Avg",                // receiving
  "Total",                             // FPTS total
];

// Fixed 0-based cell indices, verified against the asserted header above.
const STD_COLS = {
  avail: 1, player: 2, bye: 5,
  pass_att: 8, pass_cmp: 9, pass_yds: 10, pass_td: 11, pass_int: 12,
  rush_att: 13, rush_yds: 14, rush_td: 15,
  rec_tar: 16, rec_rec: 17, rec_yds: 18, rec_td: 19,
  fumbles_lost: 20, fpts_avg: 21, fpts_total: 22,
};
const ADV_COLS = {
  avail: 1, player: 2, bye: 5,
  pass_first_downs: 9, pass_2pt: 10,
  rush_first_downs: 12, rush_2pt: 13,
  rec_first_downs: 15, rec_2pt: 16,
  fpts_total: 18,
};

// The player cell: "Christian McCaffrey RB • SF" (HTML uses a • separator; the CSV
// loader saw "|"). Both are accepted so the one regex serves either shape.
const PLAYER_CELL_RE = /^(.+?)\s+(QB|RB|WR|TE|K|DST)\s*(?:•|\|)\s*([A-Z]{2,3})\b/;

// The CBS player id lives in the Action cell's inline ActionButtons registration.
const ID_RE = /ActionButtons\.players\.push\(\{(\d+):/;

/**
 * Parse one stats-table HTML page into a Map(cbs_player_id -> stat record).
 * @param {string} html
 * @param {{kind: 'standard'|'advanced', context: string}} opts
 */
export function parseStatsActualsPage(html, { kind, context }) {
  const root = parse(html);
  const rows = root.querySelectorAll("tr");
  const expected = kind === "advanced" ? ADVANCED_HEADER : STANDARD_HEADER;
  const cols = kind === "advanced" ? ADV_COLS : STD_COLS;

  // Locate + anchor the column-header row (class "label", not the "superheader"
  // group row). Assert the full sequence so a CBS layout change fails loudly.
  const headerRow = rows.find((r) => {
    const cls = r.getAttribute("class") || "";
    if (!/\blabel\b/.test(cls) || /superheader/.test(cls)) return false;
    const cells = r.querySelectorAll("td,th").map((c) => clean(c.text));
    return cells[2] === "Player" && cells.includes("Total");
  });
  if (!headerRow) {
    throw new IngestError(`${context}: could not find the ${kind} column-header row — not the expected CBS stats page`);
  }
  const headerCells = headerRow.querySelectorAll("td,th").map((c) => clean(c.text));
  if (headerCells.length !== expected.length || !expected.every((h, i) => headerCells[i] === h)) {
    throw new IngestError(
      `${context}: ${kind} column layout has drifted — expected [${expected.join(", ")}] ` +
        `but got [${headerCells.join(", ")}]. Refusing to ingest misaligned actuals.`
    );
  }

  const out = new Map();
  for (const r of rows) {
    const cells = r.querySelectorAll("td");
    if (cells.length !== expected.length) continue; // header/super/section/ad rows
    const idm = (cells[0].text || "").match(ID_RE);
    if (!idm) continue; // not a player data row
    const cbsPlayerId = Number(idm[1]);
    const pm = clean(cells[cols.player].text).match(PLAYER_CELL_RE);
    if (!pm) continue; // unparseable player cell — not a data row we can use
    const pick = (name) => cells[cols[name]]?.text;
    const rec = {
      cbsPlayerId,
      name: clean(pm[1]),
      pos: pm[2],
      nflTeam: pm[3],
      avail: clean(cells[cols.avail].text) || null,
      byeWeek: num(pick("bye")),
      nameRaw: clean(cells[cols.player].text),
    };
    if (kind === "advanced") {
      Object.assign(rec, {
        pass_first_downs: int(pick("pass_first_downs")), pass_2pt: int(pick("pass_2pt")),
        rush_first_downs: int(pick("rush_first_downs")), rush_2pt: int(pick("rush_2pt")),
        rec_first_downs: int(pick("rec_first_downs")), rec_2pt: int(pick("rec_2pt")),
        fpts_total: num(pick("fpts_total")),
      });
    } else {
      Object.assign(rec, {
        pass_att: int(pick("pass_att")), pass_cmp: int(pick("pass_cmp")),
        pass_yds: int(pick("pass_yds")), pass_td: int(pick("pass_td")), pass_int: int(pick("pass_int")),
        rush_att: int(pick("rush_att")), rush_yds: int(pick("rush_yds")), rush_td: int(pick("rush_td")),
        rec_tar: int(pick("rec_tar")), rec_rec: int(pick("rec_rec")),
        rec_yds: int(pick("rec_yds")), rec_td: int(pick("rec_td")),
        fumbles_lost: int(pick("fumbles_lost")),
        fpts_avg: num(pick("fpts_avg")), fpts_total: num(pick("fpts_total")),
      });
    }
    // A duplicate id within one category = paginated overlap or parser drift.
    // Latest wins is fine for identical rows; differing rows are a real problem.
    if (out.has(cbsPlayerId)) {
      const prev = out.get(cbsPlayerId);
      if (prev.fpts_total !== rec.fpts_total) {
        throw new IngestError(`${context}: player id ${cbsPlayerId} appears twice with different FPTS — page overlap/drift`);
      }
    }
    out.set(cbsPlayerId, rec);
  }
  return out;
}

/**
 * Parse + merge every standard page and every advanced page of one run into two
 * Maps keyed by id. Pages are the raw HTML strings of each start_row page.
 * @returns {{ standard: Map<number,object>, advanced: Map<number,object> }}
 */
export function parseStatsActualsPages({ standardPages, advancedPages, context }) {
  const merge = (pages, kind) => {
    const acc = new Map();
    pages.forEach((html, i) => {
      const one = parseStatsActualsPage(html, { kind, context: `${context}/${kind}[${i}]` });
      for (const [id, rec] of one) acc.set(id, rec); // later pages fill later rows
    });
    return acc;
  };
  return {
    standard: merge(standardPages, "standard"),
    advanced: merge(advancedPages, "advanced"),
  };
}

/**
 * Join the standard (volume) + advanced (first downs) records by CBS id into one
 * full stat line per player. Asserts the two pages agree on FPTS Total — the core
 * alignment check, mirroring the historical loader's joinSeason.
 * @returns {{ joined: object[], onlyStandard: number[], onlyAdvanced: number[] }}
 */
export function joinActuals({ standard, advanced, context }) {
  const FPTS_EPS = 0.05;
  const joined = [];
  const onlyStandard = [];
  const onlyAdvanced = [];
  for (const [id, std] of standard) {
    const adv = advanced.get(id);
    if (!adv) { onlyStandard.push(id); continue; }
    if (std.fpts_total != null && adv.fpts_total != null &&
        Math.abs(std.fpts_total - adv.fpts_total) > FPTS_EPS) {
      throw new IngestError(
        `${context}: FPTS Total disagrees between standard (${std.fpts_total}) and ` +
          `advanced (${adv.fpts_total}) for player id ${id} — the two stats pages are misaligned`
      );
    }
    joined.push({
      cbsPlayerId: id,
      name: std.name,
      pos: std.pos,
      nflTeam: std.nflTeam,
      nameRaw: std.nameRaw,
      byeWeek: std.byeWeek ?? adv.byeWeek ?? null,
      // volume (standard)
      pass_att: std.pass_att, pass_cmp: std.pass_cmp, pass_yds: std.pass_yds,
      pass_td: std.pass_td, pass_int: std.pass_int,
      rush_att: std.rush_att, rush_yds: std.rush_yds, rush_td: std.rush_td,
      rec_tar: std.rec_tar, rec_rec: std.rec_rec, rec_yds: std.rec_yds, rec_td: std.rec_td,
      fumbles_lost: std.fumbles_lost,
      // first downs + 2pt (advanced)
      pass_first_downs: adv.pass_first_downs, pass_2pt: adv.pass_2pt,
      rush_first_downs: adv.rush_first_downs, rush_2pt: adv.rush_2pt,
      rec_first_downs: adv.rec_first_downs, rec_2pt: adv.rec_2pt,
      // scored totals (agreed)
      fpts_total: std.fpts_total ?? adv.fpts_total,
      fpts_avg: std.fpts_avg ?? null,
    });
  }
  for (const id of advanced.keys()) if (!standard.has(id)) onlyAdvanced.push(id);
  return { joined, onlyStandard, onlyAdvanced };
}
