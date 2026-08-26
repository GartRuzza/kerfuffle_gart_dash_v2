// CBS ingestion parsers (issue #12). Built on the profiler's proven parsing
// (tools/profile/parse-cbs.mjs) — column mapping is by HEADER NAME, never by
// position; a missing expected header is a LOUD failure (data_model invariant).
//
// Coercion is deliberate, per field (issue #12):
//   * salary  "$34"/"34" -> 34 (whole dollars). "" on a roster row is REAL
//     (observed: players awaiting salary assignment) -> null + a warning.
//     A non-integer salary is a loud failure — the league deals in whole dollars,
//     so a decimal means CBS changed something we need to look at.
//   * contract "1".."4" -> int. Anything else on a player row is a loud failure
//     (the constitution's contract-year domain).

import { createHash } from "node:crypto";
import { parse } from "node-html-parser";
import { parseRoster } from "../profile/parse-cbs.mjs";

export class IngestError extends Error {}

const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();

// ---------- header mapping ----------

// name -> index map; every `required` header must be present, or loud failure.
export function headerMap(header, required, context) {
  const map = new Map();
  header.forEach((h, i) => map.set(clean(h), i));
  for (const name of required) {
    if (!map.has(name)) {
      throw new IngestError(
        `${context}: expected column header "${name}" not found — got [${header.join(", ")}]. ` +
          `CBS changed the page; refusing to guess by position.`
      );
    }
  }
  return map;
}

// ---------- field coercion ----------

export function coerceSalary(raw, context) {
  const s = clean(raw).replace(/^\$/, "");
  if (s === "" || s === "—" || s === "-") return null; // blank = unassigned, meaningful
  if (!/^\d+$/.test(s)) {
    throw new IngestError(`${context}: salary "${raw}" is not a whole-dollar amount`);
  }
  return Number(s);
}

export function coerceContractYears(raw, context, { allowBlank = false } = {}) {
  const s = clean(raw);
  if (s === "" || s === "—" || s === "-") {
    if (allowBlank) return null;
    throw new IngestError(`${context}: contract years is blank on a player row`);
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > 4) {
    throw new IngestError(`${context}: contract years "${raw}" outside the league domain {1,2,3,4}`);
  }
  return n;
}

