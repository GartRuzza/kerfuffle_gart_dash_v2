import { MY_TEAM, type PositionFilter } from "./types";

/**
 * Saved views: a named bundle of table settings (which columns show, their order,
 * the sort, and the filters). Default views are built-in read-only presets that
 * mirror the user-flow use cases; custom views are user-created and persisted in
 * localStorage. See docs/architecture.md and decision_log D-05.
 */

/** Manager dropdown: everyone, or a specific team name. */
export const MANAGER_ALL = "ALL";
/** Roster-status toggle: everyone / rostered only / free agents only. */
export type RosterMode = "ALL" | "ROSTERED" | "FA";
/**
 * The engine lens (issue #28/#29): 'ros' = rest-of-season (season-long value,
 * with dollars); 'weekly' = this week's re-score (start/sit support, no dollars).
 * A view carries the horizon it opens in; the horizon toggle switches it live.
 */
export type Horizon = "ros" | "weekly";
/** Value passed to the owner-column filter. */
export interface RosterFilterValue {
  manager: string; // MANAGER_ALL | team name
  rosterMode: RosterMode;
}

export interface SortSpec {
  id: string;
  desc: boolean;
}

export interface ViewState {
  manager: string; // MANAGER_ALL | team name
  rosterMode: RosterMode;
  position: PositionFilter;
  horizon: Horizon; // 'ros' | 'weekly' — which engine lens the view opens in
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
  "opponent",
  "kerfOvrRank",
  "kerfPosRank",
  "projPts",
  "kerfValue",
  "rosterValue",
  "ceiling",
  "edge",
  "marketPrice",
  "marketPreAuction",
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
  opponent: "Opp",
  kerfOvrRank: "Kerf Ovr Rank",
  kerfPosRank: "Kerf Pos Rank",
  projPts: "Proj Points",
  kerfValue: "Kerf Value",
  rosterValue: "Roster Value",
  ceiling: "Ceiling",
  edge: "Edge",
  marketPrice: "Market (Now)",
  marketPreAuction: "Market (Auction)",
  ecr: "Ovr ECR",
  posEcr: "Pos ECR",
  dynastyEcr: "Dyn Ovr ECR",
  dynPosEcr: "Dyn Pos ECR",
  salary: "Salary",
  contractYears: "Contract",
};

/** Column that can never be hidden (identity anchor). */
export const ALWAYS_VISIBLE = "name";

// Sort by Ovr ECR on load: the Kerf ranks are blank until the valuation engine
// exists (issue #12 ships real data; the engine is a later roadmap item), so the
// real FantasyPros consensus board is the meaningful default order.
const DEFAULT_SORT: SortSpec[] = [{ id: "ecr", desc: false }];

/** Build a ViewState from a list of visible columns + overrides. */
function makeState(visible: string[], overrides: Partial<ViewState> = {}): ViewState {
  const visibleSet = new Set(visible);
  return {
    manager: MANAGER_ALL,
    rosterMode: "ALL",
    position: "ALL",
    horizon: "ros", // default lens: rest-of-season (issue #28)
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
        "kerfValue", "rosterValue", "ceiling", "edge", "marketPrice", "marketPreAuction",
        "ecr", "salary", "contractYears",
      ],
      { rosterMode: "FA" },
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
      { rosterMode: "FA" },
    ),
  },
  {
    id: "view-trades",
    name: "Trades",
    builtIn: true,
    state: makeState(
      [
        "owner", "name", "pos", "nflTeam", "kerfOvrRank", "projPts", "kerfValue",
        "rosterValue", "marketPrice", "ecr", "dynastyEcr", "salary", "contractYears",
      ],
      { rosterMode: "ROSTERED" },
    ),
  },
  {
    // The weekly start/sit lens (issue #29): the owner's roster, this week's Kerf
    // re-score BESIDE the weekly consensus, plus the matchup — the numbers that
    // support a start/sit call. Opens in the WEEKLY horizon; no dollars.
    id: "view-startsit",
    name: "Start/Sit",
    builtIn: true,
    state: makeState(
      ["name", "pos", "nflTeam", "opponent", "kerfOvrRank", "kerfPosRank", "projPts", "ecr", "posEcr"],
      { manager: MY_TEAM, horizon: "weekly", sorting: [{ id: "kerfOvrRank", desc: false }] },
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
