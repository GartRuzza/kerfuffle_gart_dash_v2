import { ALL_COLUMN_IDS, COLUMN_LABELS } from "./views";

/**
 * Data dictionary — one entry per table column.
 *
 * Every column now describes the REAL pipeline: CBS + FantasyPros (issue #12),
 * the projection engine (#18), and the valuation engine — dollars/ceilings/market/
 * Edge (#20). No placeholders remain. Keep each `definition` under 15 words.
 */
export interface FieldDoc {
  id: string; // column id
  term: string; // display label
  definition: string; // concise, < 15 words
  deepDive: string[]; // bullets: mechanics + source
  placeholder: boolean; // content is a stub pending data discovery / engine
}

const TBD_SOURCE = "Source: the valuation engine, which is not built yet.";
const TBD_MECHANICS = 'Shows "—" until the engine lands; nothing is invented in the meantime.';

// Provisional per-field content. Fields not listed fall back to a placeholder.
const DOCS: Record<
  string,
  { definition: string; deepDive?: string[]; placeholder?: boolean }
> = {
  owner: {
    definition: "The fantasy manager who rosters the player, or FA if a free agent.",
    deepDive: [
      "Source: your CBS league rosters, as of the snapshot date in the top bar.",
      "FA = on nobody's roster. The free-agent pool comes from the FantasyPros board, so a player nobody ranks won't be listed.",
    ],
    placeholder: false,
  },
  name: {
    definition: "The NFL player's name.",
    deepDive: [
      "Source: CBS for rostered players, FantasyPros for free agents.",
      "The two sources are matched on a shared CBS player id — no name guessing.",
    ],
    placeholder: false,
  },
  pos: {
    definition: "The player's position: QB, RB, WR, TE, or DST.",
    deepDive: [
      "Shown as a color-coded badge.",
      "Source: CBS. Note this is the player's real position, not the lineup slot he's filling.",
    ],
    placeholder: false,
  },
  nflTeam: {
    definition: "The player's NFL team.",
    deepDive: ["Source: CBS for rostered players, FantasyPros for free agents."],
    placeholder: false,
  },
  opponent: {
    definition: "This week's matchup opponent — shown only in the Weekly lens.",
    deepDive: [
      "Source: FantasyPros' weekly consensus board (e.g. 'vs. TB', 'at HOU').",
      "Appears only when the Lens toggle is set to Weekly; the Rest-of-Season lens shows '—' (a season-long view has no single opponent).",
      "It's matchup context for a start/sit call — Gart Dash surfaces it beside our weekly Kerf rank and the weekly consensus; the call stays yours.",
    ],
    placeholder: false,
  },
  kerfOvrRank: {
    definition: "Our overall rank by projected KERFUFFLE points — one pool, all offense.",
    deepDive: [
      "Source: our projection engine. It takes FantasyPros' projected stat lines, estimates each player's rushing and receiving first downs (which FantasyPros doesn't project) from THAT PLAYER's own 2024+2025 first-down rate — blended toward his position's average when his sample is small (so a proven possession back is credited, while rookies lean on the position rate) — then scores the whole line with KERFUFFLE's settings.",
      "Everyone is ranked in ONE pool, so superflex naturally lifts QBs to the top — unlike a standard 1-QB board.",
      'Team defenses show "—": their scoring can\'t be projected from the offensive feed (owner decision).',
      "Tiers (the shaded bands on this sort) are grouped by natural gaps in projected points, calibrated to match FantasyPros' tier counts.",
    ],
    placeholder: false,
  },
  kerfPosRank: {
    definition: "Our rank within the player's position by projected KERFUFFLE points.",
    deepDive: [
      "Source: the same projection engine as Kerf Ovr Rank, ranked within each position.",
      'Free agents and rostered players both get a rank wherever FantasyPros projects them; defenses show "—".',
    ],
    placeholder: false,
  },
  projPts: {
    definition: "Projected KERFUFFLE points for the season — our engine's number.",
    deepDive: [
      "Source: our projection engine — FantasyPros' projected stat line, plus estimated rushing/receiving first downs (from each player's own history, blended toward his position when the sample is thin), scored with KERFUFFLE settings. This is the number the Kerf ranks and tiers are built from.",
      "Now filled for every projected offensive player, including free agents (it used to show CBS's own number for rostered players and blank for free agents).",
      'Team defenses aren\'t projected by our engine: a rostered defense still shows CBS\'s own projected points here, and a free-agent defense shows "—".',
    ],
    placeholder: false,
  },
  kerfValue: {
    definition: "The player's league-generic dollar ceiling — worth to a typical team.",
    deepDive: [
      "Source: our valuation engine (VORP). It converts projected KERFUFFLE points ABOVE positional replacement into dollars against the $500 cap.",
      "Replacement = the freely-available player at each position: RB~34, WR~34, TE~17 (the 'last starter'), and QB~30 — set at the last ROSTERED QB, because superflex forces two QB slots plus backups and QB scoring cliffs after ~QB30, so elite QBs are correctly premium.",
      "Dollars: the league's spendable money ($500 × 12, minus a $1 minimum per roster spot) is split across everyone's points-above-replacement — so prices sum to the cap and the top of each position commands the most.",
      'Team defenses show "—" (their scoring isn\'t projected from the offensive feed).',
    ],
    placeholder: false,
  },
  rosterValue: {
    definition: "The player's dollar value to the Raccoons specifically, given your roster.",
    deepDive: [
      "Source: the same VORP dollars, but measured above YOUR worst startable player at the slot he'd fill (replace-your-starter), not the league's replacement level.",
      "So a position you're thin at values a new player UP; a position you're stacked at (e.g. two strong QBs) values him DOWN — the number that matters for a trade or a roster-specific bid.",
      "Superflex-aware: a QB competes with your QB and SFLEX starters; an RB/WR/TE competes with your flex and SFLEX starters too.",
      "Falls back to the league replacement for a position your roster can't field.",
    ],
    placeholder: false,
  },
  ceiling: {
    definition: "Your own editable max bid; seeded from Kerf Value, held for the session.",
    deepDive: [
      "A place to record your max — you type it, nothing computes it.",
      "Starts from Kerf Value (the league-generic ceiling); edit it freely — the engine never overwrites your number.",
      "Resets on reload; saving ceilings for auction day comes with the auction lens.",
    ],
    placeholder: false,
  },
  edge: {
    definition: "Kerf Value minus Market (Now) — the gap you're exploiting.",
    deepDive: [
      "Green (+) when we value a player above what the market pays now — a bargain; red (−) when the market pays above our value.",
      "Derived from Kerf Value and Market (Now). Compare against Market (Auction) yourself for an auction-day view.",
    ],
    placeholder: false,
  },
  marketPrice: {
    definition: "What a player costs now — his salary if rostered, else an estimate.",
    deepDive: [
      "Rostered players show their OWN current KERFUFFLE salary — the true market price they're held at today.",
      "Free agents have no salary, so they fall back to a price curve fit from the 12 teams' current salaries ('what the Nth-best at this position costs'), read off by Kerf positional rank.",
      "This is the in-season 'what would he cost today' number; pair it with Edge. For an auction-day reference use Market (Auction) instead.",
      'Team defenses show "—" (not priced by the engine).',
    ],
    placeholder: false,
  },
  marketPreAuction: {
    definition: "What a player of this position and rank went for at the 2025 auction.",
    deepDive: [
      "Source: the same kind of price curve, fit from the 2025 KERFUFFLE salaries (including players since dropped) — the last full-auction market.",
      "Use it as the auction-day price reference; Market (Now) reflects today's rostered salaries instead.",
      "A year old and pre-season, so treat it as directional. TRUFFLE auction data is deliberately NOT used.",
    ],
    placeholder: false,
  },
  ecr: {
    definition: "Overall expert consensus rank for the active lens — lower is better.",
    deepDive: [
      "Source: FantasyPros' superflex (standard-scoring) consensus, from ~106 experts.",
      "This column reflects the ACTIVE LENS (issue #28): in-season it's the REST-OF-SEASON board — the market's view of value from here on out — and it falls back to the preseason DRAFT board until the season's ROS board differentiates.",
      "Superflex matters enormously here: because KERFUFFLE starts two QBs, quarterbacks fill the top of this board. On an ordinary 1-QB board the same players sit ~20 spots lower.",
      "Shown as a clean 1-2-3 ordering rather than the raw consensus number (which has ties).",
      "No board matches KERFUFFLE exactly — this league scores first downs, not receptions — so treat it as the market's view, not ours.",
      'Team defenses are blank ("—") here: the superflex board covers offensive players only. See Pos ECR for their ranking.',
    ],
    placeholder: false,
  },
  posEcr: {
    definition: "The player's expert consensus rank within his position, for the active lens.",
    deepDive: [
      "Source: FantasyPros' superflex board for the active lens (rest-of-season in-season, draft preseason) — e.g. WR12 = the 12th-ranked receiver.",
      "Team defenses get their DST1/DST2 rank from the 1-QB board, which is the only one that ranks them.",
      "Tier bands on this sort use the overall board's tier numbers, so the first band may not read 'Tier 1'.",
    ],
    placeholder: false,
  },
  dynastyEcr: {
    definition: "Overall dynasty consensus rank — values future seasons, not just this one.",
    deepDive: [
      "Source: FantasyPros' dynasty board, superflex. Dynasty isn't split by scoring format — there is one dynasty board per league shape.",
      "Useful against contract length: a young player on a long deal is worth more here.",
      'Blank ("—") for team defenses, same as Ovr ECR.',
    ],
    placeholder: false,
  },
  dynPosEcr: {
    definition: "The player's dynasty consensus rank within his position.",
    deepDive: ["Source: FantasyPros' superflex dynasty board (defenses come from the 1-QB board)."],
    placeholder: false,
  },
  salary: {
    definition: "What the player currently costs against your $500 cap.",
    deepDive: [
      "Source: the Salary column on your CBS roster pages.",
      'Blank ("—") for free agents (no contract) and for the rare rostered player CBS shows blank.',
      "Practice-Squad players carry normal salaries and count against the cap.",
    ],
    placeholder: false,
  },
  contractYears: {
    definition: "Years remaining on the player's contract (1 to 4).",
    deepDive: [
      "Source: the Contract column on your CBS roster pages.",
      'Blank ("—") for free agents.',
      "Each snapshot records this fresh, so contract history builds up over time.",
    ],
    placeholder: false,
  },
};

export const DATA_DICTIONARY: FieldDoc[] = ALL_COLUMN_IDS.map((id) => {
  const d = DOCS[id] ?? { definition: "TBD.", placeholder: true };
  return {
    id,
    term: COLUMN_LABELS[id] ?? id,
    definition: d.definition,
    deepDive: d.deepDive ?? [TBD_SOURCE, TBD_MECHANICS],
    placeholder: d.placeholder ?? true,
  };
});