function coerceNumberOrNull(raw) {
  const s = clean(raw);
  if (s === "" || s === "—" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------- the Players cell: "Caleb Williams QB • CHI" / "Rams DST • LAR" ----------

const PLAYER_CELL_RE = /^(.+?)\s+(QB|RB|WR|TE|K|DST)\s*•\s*([A-Z]{2,3})\b/;

export function parsePlayersCell(raw, context) {
  const s = clean(raw);
  const m = s.match(PLAYER_CELL_RE);
  if (!m) {
    throw new IngestError(`${context}: cannot read name/position/team from players cell "${raw}"`);
  }
  return { name: m[1], pos: m[2], nflTeam: m[3] };
}

// ---------- roster report (one team) ----------

const ROSTER_REQUIRED_HEADERS = ["Pos", "Players", "Bye", "Salary", "Contract", "Proj"];
const ROSTER_SECTIONS = new Set(["Active", "Reserves", "Injured", "Practice"]);

// Footer: "Active: 10 Reserve: 7 Practice: 1 Active Salary: 389.00 Total Salary: 426.00"
function parseFooterTotals(footerText) {
  const num = (re) => {
    const m = footerText.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    totalSalary: num(/Total Salary:\s*([\d.]+)/i),
    activeSalary: num(/Active Salary:\s*([\d.]+)/i),
  };
}

export function parseRosterForIngest(html, teamId) {
  const ctx = `roster t${teamId}`;
  const roster = parseRoster(html);
  if (!roster || roster.header.length === 0) {
    throw new IngestError(`${ctx}: no parseable roster table`);
  }
  const h = headerMap(roster.header, ROSTER_REQUIRED_HEADERS, ctx);
  const warnings = [];

  const players = roster.players.map(({ id, section, cells }) => {
    if (!ROSTER_SECTIONS.has(section)) {
      throw new IngestError(`${ctx}: unknown roster section "${section}"`);
    }
    const playersCell = cells[h.get("Players")];
    const { name, pos, nflTeam } = parsePlayersCell(playersCell, ctx);
    const rowCtx = `${ctx} ${name}`;
    const salary = coerceSalary(cells[h.get("Salary")], rowCtx);
    if (salary === null) warnings.push(`${rowCtx}: blank salary on a roster row (stored as unknown, counted $0)`);
    return {
      cbsPlayerId: Number(id),
      name,
      pos,
      nflTeam,
      byeWeek: coerceNumberOrNull(cells[h.get("Bye")]),
      rosterStatus: section,
      rosterSlot: clean(cells[h.get("Pos")]) || null, // the lineup SLOT, not the position
      salary,
      contractYears: coerceContractYears(cells[h.get("Contract")], rowCtx),
      projPoints: coerceNumberOrNull(cells[h.get("Proj")]),
    };
  });

  // Rows without a player id: classify as dead-cap (owner decision 2026-08-25 —
  // a team-level cap amount, no player attached) IF they carry a salary;
  // anything else unrecognized is a loud failure, not a silent skip.
  const deadCap = roster.pseudoRows.map(({ section, cells }) => {
    const label = clean(cells[h.get("Players")] ?? cells.join(" "));
    const rowCtx = `${ctx} dead-cap row "${label}"`;
    const salary = coerceSalary(cells[h.get("Salary")] ?? "", rowCtx);
    if (salary === null) {
      throw new IngestError(
        `${ctx}: roster row "${label}" has no player id and no salary — not a player, ` +
          `not recognizably dead cap. Refusing to classify silently.`
      );
    }
    return {
      label,
      rosterStatus: ROSTER_SECTIONS.has(section) ? section : "Reserves",
      salary,
      contractYears: coerceContractYears(cells[h.get("Contract")] ?? "", rowCtx, { allowBlank: true }),
    };
  });

  return { players, deadCap, footer: parseFooterTotals(roster.footerText), warnings };
}

// ---------- standings: the 12 teams + divisions ----------

export function parseStandingsTeams(html) {
  const root = parse(html);
  const teams = [];
  let division = null;
  const seen = new Set();
  for (const tr of root.querySelectorAll("table tr")) {
    const text = clean(tr.text);
    const link = tr.querySelector('a[href*="/teams/"]');
    if (!link) {
      if (/Division$/.test(text)) division = text;
      continue;
    }
    const m = (link.getAttribute("href") || "").match(/\/teams\/(\d+)\b/);
    if (!m) continue;
    const teamId = Number(m[1]);
    if (seen.has(teamId)) continue; // standings can list a team in several tables
    seen.add(teamId);
    teams.push({ teamId, name: clean(link.text), division });
  }
  return teams;
}

// ---------- transaction log ----------

const TX_REQUIRED_HEADERS = ["Date", "Team", "Players", "Effective"];

// "DJ Giddens RB • IND - Dropped" -> "Dropped" (best-effort; CBS has no type column)
function inferTxType(playersText) {
  const m = clean(playersText).match(/-\s*([A-Za-z][A-Za-z ]{2,30})$/);
  return m ? m[1].trim() : null;
}

export function txNaturalKey(row) {
  return createHash("sha1")
    .update([row.date, row.team, row.players, row.effective].join("|"))
    .digest("hex");
}

// Parse one archived transactions page (works for the default page, ?start_row=N
// pages, and the ?print_rows=9999 print-all view — same table shape).
export function parseTransactionsPage(html, context) {
  const root = parse(html);
  for (const t of root.querySelectorAll("table")) {
    const trs = t.querySelectorAll("tr");
    const label = trs.find((tr) => /(^|\s)label(\s|$)/.test(tr.getAttribute("class") || ""));
    if (!label) continue;
    const header = label.querySelectorAll("td,th").map((c) => clean(c.text));
    if (!TX_REQUIRED_HEADERS.every((x) => header.includes(x))) continue;
    const h = headerMap(header, TX_REQUIRED_HEADERS, context);
    const rows = [];
    for (const tr of trs) {
      if (!/(^|\s)(row1|row2)(\s|$)/.test(tr.getAttribute("class") || "")) continue;
      const cells = tr.querySelectorAll("td,th").map((c) => {
        c.querySelectorAll("script,style").forEach((s) => s.remove());
        return clean(c.text);
      });
      const row = {
        date: cells[h.get("Date")],
        team: cells[h.get("Team")],
        players: cells[h.get("Players")],
        effective: cells[h.get("Effective")],
      };
      if (!row.date || !row.players) continue; // pager/footer chrome rows
      rows.push({ ...row, inferredType: inferTxType(row.players), naturalKey: txNaturalKey(row) });
    }
    return rows;
  }
  throw new IngestError(`${context}: no transactions table with headers ${TX_REQUIRED_HEADERS.join("/")}`);
}

// "8/22/26 5:42 AM ET" -> "2026-08-22T05:42" (sortable); unparseable dates kept verbatim.
export function normalizeTxDate(raw) {
  const m = clean(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i);
  if (!m) return clean(raw);
  const [, mo, day, yr, hh, mm, ap] = m;
  const year = yr.length === 2 ? `20${yr}` : yr;
  let hour = hh ? Number(hh) % 12 : 0;
  if (ap && ap.toUpperCase() === "PM") hour += 12;
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(mo)}-${pad(day)}T${pad(hour)}:${hh ? mm : "00"}`;
}
