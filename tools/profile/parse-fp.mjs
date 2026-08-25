// FantasyPros JSON profiling for the profiler (issue #11, Q5).
// Records the response envelope (row count, tier, public_api_limited, experts…)
// and profiles each field on the player rows (shape only, via profileColumn).

import { profileColumn } from "./profile-core.mjs";

const ROW_KEYS = ["players", "rankings", "projections", "data", "results", "items"];

// Non-sensitive envelope metadata worth committing (API shape signals, not data).
const META_KEYS = [
  "sport", "type", "ranking_type_name", "year", "season", "week", "position_id",
  "positions", "scoring", "count", "total_experts", "last_updated",
  "public_api_limited", "tier",
];

function findRowArray(json) {
  if (Array.isArray(json)) return { key: "(root array)", rows: json };
  if (json && typeof json === "object") {
    for (const k of ROW_KEYS) if (Array.isArray(json[k])) return { key: k, rows: json[k] };
  }
  return { key: null, rows: [] };
}

// Flatten one row one level deep: nested objects (e.g. projections' `stats`)
// become `stats.<key>` columns; arrays are summarized as "[n items]".
function flattenRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) out[`${k}.${k2}`] = v2;
    } else if (Array.isArray(v)) {
      out[k] = `[${v.length} items]`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function profileFpFile(name, json, httpMeta = {}) {
  if (json == null || typeof json !== "object") {
    return { endpoint: name, ...httpMeta, parseable: false, note: "non-JSON or error body" };
  }
  const meta = {};
  for (const k of META_KEYS) if (k in json) meta[k] = json[k];

  const { key, rows } = findRowArray(json);
  const flat = rows.map(flattenRow);
  const fields = new Set();
  for (const r of flat) for (const k of Object.keys(r)) fields.add(k);

  const columns = [...fields].map((f) =>
    profileColumn(f, flat.map((r) => (r[f] == null ? "" : String(r[f]))))
  );

  return {
    endpoint: name,
    ...httpMeta,
    parseable: true,
    row_array_key: key,
    row_count: rows.length,
    field_count: columns.length,
    envelope: meta,
    columns,
  };
}
