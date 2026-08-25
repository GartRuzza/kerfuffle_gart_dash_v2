// CBS HTML parsing for the profiler (issue #11). Uses node-html-parser so column
// mapping is by HEADER NAME, never by position (the data_model invariant #12 also
// depends on). Extracts table shape only; the profiler downstream sanitizes values.

import { parse } from "node-html-parser";
import { clean } from "./shared.mjs";

const cells = (tr) => tr.querySelectorAll("td,th");
// Read a cell's visible text, dropping embedded <script>/<style> (some CBS cells,
// e.g. "Game Time", carry inline JS that would otherwise pollute the value).
function textOf(cell) {
  cell.querySelectorAll("script,style").forEach((s) => s.remove());
  return clean(cell.text);
}
const cellText = (tr) => cells(tr).map(textOf);
const trClass = (tr) => tr.getAttribute("class") || "";

// A row is "data" if it isn't a header/section/footer marker.
function isDataRow(tr) {
  const c = trClass(tr);
  return (
    /(^|\s)(row1|row2|playerRow)(\s|$)/.test(c) &&
    !/subtitle|superheader|footer|\blabel\b|\bempty\b/.test(c)
  );
}

// Pick the header row: the label/first row with the most cells (rosters carry a
// superheader + a column-header row; the column header has the most cells).
function pickHeader(rows) {
  const labels = rows.filter((r) => /(^|\s)label(\s|$)/.test(trClass(r)));
  const candidates = labels.length ? labels : rows.slice(0, 1);
  let best = candidates[0];
  for (const r of candidates) if (cells(r).length > cells(best).length) best = r;
  return best ? cellText(best) : [];
}

// Parse every <table> on a page into { header[], rows[][], classAttr }.
export function parseTables(html) {
  const root = parse(html);
  return root.querySelectorAll("table").map((t) => {
    const trs = t.querySelectorAll("tr");
    const header = pickHeader(trs);
    const rows = trs.filter(isDataRow).map((tr) => cellText(tr));
    return { classAttr: t.getAttribute("class") || "", header, rows };
  });
}

// The largest data table on a page (the one ingestion cares about).
export function primaryTable(html) {
  const tables = parseTables(html);
  return tables.sort((a, b) => b.rows.length * b.header.length - a.rows.length * a.header.length)[0] || null;
}

// Extract the CBS player id (8-ish digit) from a row's playerpage link, if any.
function playerIdFromRow(trEl) {
  const a = trEl.querySelector('a[href*="playerpage"]');
  if (!a) return null;
  const m = (a.getAttribute("href") || "").match(/playerpage\/(\d+)/);
  return m ? m[1] : null;
}

// Roster-report structure: sections, per-status counts, real players vs. pseudo
// rows (commissioner-added dead-cap rows have no player id), Practice Squad.
export function parseRoster(html) {
  const root = parse(html);
  const table = root.querySelectorAll("table")[0];
  if (!table) return null;
  const trs = table.querySelectorAll("tr");
  const header = pickHeader(trs);

  let section = "Active"; // rows before the first subtitle are the active lineup
  const players = []; // real player rows (have a player id)
  const pseudoRows = []; // playerRow, non-empty, non-subtitle, but NO player id
  const sections = [];

  for (const tr of trs) {
    const c = trClass(tr);
    if (/subtitle/.test(c)) {
      const label = clean(tr.text);
      if (label) {
        section = label.split(/\s{2,}| /)[0].trim() || label;
        sections.push(section);
      }
      continue;
    }
    if (!/playerRow/.test(c) || /superheader|\blabel\b|footer/.test(c)) continue;
    if (/\bempty\b/.test(c)) continue; // empty roster slot, not a player

    const id = playerIdFromRow(tr);
    const row = cellText(tr);
    // Skip rows that are effectively empty (no meaningful text)
    if (row.join("").trim() === "") continue;
    if (id) players.push({ id, section, cells: row });
    else pseudoRows.push({ section, cells: row });
  }

  // Footer totals row (Active/Reserve/Practice counts + salary), if present.
  const footer = trs.find((tr) => /footer/.test(trClass(tr)));
  const footerText = footer ? clean(footer.text) : "";

  return {
    header,
    sections,
    playerCount: players.length,
    pseudoRowCount: pseudoRows.length,
    practiceCount: players.filter((p) => /practice/i.test(p.section)).length,
    reserveCount: players.filter((p) => /reserve/i.test(p.section)).length,
    injuredCount: players.filter((p) => /injured/i.test(p.section)).length,
    activeCount: players.filter((p) => /active|starter/i.test(p.section)).length,
    players,
    pseudoRows,
    footerText,
  };
}

export { playerIdFromRow };
