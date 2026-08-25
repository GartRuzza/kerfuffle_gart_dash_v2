// Field-profiling core (issue #11): infer type, blank rate, cardinality, and a
// safe example for a column of raw string cells. Pure functions — unit-tested in
// profile-core.test.mjs. Source-agnostic (used for CBS table cells and, via the
// FP profiler, JSON values coerced to strings).

import { maskValue, classifyField, mayListDistinct } from "./sanitize.mjs";

// Values that count as "blank" in a CBS table cell.
const BLANK = new Set(["", "-", "--", "—", "–", "n/a", "na", "null", "undefined"]);

export function isBlank(v) {
  return BLANK.has(String(v ?? "").trim().toLowerCase());
}

// Infer the dominant type of a set of non-blank string values.
export function inferValueType(v) {
  const s = String(v ?? "").trim();
  if (s === "") return "blank";
  if (/^-?\$[\d,]+(\.\d+)?$/.test(s)) return "money";
  if (/^-?[\d,]+(\.\d+)?%$/.test(s)) return "percent";
  if (/^(true|false|yes|no)$/i.test(s)) return "boolean";
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}(\s+\d{1,2}:\d{2}\s*(am|pm)?.*)?$/i.test(s)) return "datetime";
  if (/^\d{6,}$/.test(s)) return "id"; // long digit run = CBS player id, etc.
  if (/^-?\d+$/.test(s)) return "integer";
  if (/^-?\d*\.\d+$/.test(s)) return "decimal";
  return "string";
}

// Reduce per-value types to one dominant label (+ note if mixed).
export function dominantType(values) {
  const counts = {};
  for (const v of values) {
    if (isBlank(v)) continue;
    const t = inferValueType(v);
    if (t === "blank") continue;
    counts[t] = (counts[t] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return { type: "empty", mixed: false };
  return { type: entries[0][0], mixed: entries.length > 1, breakdown: counts };
}

export function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

// Profile one column. `values` is every cell (including blanks) for the column.
export function profileColumn(header, values) {
  const total = values.length;
  const blanks = values.filter(isBlank).length;
  const nonBlank = values.filter((v) => !isBlank(v)).map((v) => String(v).trim());
  const distinct = [...new Set(nonBlank)];
  const { type, mixed, breakdown } = dominantType(nonBlank);

  const category = classifyField(header, { cardinality: distinct.length, type });

  const field = {
    field: String(header || "").trim() || "(unnamed)",
    type,
    ...(mixed ? { mixed_types: breakdown } : {}),
    category,
    cardinality: distinct.length,
    null_blank_rate_pct: pct(blanks, total),
    sample_size: total,
    example: nonBlank.length ? maskValue(nonBlank[0]) : "",
  };

  // Structural, non-private enums publish their real distinct values (sorted,
  // capped) — this is the enum evidence #12 needs (positions, statuses, …).
  if (mayListDistinct(category)) {
    field.distinct_values = distinct.slice().sort().slice(0, 30);
  }
  return field;
}

// Profile a whole table given its header names and row arrays (aligned by index).
export function profileTable(name, header, rows, extra = {}) {
  const cols = header.map((h, i) => profileColumn(h, rows.map((r) => r[i] ?? "")));
  return { table: name, row_count: rows.length, column_count: header.length, ...extra, columns: cols };
}
