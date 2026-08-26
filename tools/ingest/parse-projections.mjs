// FantasyPros PROJECTIONS parsing (issue #18). The archived payload is already
// JSON; this normalizes one projections payload into projection_source rows —
// the raw projected stat line the engine translates into KERFUFFLE points.
//
// KEY FACTS about this feed (verified against the live HOF payload):
//   * It carries component stats (pass/rush/rec att/yds/tds, receptions, fumbles)
//     but NO first downs and NO per-reception scoring — first downs are the
//     league's edge and are ESTIMATED downstream by the engine (D-14).
//   * It carries `fpid` (FantasyPros' own id), NOT cbs_player_id. The join to CBS
//     is bridged in ingestion via player.fp_player_id (populated from the ECR
//     boards, which DO carry cbs_player_id).
//   * `points`/`points_ppr`/`points_half` are FantasyPros' OWN scoring, never
//     KERFUFFLE — kept only as fp_points reference; the engine recomputes.

import { IngestError } from "./parse-cbs-ingest.mjs";

// "Unknown stays unknown" for ids; projected stats coerce to 0 (a missing
// projected category genuinely means zero projected volume, unlike a null rank).
function num(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function idOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map a FantasyPros projections payload to normalized rows. Returns the season,
 * week (0 = full season), and the per-player projected stat lines. Kickers are
 * dropped (this league rosters none); DST rows are dropped here too — their
 * projection is defensive-category, which the offensive engine does not score,
 * so defenses render "—" for Kerf (owner decision, 2026-08-26).
 */
export function mapProjections(json, sourceEndpoint) {
  const players = Array.isArray(json.players) ? json.players : [];
  if (players.length === 0) {
    throw new IngestError(`${sourceEndpoint}: projections payload has no players — expected a full HOF feed`);
  }
  const season = idOrNull(json.season);
  if (season === null) throw new IngestError(`${sourceEndpoint}: projections payload has no season`);
  const week = idOrNull(json.week) ?? 0;

  const KEEP = new Set(["QB", "RB", "WR", "TE"]);
  const rows = [];
  for (const p of players) {
    const pos = String(p.position_id || "").toUpperCase();
    if (!KEEP.has(pos)) continue; // exclude K and DST
    const fpId = idOrNull(p.fpid);
    if (fpId === null) {
      throw new IngestError(`${sourceEndpoint}: projection row missing fpid (${p.name || "?"})`);
    }
    const s = p.stats || {};
    rows.push({
      fpPlayerId: fpId,
      playerName: String(p.name || ""),
      pos,
      nflTeam: p.team_id ? String(p.team_id) : null,
      season,
      week,
      pass_att: num(s.pass_att),
      pass_cmp: num(s.pass_cmp),
      pass_yds: num(s.pass_yds),
      pass_td: num(s.pass_tds),
      pass_int: num(s.pass_ints),
      rush_att: num(s.rush_att),
      rush_yds: num(s.rush_yds),
      rush_td: num(s.rush_tds),
      rec_rec: num(s.rec_rec),
      rec_yds: num(s.rec_yds),
      rec_td: num(s.rec_tds),
      fumbles: num(s.fumbles),
      two_pt: num(s["2pt_tds"]),
      fpPoints: idOrNull(s.points), // FantasyPros' own points — reference only
    });
  }
  if (rows.length === 0) {
    throw new IngestError(`${sourceEndpoint}: projections payload had no QB/RB/WR/TE rows`);
  }

  // fpid is the grain key within one payload; a duplicate would double-count a
  // player in the engine pool. Refuse loudly rather than silently overwrite.
  const seen = new Map();
  for (const r of rows) {
    const first = seen.get(r.fpPlayerId);
    if (first !== undefined) {
      throw new IngestError(
        `${sourceEndpoint}: two projection rows share fpid ${r.fpPlayerId} ("${first}" and "${r.playerName}")`
      );
    }
    seen.set(r.fpPlayerId, r.playerName);
  }

  return { season, week, rows };
}
