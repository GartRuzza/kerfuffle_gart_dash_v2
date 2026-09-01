"use client";

import { useMemo, useState } from "react";
import type { Player } from "@/lib/types";
import { MY_TEAM } from "@/lib/types";
import {
  computeLeague,
  ordinal,
  POS_GROUPS,
  STARTER_SLOTS,
  TIER_LABEL,
  type RankedTeam,
  type Stats,
} from "@/lib/powerRankings";
import RankBarList, { type RankBarRow } from "./powerRankings/RankBarList";
import PositionRadar from "./powerRankings/PositionRadar";
import StartingLineup from "./powerRankings/StartingLineup";

/**
 * Power Rankings screen (issue #32) — the standalone team-strength board.
 *
 * A league table (left) + a selected team's detail panel: Positional Rankings,
 * Starter Rankings, a Position-Strength radar, and the Starting-Lineup chart —
 * emulating the FantasyPros reference. Everything is derived client-side from the
 * per-player Kerf points (`computeLeague`), so the ROS ↔ Weekly lens toggle swaps
 * datasets with no refetch (the same pattern the player table uses). Dynasty is a
 * disabled toggle — no KERFUFFLE dynasty scoring exists yet (D-20).
 */

type Lens = "ros" | "weekly";
type SortKey = "rank" | "starterStrength" | "totalRoster" | "score";

const TIER_DOT: Record<number, string> = {
  1: "bg-rank-strong",
  2: "bg-rank-middle",
  3: "bg-rank-weak",
};

interface Props {
  players: Player[];
  weeklyPlayers: Player[] | null;
  weeklyWeek: number | null;
  /**
   * Pre-formatted "Mon D" freshness dates (e.g. "Aug 31"), computed on the SERVER
   * (app/power-rankings/page.tsx) and passed down. This component is client-side and
   * also server-rendered, so formatting a timestamp here with local-timezone methods
   * would risk an SSR/client hydration mismatch across a day boundary — the same
   * reason DataBanner formats server-side.
   */
  rosUpdated: string | null;
  weeklyUpdated: string | null;
}

