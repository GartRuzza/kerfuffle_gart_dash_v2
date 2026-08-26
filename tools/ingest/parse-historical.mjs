// Historical CSV parsers (issue #17). Owner-provided manual exports in
// data/historical/ — separate from the archiver's fetched HTML.
//
// The CBS stat files have a 3-row header (title / group / column) with GROUPED,
// positionally-SHIFTED columns: the header rows do not align 1:1 with the data
// rows. We therefore map data by fixed column index (derived and verified against
// known values) and ASSERT anchors + cross-file FPTS agreement at parse time — a
// layout drift fails loudly rather than silently misaligning. See
// data/historical/README.md and docs/data_model.md.

import { IngestError } from "./parse-cbs-ingest.mjs";

const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();

// ---------- minimal RFC-4180 CSV ----------
// Node has no built-in CSV, and the TRUFFLE file embeds quoted JSON containing
// commas, so a naive split is wrong. This handles quotes and escaped quotes.

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  // flush last field/row (unless the file ended on a clean newline)
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// ---------- the stat-file player cell: "Christian McCaffrey RB | SF" ----------

const STAT_PLAYER_RE = /^(.+?)\s+(QB|RB|WR|TE|K|DST)\s*\|\s*([A-Z]{2,3})\b/;

export function parseStatPlayerCell(raw) {
  const s = clean(raw);
  const m = s.match(STAT_PLAYER_RE);
  if (!m) return null; // not a data row (title/footer/blank) — caller skips it
  return { name: clean(m[1]), pos: m[2], nflTeam: m[3], raw: s };
}

