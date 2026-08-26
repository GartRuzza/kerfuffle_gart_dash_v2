import { ALL_COLUMN_IDS, COLUMN_LABELS } from "./views";

/**
 * Data dictionary — one entry per table column.
 *
 * Sourced fields (CBS + FantasyPros) now describe the REAL pipeline (issue #12).
 * The remaining `placeholder: true` entries are the ENGINE outputs, which show
 * "—" in the table because the valuation engine does not exist yet — their text
 * gets written with it. Keep each `definition` under 15 words.
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
  kerfOvrRank: { definition: "Our overall player rank by KERFUFFLE value.", placeholder: true },
  kerfPosRank: { definition: "Our within-position rank by KERFUFFLE value.", placeholder: true },
  projPts: {
    definition: "CBS's own projected KERFUFFLE points for the season.",
    deepDive: [
      "Source: the Proj column on your CBS roster pages — already scored with KERFUFFLE settings.",
      'Blank ("—") for free agents: their CBS projections live on a page we don\'t capture yet.',
      "This is CBS's number, not ours. Our own projection arrives with the engine.",
    ],
    placeholder: false,
  },
  kerfValue: { definition: "The player's KERFUFFLE dollar value from our engine.", placeholder: true },
  ceiling: {
    definition: "Your own editable max bid; seeded from Kerf Value, held for the session.",
    deepDive: [
      "A place to record your max — you type it, nothing computes it.",
      "Starts blank because it fills from Kerf Value, which needs the engine.",
      "Resets on reload; saving ceilings for auction day comes with the auction lens.",
    ],
    placeholder: false,
  },
  edge: {
    definition: "Kerf Value minus Market Value — the gap you're exploiting.",
    deepDive: [
      "Green when we value a player above the market, red below.",
      "Derived from Kerf Value and Market Value.",
    ],
    placeholder: false,
  },
  marketPrice: { definition: "What the league is expected to pay for the player.", placeholder: true },
  ecr: {
    definition: "Overall expert consensus rank, on a superflex board — lower is better.",
    deepDive: [
      "Source: FantasyPros' draft board — standard scoring, SUPERFLEX — from ~106 experts.",
      "Superflex matters enormously here: because KERFUFFLE starts two QBs, quarterbacks fill the top of this board. On an ordinary 1-QB board the same players sit ~20 spots lower.",
      "Shown as a clean 1-2-3 ordering rather than the raw consensus number (which has ties).",
      "No board matches KERFUFFLE exactly — this league scores first downs, not receptions — so treat it as the market's view, not ours.",
      'Team defenses are blank ("—") here: the superflex board covers offensive players only. See Pos ECR for their ranking.',
    ],
    placeholder: false,
  },
  posEcr: {
    definition: "The player's expert consensus rank within his position.",
    deepDive: [
      "Source: FantasyPros' superflex draft board (e.g. WR12 = the 12th-ranked receiver).",
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