export default function PowerRankings({
  players,
  weeklyPlayers,
  weeklyWeek,
  rosUpdated,
  weeklyUpdated,
}: Props) {
  const weeklyAvailable = !!weeklyPlayers && weeklyPlayers.length > 0;
  const [lens, setLens] = useState<Lens>("ros");
  const dataset = lens === "weekly" && weeklyPlayers ? weeklyPlayers : players;

  const league = useMemo(() => computeLeague(dataset), [dataset]);
  const [sort, setSort] = useState<SortKey>("rank");

  const [selected, setSelected] = useState<string | null>(null);
  // Default to the owner's team when present, else the top team.
  const selectedTeam: RankedTeam | undefined =
    league.teams.find((t) => t.team === (selected ?? MY_TEAM)) ?? league.teams[0];

  const sortedTeams = useMemo(() => {
    const arr = league.teams.slice();
    if (sort === "rank") return arr; // already strongest-first
    arr.sort((a, b) => b[sort] - a[sort] || a.rank - b.rank);
    return arr;
  }, [league.teams, sort]);

  // Manager picker options: the owner's team first (marked "(you)"), then the rest
  // alphabetically for findability. The detail panel is fully team-agnostic, so this
  // is just a second control on the same `selected` state the table rows drive.
  const managerOptions = useMemo(() => {
    const names = league.teams.map((t) => t.team);
    const mine = names.filter((n) => n === MY_TEAM);
    const rest = names.filter((n) => n !== MY_TEAM).sort((a, b) => a.localeCompare(b));
    return [...mine, ...rest];
  }, [league.teams]);
  const selectedName = selectedTeam?.team ?? "";

  const total = league.teams.length;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-ink-muted">
        No team strength to rank yet. Run <code>npm run engine</code> after ingesting league data —
        the rankings are built from the engine&apos;s per-player Kerf points.
      </div>
    );
  }

  const freshness =
    lens === "weekly"
      ? weeklyUpdated && `Week ${weeklyWeek ?? "?"} · updated ${weeklyUpdated}`
      : rosUpdated && `updated ${rosUpdated}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls: lens toggle (left) + manager picker (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Lens</span>
          <div className="inline-flex rounded-full border border-line-strong bg-surface-raised p-0.5">
            <LensButton active={lens === "ros"} enabled onClick={() => setLens("ros")}>
              Rest-of-Season
            </LensButton>
            <LensButton
              active={lens === "weekly"}
              enabled={weeklyAvailable}
              title={weeklyAvailable ? undefined : "Available once a current-week pull is ingested (archive → ingest → engine in-season)"}
              onClick={() => weeklyAvailable && setLens("weekly")}
            >
              {weeklyWeek ? `Weekly · Wk ${weeklyWeek}` : "Weekly"}
            </LensButton>
            <LensButton
              active={false}
              enabled={false}
              title="Dynasty rankings are not built yet — the engine has no KERFUFFLE dynasty scoring (deferred, D-20)."
              onClick={() => {}}
            >
              Dynasty
            </LensButton>
          </div>
          {freshness && <span className="text-xs text-ink-subtle">{freshness}</span>}
        </div>

        {/* Manager picker — whose perspective the detail charts show (default: Raccoons) */}
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Viewing</span>
          <select
            value={selectedName}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-line-strong bg-surface-raised px-2 py-1 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
          >
            {managerOptions.map((name) => (
              <option key={name} value={name}>
                {name === MY_TEAM ? `${name} (you)` : name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Top row: league table + positional + starter rankings */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TeamRankingsTable
          teams={sortedTeams}
          selected={selectedTeam?.team ?? null}
          onSelect={(name) => setSelected(name)}
          sort={sort}
          onSort={setSort}
        />
        {selectedTeam && (
          <>
            <RankBarList
              title={`Positional Rankings — ${selectedTeam.team}`}
              total={total}
              rows={positionalRows(selectedTeam, league.groupStats)}
            />
            <RankBarList
              title={`Starter Rankings — ${selectedTeam.team}`}
              total={total}
              rows={starterRows(selectedTeam, league.slotStats)}
            />
          </>
        )}
      </div>

      {/* Bottom row: radar + starting lineup */}
      {selectedTeam && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
          <PositionRadar
            team={selectedTeam}
            teamName={selectedTeam.team}
            groupStats={league.groupStats}
            benchAxisStats={league.benchAxisStats}
            total={total}
          />
          <StartingLineup
            team={selectedTeam}
            teamName={selectedTeam.team}
            slotStats={league.slotStats}
            total={total}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row builders (pure — turn a RankedTeam into RankBarList rows).
// ---------------------------------------------------------------------------

function positionalRows(t: RankedTeam, groupStats: Record<string, Stats>): RankBarRow[] {
  const rows: RankBarRow[] = POS_GROUPS.map((g) => ({
    key: g,
    label: g,
    value: t.groupStarters[g],
    stats: groupStats[g],
    rank: t.groupRank[g],
  }));
  rows.push({
    key: "STARTERS",
    label: "Starters",
    value: t.starterStrength,
    stats: groupStats.STARTERS,
    rank: t.groupRank.STARTERS,
    emphasize: true,
  });
  rows.push({
    key: "BENCH",
    label: "Bench",
    value: t.benchStrength,
    stats: groupStats.BENCH,
    rank: t.groupRank.BENCH,
  });
  return rows;
}

function starterRows(t: RankedTeam, slotStats: Record<string, Stats>): RankBarRow[] {
  return STARTER_SLOTS.map((slot) => {
    const line = t.lineup.find((l) => l.slot === slot)!;
    return {
      key: slot,
      label: line.label,
      value: line.points,
      stats: slotStats[slot],
      rank: t.slotRank[slot],
    };
  });
}

// ---------------------------------------------------------------------------
// League table.
// ---------------------------------------------------------------------------

function TeamRankingsTable({
  teams,
  selected,
  onSelect,
  sort,
  onSort,
}: {
  teams: RankedTeam[];
  selected: string | null;
  onSelect: (name: string) => void;
  sort: SortKey;
  onSort: (k: SortKey) => void;
}) {
  const Header = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`cursor-pointer px-2 py-1.5 font-semibold text-ink-subtle hover:text-ink ${className}`}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-0.5">
        {children}
        {sort === k && <span className="text-accent">▾</span>}
      </button>
    </th>
  );

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <h3 className="border-b border-line px-4 py-3 text-sm font-bold text-ink">Team Rankings</h3>
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-surface-subtle text-left text-xs uppercase tracking-wide">
          <tr>
            <Header k="rank" className="w-10">RK</Header>
            <th className="px-2 py-1.5 font-semibold text-ink-subtle">Team</th>
            <Header k="starterStrength" className="text-right">Starters</Header>
            <Header k="totalRoster" className="text-right">Total</Header>
            <Header k="score" className="text-right">Score</Header>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => {
            const isSel = t.team === selected;
            const isMine = t.team === MY_TEAM;
            return (
              <tr
                key={t.team}
                onClick={() => onSelect(t.team)}
                className={`cursor-pointer border-b border-line-subtle transition-colors ${
                  isSel ? "bg-accent-soft" : "hover:bg-surface-subtle"
                }`}
              >
                <td className="px-2 py-1.5 text-ink-muted">{t.rank}.</td>
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${TIER_DOT[t.tier] ?? "bg-ink-faint"}`}
                      title={TIER_LABEL[t.tier] ?? ""}
                    />
                    <span className={isMine ? "font-bold text-accent" : "text-ink"}>{t.team}</span>
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-ink-muted" title={`Starter Strength (${ordinal(t.rank)})`}>
                  {t.starterStrength.toFixed(0)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-ink-muted" title={`Total Roster (${ordinal(t.totalRosterRank)})`}>
                  {t.totalRoster.toFixed(0)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-ink">{t.score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function LensButton({
  active,
  enabled,
  title,
  onClick,
  children,
}: {
  active: boolean;
  enabled: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      title={title}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "bg-accent text-accent-contrast shadow"
          : enabled
            ? "text-ink-muted hover:text-ink"
            : "cursor-not-allowed text-ink-faint"
      }`}
    >
      {children}
    </button>
  );
}
