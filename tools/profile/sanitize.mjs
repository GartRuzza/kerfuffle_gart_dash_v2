// Sanitization + field classification for the committed profile (issue #11).
//
// THE SAFETY RULE (owner decision "A", public repo): the committed profile shows
// field SHAPES, never real player/roster/market VALUES. Every field carries a
// masked example. Only fields classified as non-private *structural* enums
// (positions, roster statuses, contract lengths, transaction types, bye weeks…)
// additionally list their real distinct values — because those ARE the schema
// evidence issue #12 needs, and none of them is league-private.
//
// League *rules* (the /rules scoring config) are committed in full elsewhere;
// they are not player data and never pass through this module.
//
// Pure functions only — unit-tested in sanitize.test.mjs.

// Mask a value to its shape: A-Z -> A, a-z -> a, 0-9 -> 9, punctuation kept.
// "Ja'Marr Chase" -> "Aa'Aaaaa Aaaaa"  |  "$102" -> "$999"  |  "3 yr" -> "9 aa"
export function maskValue(str) {
  return String(str ?? "")
    .replace(/[A-Z]/g, "A")
    .replace(/[a-z]/g, "a")
    .replace(/[0-9]/g, "9");
}

// True if a masked string is provably leak-free: its only alphanumerics are
// 'a', 'A', or '9'. Any real digit (0-8) or non-a letter would fail this.
// This is the invariant the unit test enforces on every masked example.
export function isLeakFree(masked) {
  return !/[0-8b-zB-Z]/.test(String(masked ?? ""));
}

// Header substrings that mark a column as league-private -> ALWAYS masked,
// distinct values NEVER listed, regardless of cardinality.
const PRIVATE_HEADER = /player|name|owner|manager|\bteam\b|author|salary|\$|bid|price|value|cost|proj|point|pts|rank|rnk|ecr|adp|ovp|\bavg\b|yard|yds|score|owned|delta|\bmin\b|\bmax\b|\bave\b|std|tier|opp|game/i;

// A curated allowlist of NON-private STRUCTURAL enums whose real distinct values
// are schema evidence (positions, roster statuses, contract-year domain,
// transaction/ranking types, bye weeks…) and never league-private. Checked
// BEFORE the identifier/private rules, so "position_id" lists QB/RB/WR/TE even
// though it ends in _id, while "PosRnk" (→rank) stays private.
const STRUCTURAL_HEADER = /(^|_|\b)(pos|position|positions|position_id|status|bye|bye_week|effective|week|round|type|ranking_type|scoring|slot|eligibility|eligible|state|contract)(\b|_|$)/i;

const IDENTIFIER_HEADER = /(^|_)id($|_)|player_?id|cbs_player_id|_id$|filename|url|href|page/i;

export const MAX_ENUM_CARDINALITY = 15;

// Classify a field into a category that decides how it is sanitized.
//   identifier | private | structural | freeform
export function classifyField(header, { cardinality = Infinity, type = "string" } = {}) {
  const h = String(header || "").trim();
  if (!h) return "freeform";
  // Structural enums win first, but only when genuinely low-cardinality.
  if (STRUCTURAL_HEADER.test(h) && cardinality <= MAX_ENUM_CARDINALITY) return "structural";
  if (IDENTIFIER_HEADER.test(h)) return "identifier";
  if (PRIVATE_HEADER.test(h)) return "private";
  return "freeform";
}

// Whether this field may publish its real distinct values.
export function mayListDistinct(category) {
  return category === "structural";
}
