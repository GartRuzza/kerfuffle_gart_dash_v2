import { FREE_AGENT, MY_TEAM, type PositionFilter } from "./types";

/**
 * Saved views: a named bundle of table settings (which columns show, their order,
 * the sort, and the filters). Default views are built-in read-only presets that
 * mirror the user-flow use cases; custom views are user-created and persisted in
 * localStorage. See docs/architecture.md and decision_log D-05.
 */

/** Roster dropdown value: everyone, free agents only, or a specific team name. */
export const ROSTER_ALL = "ALL";
export const ROSTER_FA = FREE_AGENT; // "FA"

export interface SortSpec {
  id: string;
  desc: boolean;
}

export interface ViewState {
  roster: string; // ROSTER_ALL | ROSTER_FA | team name
  includeFA: boolean; // fold free agents into ALL / team views
  position: PositionFilter;
  sorting: SortSpec[];
  columnOrder: string[]; // full ordering of all column ids
  hiddenColumns: string[]; // column ids that are hidden
}

export interface SavedView {
  id: string;
  name: string;
  builtIn: boolean;
  state: ViewState;
}

/** Canonical full column order. The "Player" column is always visible. */
export const ALL_COLUMN_IDS = [
  "owner",
  "name",
  "pos",
  "nflTeam",
  "kerfOvrRank",
  "kerfPosRank",
  "projPts",
  "kerfValue",
  "ceiling",
  "edge",
  "marketPrice",
  "ecr",
  "posEcr",
  "dynastyEcr",
  "dynPosEcr",
  "salary",
  "contractYears",
] as const;

/** Human labels for the column picker (keep in sync with columns.tsx headers). */
export const COLUMN_LABELS: Record<string, string> = {
  owner: "Owner",
  name: "Player",
  pos: "Pos",
  nflTeam: "Team",
  kerfOvrRank: "Kerf Ovr Rank",
  kerfPosRank: "Kerf Pos Rank",
  projPts: "Proj Points",
  kerfValue: "Kerf Value",
  ceiling: "Ceiling",
  edge: "Edge",
  marketPrice: "Market Value",
  ecr: "Ovr ECR",
  posEcr: "Pos ECR",
  dynastyEcr: "Dyn Ovr ECR",
  dynPosEcr: "Dyn Pos ECR",
  salary: "Salary",
  contractYears: "Contract",
};

/** Column that can never be hidden (identity anchor). */
export const ALWAYS_VISIBLE = "name";

const DEFAULT_SORT: SortSpec[] = [{ id: "kerfOvrRank", desc: false }];

/** Build a ViewState from a list of visible columns + overrides. */
function makeState(visible: string[], overrides: Partial<ViewState> = {}): ViewState {
  const visibleSet = new Set(visible);
  return {
    roster: ROSTER_ALL,
    includeFA: true,
    position: "ALL",
    sorting: DEFAULT_SORT,
    columnOrder: [...ALL_COLUMN_IDS],
    hiddenColumns: ALL_COLUMN_IDS.filter((id) => !visibleSet.has(id)),
    ...overrides,
  };
}

/** Built-in views mirroring the user-flow use cases. */
export const DEFAULT_VIEWS: SavedView[] = [
  {
    id: "view-full",
    name: "Full",
    builtIn: true,
    state: makeState([...ALL_COLUMN_IDS]),
  },
  {
    id: "view-auction",
    name: "Auction Prep",
    builtIn: true,
    state: makeState(
      [
        "name", "pos", "nflTeam", "kerfOvrRank", "kerfPosRank", "projPts",
        "kerfValue", "ceiling", "edge", "marketPrice", "ecr", "salary", "contractYears",
      ],
      { roster: ROSTER_FA },
    ),
  },
  {
    id: "view-waivers",
    name: "Waivers",
    builtIn: true,
    state: makeState(
      [
        "name", "pos", "nflTeam", "kerfOvrRank", "kerfPosRank", "projPts",
        "kerfValue", "edge", "marketPrice", "ecr", "salary",
      ],
      { roster: ROSTER_FA },
    ),
  },
  {
    id: "view-trades",
    name: "Trades",
    builtIn: true,
    state: makeState(
      [
        "owner", "name", "pos", "nflTeam", "kerfOvrRank", "projPts", "kerfValue",
        "marketPrice", "dynastyEcr", "salary", "contractYears",
      ],
      { roster: ROSTER_ALL, includeFA: false },
    ),
  },
  {
    id: "view-startsit",
    name: "Start/Sit",
    builtIn: true,
    state: makeState(
      ["name", "pos", "nflTeam", "kerfOvrRank", "kerfPosRank", "projPts", "kerfValue"],
      { roster: MY_TEAM },
    ),
  },
];

/** The view shown on load. */
export const DEFAULT_VIEW_ID = "view-full";

// --- localStorage (custom views only; browser-local, single user) ---
const STORAGE_KEY = "gartdash.customViews.v1";

export function loadCustomViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomViews(views: SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {
    /* ignore quota / disabled storage */
  }
}

/** Deterministic-enough id for a new custom view (no Date.now/random needed). */
export function nextCustomViewId(existing: SavedView[]): string {
  const n = existing.filter((v) => !v.builtIn).length + 1;
  return `view-custom-${n}-${existing.length}`;
}

/** Column visibility map (TanStack shape) from a view's hidden list. */
export function visibilityFromHidden(hidden: string[]): Record<string, boolean> {
  const hiddenSet = new Set(hidden);
  const out: Record<string, boolean> = {};
  for (const id of ALL_COLUMN_IDS) out[id] = !hiddenSet.has(id);
  return out;
}
