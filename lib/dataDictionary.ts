import { ALL_COLUMN_IDS, COLUMN_LABELS } from "./views";

/**
 * Data dictionary — one entry per table column.
 *
 * ⚠ Mostly PLACEHOLDERS for now. Real "source" and "how it's built" content is
 * deferred until data discovery (roadmap #2–3) and the valuation engine (#4–6);
 * `placeholder: true` marks entries still to be written. The structure is stable
 * so later issues just fill in the text. Keep each `definition` under 15 words.
 */
export interface FieldDoc {
  id: string; // column id
  term: string; // display label
  definition: string; // concise, < 15 words
  deepDive: string[]; // bullets: mechanics + source
  placeholder: boolean; // content is a stub pending data discovery / engine
}

const TBD_SOURCE = "Source: TBD after data discovery (roadmap #2–3).";
const TBD_MECHANICS = "How it's built: TBD after the valuation engine (roadmap #4–6).";

// Provisional per-field content. Fields not listed fall back to a placeholder.
const DOCS: Record<
  string,
  { definition: string; deepDive?: string[]; placeholder?: boolean }
> = {
  owner: {
    definition: "The fantasy manager who rosters the player, or FA if a free agent.",
    deepDive: ["Source: CBS league rosters (real data pending).", "Free agents show as FA."],
    placeholder: false,
  },
  name: {
    definition: "The NFL player's name.",
    deepDive: ["Source: CBS / FantasyPros player list (pending)."],
    placeholder: false,
  },
  pos: {
    definition: "The player's position: QB, RB, WR, or TE.",
    deepDive: ["Shown as a color-coded badge.", "Source: CBS (pending)."],
    placeholder: false,
  },
  nflTeam: {
    definition: "The player's NFL team.",
    deepDive: ["Source: CBS / FantasyPros (pending)."],
    placeholder: false,
  },
  kerfOvrRank: { definition: "Our overall player rank by KERFUFFLE value.", placeholder: true },
  kerfPosRank: { definition: "Our within-position rank by KERFUFFLE value.", placeholder: true },
  projPts: { definition: "Projected KERFUFFLE fantasy points for the player.", placeholder: true },
  kerfValue: { definition: "The player's KERFUFFLE dollar value from our engine.", placeholder: true },
  ceiling: {
    definition: "Your own editable ceiling; starts at Kerf Value, held for the session.",
    deepDive: ["A place to record your max — not computed.", "Resets on reload (prototype)."],
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
  ecr: { definition: "The player's overall expert consensus rank (market).", placeholder: true },
  posEcr: { definition: "The player's within-position expert consensus rank.", placeholder: true },
  dynastyEcr: { definition: "The player's overall dynasty expert consensus rank.", placeholder: true },
  dynPosEcr: { definition: "The player's within-position dynasty consensus rank.", placeholder: true },
  salary: { definition: "The player's current salary / cap hit, in dollars.", placeholder: true },
  contractYears: { definition: "Years remaining on the player's contract.", placeholder: true },
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
