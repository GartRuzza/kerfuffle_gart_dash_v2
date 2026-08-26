// FantasyPros ingestion parsing (issue #12). The archived payloads are already
// JSON; this normalizes one consensus-rankings payload into market_ranking rows.
//
// IMPORTANT: ranking_type and scoring_format come from the PAYLOAD's own
// declaration, not the file name — the dynasty board is scoring-agnostic and
// declares itself PPR whatever scoring was requested (observed: the ...-std and
// ...-ppr dynasty files are byte-identical). Trusting the payload also means two
// archived files that are really the same board dedupe onto one grain.

import { IngestError } from "./parse-cbs-ingest.mjs";

const RANKING_TYPES = { draft: "draft", dynasty: "dynasty", ros: "ros", weekly: "weekly" };
const SCORING = new Set(["STD", "HALF", "PPR"]);

export function mapFpBoard(json, sourceEndpoint) {
  // ranking_type_name is the machine field ("draft"/"dynasty"/"weekly"); `type`
  // is a display label ("Draft PPR"). Fall back to the label's first word.
  const typeRaw = String(json.ranking_type_name || json.type || "").toLowerCase();
  const type = RANKING_TYPES[typeRaw] ?? RANKING_TYPES[typeRaw.split(/\s+/)[0]];
  if (!type) {
    throw new IngestError(`${sourceEndpoint}: unknown FP ranking type "${json.ranking_type_name ?? json.type}"`);
  }
  const scoring = String(json.scoring || "").toUpperCase();
  if (!SCORING.has(scoring)) {
    throw new IngestError(`${sourceEndpoint}: unknown FP scoring format "${json.scoring}"`);
  }
  const players = Array.isArray(json.players) ? json.players : [];
  if (players.length === 0) {
    throw new IngestError(`${sourceEndpoint}: FP board has no players — expected a full HOF board`);
  }

  const rows = players.map((p) => ({
    fpPlayerId: toNum(p.player_id),
    cbsPlayerId: p.cbs_player_id != null && String(p.cbs_player_id).match(/^\d+$/)
      ? Number(p.cbs_player_id)
      : null,
    playerName: String(p.player_name || ""),
    playerPos: String(p.player_position_id || "").toUpperCase(),
    playerTeam: p.player_team_id ? String(p.player_team_id) : null,
    byeWeek: p.player_bye_week != null && String(p.player_bye_week).match(/^\d+$/)
      ? Number(p.player_bye_week)
      : null,
    rankEcr: toNum(p.rank_ecr),
    posRank: p.pos_rank ? String(p.pos_rank) : null,
    tier: toNum(p.tier),
    rankMin: toNum(p.rank_min),
    rankMax: toNum(p.rank_max),
    rankAve: toNum(p.rank_ave),
    rankStd: toNum(p.rank_std),
  }));

  const seenCbsIds = new Map();
  for (const r of rows) {
    // Both are required. They go through toNum, so a null/blank stays null here
    // rather than becoming 0 — which for rank_ecr would read as the best rank
    // on the board.
    if (r.fpPlayerId === null || r.rankEcr === null) {
      throw new IngestError(`${sourceEndpoint}: FP row missing player_id/rank_ecr (${r.playerName || "?"})`);
    }
    // The board grain is keyed on FP's own id, but the UI joins on cbs_player_id —
    // two FP entries sharing one CBS id would duplicate that player in the table.
    if (r.cbsPlayerId !== null) {
      const first = seenCbsIds.get(r.cbsPlayerId);
      if (first !== undefined) {
        throw new IngestError(
          `${sourceEndpoint}: two FantasyPros entries share cbs_player_id ${r.cbsPlayerId} ` +
            `("${first}" and "${r.playerName}") — that player would appear twice in the table`
        );
      }
      seenCbsIds.set(r.cbsPlayerId, r.playerName);
    }
  }

  return {
    rankingType: type,
    scoringFormat: scoring,
    positionScope: String(json.position_id || "ALL").toUpperCase(),
    week: type === "weekly" && json.week != null ? String(json.week) : null,
    totalExperts: Number.isFinite(Number(json.total_experts)) ? Number(json.total_experts) : null,
    sourceEndpoint,
    rows,
  };
}

// "Unknown" must stay unknown. Number(null) and Number("") are both 0, so a
// naive Number() turns FantasyPros' nulls (an untiered player, a single-vote
// player with no expert spread) into a real-looking 0 — which would render a
// "Tier 0" band and hand the engine a spread of 0 meaning "perfect consensus".
function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
