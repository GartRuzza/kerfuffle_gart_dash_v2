// Name -> cbs_player_id matcher for the historical CSVs (issue #17).
//
// The CBS stat files and the KERFUFFLE contract sheet are NAME-keyed; our `player`
// table is CBS-id-keyed. We match name (+ position, + NFL team as a tiebreak)
// against the player universe and REPORT unmatched rows loudly — never drop them
// silently (issue #17 acceptance criterion). The TRUFFLE file already carries a
// CBS PlayerID and does not use this matcher.

// Names that don't normalize to an equal string across sources. Curated by hand
// (some resolved via web search, 2026-08-26) — maps a NORMALIZED source name to
// the exact cbs_player_id it should resolve to. Keep the human-readable note.
export const ALIASES = {
  // normalizedSourceName: { id: <cbs_player_id>, note: "..." },
  "josh palmer": { id: 2867325, note: "sheet 'Josh Palmer' = universe 'Joshua Palmer' (WR)" },
  "marquise brown": { id: 2804128, note: "sheet 'Marquise Brown' = universe 'Hollywood Brown' (WR)" },
};

// Strip generational suffixes, punctuation, accents, and casing so
// "Ja'Marr Chase" == "jamarr chase", "Michael Pittman Jr." == "michael pittman".
export function normalizeName(name) {
  return (name ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // strip accents
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")          // generational suffixes
    .replace(/[.'`’\-,]/g, "")                       // punctuation (incl. smart quote)
    .replace(/\s+/g, " ")
    .trim();
}

// Build a lookup over the player universe. Keyed primarily by normalized name;
// each key holds every candidate so we can disambiguate by pos/team.
export function buildPlayerIndex(db) {
  const players = db.prepare(`SELECT cbs_player_id, name, pos, nfl_team FROM player`).all();
  const byName = new Map();      // normName -> [candidates]
  const byNamePos = new Map();   // normName|pos -> [candidates]
  const dstByTeam = new Map();   // NFL team abbrev -> the DST player
  for (const p of players) {
    const nn = normalizeName(p.name);
    if (!byName.has(nn)) byName.set(nn, []);
    byName.get(nn).push(p);
    const kp = `${nn}|${p.pos}`;
    if (!byNamePos.has(kp)) byNamePos.set(kp, []);
    byNamePos.get(kp).push(p);
    if (p.pos === "DST" && p.nfl_team) dstByTeam.set(p.nfl_team.toUpperCase(), p);
  }
  return { byName, byNamePos, dstByTeam, size: players.length };
}

// Resolve one {name, pos, nflTeam} to a cbs_player_id, or null.
// Returns { id, how } where `how` explains the match (for reporting/debugging).
export function matchPlayer({ name, pos, nflTeam }, index) {
  const nn = normalizeName(name);

  // 0) explicit alias override wins
  const alias = ALIASES[nn];
  if (alias) return { id: alias.id, how: `alias(${alias.note})` };

  // 0b) team defenses: our universe names them by full city+nickname, the
  // KERFUFFLE sheet by nickname only — match a DST row by its NFL team instead.
  if (pos === "DST" && nflTeam) {
    const d = index.dstByTeam.get(nflTeam.toUpperCase());
    if (d) return { id: d.cbs_player_id, how: "dst+team" };
  }

  // 1) unique name+position match (the common case)
  if (pos) {
    const kp = `${nn}|${pos}`;
    const cands = index.byNamePos.get(kp);
    if (cands && cands.length === 1) return { id: cands[0].cbs_player_id, how: "name+pos" };
    if (cands && cands.length > 1 && nflTeam) {
      const t = cands.filter((c) => (c.nfl_team ?? "").toUpperCase() === nflTeam.toUpperCase());
      if (t.length === 1) return { id: t[0].cbs_player_id, how: "name+pos+team" };
    }
  }

  // 2) name match, still respecting position when the source has one. Two players
  // who share a name but differ in position are DIFFERENT people (e.g. Josh Johnson
  // QB vs Josh Johnson WR) — matching across positions here would silently merge
  // them. We only relax position when the source pos is unknown.
  const posOk = (c) => !pos || !c.pos || c.pos === pos;
  const byName = (index.byName.get(nn) ?? []).filter(posOk);
  if (byName.length === 1) return { id: byName[0].cbs_player_id, how: "name" };
  if (byName.length > 1 && nflTeam) {
    const t = byName.filter((c) => (c.nfl_team ?? "").toUpperCase() === nflTeam.toUpperCase());
    if (t.length === 1) return { id: t[0].cbs_player_id, how: "name+team" };
  }

  return { id: null, how: byName.length > 1 ? "ambiguous" : "unmatched" };
}