const int = (raw) => {
  const s = clean(raw).replace(/,/g, "");
  if (s === "" || s === "—" || s === "-") return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
};
const num = (raw) => {
  const s = clean(raw).replace(/,/g, "");
  if (s === "" || s === "—" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// Fixed column indices, verified against the anchors (Josh Allen 2025:
// pass_fd=177 @8, rush_fd=46 @11; Chase 2025: rec_fd=73 @14; FPTS avg/total are
// the last two columns @16/@17). Passing & rushing carry a per-group "Avg" col
// (10, 13) we do not store; receiving does not before the FPTS group.
const ADV = {
  bye: 4, pass_fd: 8, pass_2pt: 9, rush_fd: 11, rush_2pt: 12,
  rec_fd: 14, rec_2pt: 15, fpts_avg: 16, fpts_total: 17,
};
const STD = {
  bye: 4, pass_att: 7, pass_cmp: 8, pass_yds: 9, pass_td: 10, pass_int: 11,
  rush_att: 12, rush_yds: 13, rush_td: 14,
  rec_tar: 15, rec_rec: 16, rec_yds: 17, rec_td: 18,
  fumbles_lost: 19, fpts_avg: 20, fpts_total: 21,
};

// Parse one stat file -> Map keyed by the raw player cell string. `kind` is
// 'advanced' | 'standard'. Rows whose player cell doesn't parse (title, group,
// column-header, footer) are skipped.
export function parseStatFile(csvText, { kind, context }) {
  const rows = parseCsv(csvText);
  // Locate the column-header row so we can sanity-check the file is the shape we expect.
  const headerRow = rows.find((r) =>
    kind === "advanced" ? r.includes("1stD") : (r.includes("ATT") && r.includes("Comp"))
  );
  if (!headerRow) {
    throw new IngestError(`${context}: could not find the ${kind} column-header row — not the expected CBS export`);
  }
  const cols = kind === "advanced" ? ADV : STD;
  const out = new Map();
  for (const r of rows) {
    const cell = parseStatPlayerCell(r[1] ?? "");
    if (!cell) continue;
    const pick = (name) => r[cols[name]];
    const rec = { player: cell, byeWeek: num(pick("bye")) };
    if (kind === "advanced") {
      Object.assign(rec, {
        pass_first_downs: int(pick("pass_fd")), pass_2pt: int(pick("pass_2pt")),
        rush_first_downs: int(pick("rush_fd")), rush_2pt: int(pick("rush_2pt")),
        rec_first_downs: int(pick("rec_fd")), rec_2pt: int(pick("rec_2pt")),
        fpts_avg: num(pick("fpts_avg")), fpts_total: num(pick("fpts_total")),
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
    // Duplicate player cell within one file = a real problem (parser drift).
    if (out.has(cell.raw)) throw new IngestError(`${context}: duplicate player row "${cell.raw}"`);
    out.set(cell.raw, rec);
  }
  if (out.size === 0) throw new IngestError(`${context}: no data rows parsed`);
  return out;
}

// Join the advanced + standard files for one season, keyed on the player cell.
// Asserts the two files agree on FPTS Total per player (the core alignment check)
// and optionally verifies caller-supplied anchor first downs. Returns joined rows.
export function joinSeason({ advanced, standard, season, anchors = [] }) {
  const FPTS_EPS = 0.05; // whole-dollar-ish scored totals; they should match to the cent
  const joined = [];
  const onlyAdvanced = [];
  for (const [key, adv] of advanced) {
    const std = standard.get(key);
    if (!std) { onlyAdvanced.push(key); continue; }
    if (adv.fpts_total != null && std.fpts_total != null &&
        Math.abs(adv.fpts_total - std.fpts_total) > FPTS_EPS) {
      throw new IngestError(
        `${season}: FPTS Total disagrees between advanced (${adv.fpts_total}) and ` +
          `standard (${std.fpts_total}) for "${key}" — the two files are misaligned`
      );
    }
    joined.push({
      season,
      player: adv.player,
      byeWeek: adv.byeWeek ?? std.byeWeek ?? null,
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
      fpts_avg: std.fpts_avg ?? adv.fpts_avg,
    });
  }
  // Anchor assertions: name substring -> {field: value}
  for (const a of anchors) {
    const hit = joined.find((j) => j.player.name.toLowerCase().includes(a.name.toLowerCase()));
    if (!hit) throw new IngestError(`${season}: anchor player "${a.name}" not found — cannot verify alignment`);
    for (const [field, val] of Object.entries(a.expect)) {
      if (hit[field] !== val) {
        throw new IngestError(
          `${season}: anchor check FAILED — ${a.name} ${field} = ${hit[field]}, expected ${val}. ` +
            `The stat-file column layout has drifted; refusing to ingest misaligned data.`
        );
      }
    }
  }
  return { joined, onlyAdvanced };
}

// ---------- KERFUFFLE contract sheet ----------
// Columns: Pos, Player, TRF, Age, NFL, Salary, Yr, '24, '25, '26, '27, '28
// Only the 2025 salary is authoritative (owner, 2026-08-26).

export function parseContracts(csvText, { context }) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new IngestError(`${context}: empty file`);
  const header = rows[0].map(clean);
  const idx = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new IngestError(`${context}: expected column "${name}" — got [${header.join(", ")}]`);
    return i;
  };
  const c = {
    pos: idx("Pos"), player: idx("Player"), trf: idx("TRF"), age: idx("Age"),
    nfl: idx("NFL"), salary: idx("Salary"), yr: idx("Yr"), y25: idx("'25"),
  };
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r[c.player]);
    if (!name) continue;
    const cell25 = clean(r[c.y25]);
    const isFT = /^FT$/i.test(cell25);
    const isFA = /^FA$/i.test(cell25);
    // Only the '25 cell is authoritative for the 2025 salary (owner, 2026-08-26).
    // A non-numeric cell (FT / FA / blank) means no plain 2025 salary → null + a flag;
    // we deliberately do NOT fall back to the generic "Salary" column (which can be a
    // stale/other-year figure).
    const salary = /^\d+$/.test(cell25) ? Number(cell25) : null;
    const yr = clean(r[c.yr]);
    const pos = clean(r[c.pos]) || null;
    out.push({
      season: 2025,
      name,
      pos,
      isDeadCap: pos === "DC" || /dead\s*cap/i.test(name),  // a cap obligation, not a player
      trfTeam: clean(r[c.trf]) || null,
      nflTeam: clean(r[c.nfl]) || null,
      age: /^\d+$/.test(clean(r[c.age])) ? Number(clean(r[c.age])) : null,
      salary,
      contractYears: /^\d+$/.test(yr) ? Number(yr) : null,
      isFranchiseTag: isFT ? 1 : 0,
      isFreeAgent: isFA ? 1 : 0,
      scheduleRaw: JSON.stringify(header.reduce((o, h, j) => ((o[h] = clean(r[j])), o), {})),
    });
  }
  if (out.length === 0) throw new IngestError(`${context}: no contract rows parsed`);
  return out;
}

// ---------- TRUFFLE 2026 auction (already carries a CBS PlayerID) ----------

export function parseTruffle(csvText, { context }) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new IngestError(`${context}: empty file`);
  const header = rows[0].map(clean);
  const idx = (name) => {
    const i = header.indexOf(name);
    if (i < 0) throw new IngestError(`${context}: expected column "${name}" — got [${header.join(", ")}]`);
    return i;
  };
  const c = {
    season: idx("Season"), lg: idx("TrfLg"), tm: idx("TrfTm"), nom: idx("NominationOrder"),
    player: idx("Player"), pid: idx("PlayerID"), pos: idx("Pos"), nfl: idx("NFL"),
    salary: idx("Salary"), bids: idx("BidHistory"),
  };
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = clean(r[c.player]);
    if (!name) continue;
    const pidRaw = clean(r[c.pid]);
    const pid = /^\d+(\.0+)?$/.test(pidRaw) ? Math.round(Number(pidRaw)) : null;
    const salRaw = clean(r[c.salary]);
    const nomRaw = clean(r[c.nom]);
    const seasonRaw = clean(r[c.season]);
    let bids = clean(r[c.bids]);
    // keep verbatim, but validate it is parseable JSON so we don't store garbage
    if (bids) { try { JSON.parse(bids); } catch { throw new IngestError(`${context}: row ${i} BidHistory is not valid JSON`); } }
    out.push({
      league: clean(r[c.lg]) || "TRUFFLE",
      season: /^\d+/.test(seasonRaw) ? Math.round(Number(seasonRaw)) : 2026,
      cbsPlayerId: pid,
      playerName: name,
      pos: clean(r[c.pos]) || null,
      nflTeam: clean(r[c.nfl]) || null,
      winningTeam: clean(r[c.tm]) || null,
      finalSalary: /^\d+(\.0+)?$/.test(salRaw) ? Math.round(Number(salRaw)) : null,
      nominationOrder: /^\d+(\.0+)?$/.test(nomRaw) ? Math.round(Number(nomRaw)) : null,
      bidHistoryJson: bids || null,
    });
  }
  if (out.length === 0) throw new IngestError(`${context}: no auction rows parsed`);
  return out;
}
