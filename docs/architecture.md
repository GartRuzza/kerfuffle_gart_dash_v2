# Architecture — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code, with the product owner's approval for anything structural.
> **Update when:** The structure of the system changes — a new service, a new boundary, a swapped dependency, a changed deployment target. Not for ordinary feature work.
> **This doc contains:** How the system is put together, and the rules an agent must build within.
> **This doc never contains:** Feature status. Whether a component is actually built is answered by [`pm/current_state.md`](pm/current_state.md).
>
> **Describe what is real.** If a component is planned but not built, mark it **(planned)** explicitly.

**Last updated:** 2026-08-27 · **Reflects commit:** main. *The D-10 storage architecture's **raw archive** (issue #10), **source profiler** (issue #11), the **normalized SQLite store + ingestion + data-access module** (issue #12), the **historical-data ingestion path** (issue #17 — migration 004 + `npm run ingest:historical`), the **projection engine** (issue #18 — migration 005, Kerf points/ranks/tiers), the **backtest gate** (issue #19 — migration 006 + `npm run backtest`), and the **valuation engine** (issue #20 — migration 007, folded into `npm run engine`: VORP dollars, two ceilings, price curves, Edge) are all real. **The in-season data plumbing (issue #27 — migration 008) is now built too: the archiver + ingest capture the ROS/weekly STD/OP consensus boards and per-week projections; the ROS engine (#28) and weekly/start-sit lens (#29) that read them are next.** The dollar columns show real numbers (offense only).*

---

## The shape of it

Gart Dash is a single [Next.js](https://nextjs.org) web app written in TypeScript. Today it is one screen: an interactive player table showing the **real KERFUFFLE league**. Data flows in three offline steps and one read path: `npm run archive` fetches CBS + FantasyPros and saves every response **verbatim** to `data/raw/` (append-only); `npm run ingest` parses the archive into a **normalized SQLite database** (`data/gart-dash.sqlite`, one file, `better-sqlite3`), validating the league's constitution invariants loudly; and the page (a server component, rendered per request) reads the flat **`board`** view through the single data-access module `lib/data/` and hands the table its `Player` rows. **The app never calls CBS or FantasyPros at request time** — it only ever reads the local store. No login. The same app deploys to the web later without rearchitecting (D-01); the file-SQLite store is the one contained exception (below).

**Built (issue [#17](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/17)), a fourth offline step:** a **historical-data ingestion path** — `npm run ingest:historical` (`tools/ingest/ingest-historical.mjs`) reads the owner-provided CSVs in `data/historical/` (git-ignored) into three new tables (migration 004), on a path **separate** from the archiver's fetched-HTML walk. It parses the 3-row grouped CBS stat headers by anchored column index, joins the "Advanced"+"Standard" files per player, matches names→`cbs_player_id` against the store's player universe (so it runs *after* `npm run ingest`), and loads idempotently. A scoring cross-check validates that recomputed KERFUFFLE points match CBS's FPTS Total.

**Built (issue [#18](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/18)), a fifth offline step:** the **projection engine** — `npm run engine` (`tools/engine/run.mjs` + a pure `core.mjs`). It reads the normalized store (the FantasyPros projected stat lines in `projection_source`, the parsed KERFUFFLE `scoring_rule` config, and the 2024+2025 first-down history in `player_season_stats`), estimates each projected player's rushing/receiving first downs, scores the full line into **Kerf projected points**, and derives **Kerf overall/positional ranks + gap-based tiers** — writing one `engine_run` stamp + one `projection` row per player (the first **derived** DB layer). `lib/data/` joins the latest run onto the board. It runs **after** `npm run ingest`/`ingest:historical`, out of band — never at request time.

**Built (issue [#19](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/19)), a sixth offline step:** the **backtest gate** — `npm run backtest` (`tools/backtest/run.mjs` + a pure `core.mjs`). It re-runs the #18 core on **past** preseasons to measure whether the Kerf re-rank predicts *actual* KERFUFFLE points better than raw FantasyPros ECR. The historical FantasyPros boards + projections are captured by the archiver's season override (FP-only) and loaded by a **separate loader** (`tools/backtest/load.mjs`, `npm run backtest:load`) into **isolated `kind='backtest'` pulls** — migration `006` adds `pull.kind`/`pull.season` and re-scopes `latest_pull` to `kind='current'`, so history captured *today* can share `market_ranking`/`projection_source` with full lineage yet never masquerade as the live board (the app + engine read through `latest_pull`, so they are provably unaffected). The backtest runs **strictly out-of-sample** (each season's first-down rates from prior seasons only), writes a plain-English artifact to `docs/backtest_results.md`, and — like the other tools — never touches the network or runs at request time. No dollars; the owner judges the gate.

**Built (issue [#20](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/20)), the second derived layer:** the **valuation engine** — the same `npm run engine` step, now also running `tools/engine/valuation.mjs` (a pure core) after the projection rows, inside the same transaction (migration 007: `replacement_level`, `valuation`, `price_curve`). It turns Kerf points into auction dollars — a league-generic **Kerf Value** (VORP, last-starter replacement), a Raccoons-specific **Roster Value** (replace-your-starter), two **market prices** (price curves fit from current + 2025 salaries), and **Edge**. `lib/data/` joins the latest run's `valuation` rows onto the board like the projections. Still no request-time compute; DST is unpriced.

Still **(planned)**, growing inside this same app: the auction/waiver/trade lenses — all reusing this one table — starting with the **auction-prep lens** (persisted ceilings + a cap-sum check, roadmap #10).

## The stack

| Layer | Choice | Why | Decision |
| --- | --- | --- | --- |
| Frontend | Next.js (App Router) + React + TypeScript | One language across the whole app; best-in-class React ecosystem for a rich interactive table; local now, web-deployable later with no rework | [D-01](decision_log.md) |
| Data grid | [TanStack Table](https://tanstack.com/table) v8 | Handles exactly the sort / filter / grouped-columns / editable-cell behavior that *is* the product | D-01 |
| Styling | [Tailwind CSS](https://tailwindcss.com) v3 + a semantic design-token layer, **dark theme** | Fast, consistent styling in-markup; a single-source-of-truth palette so every component stays consistent and a restyle is one file | D-01, D-02, D-03 |
| Testing | [Vitest](https://vitest.dev) (`npm test`) | Fast, TS-native unit tests for the pure logic (mock-data derivation, tier/sort/position rules, views model) | D-04 |
| Drag & drop | [@dnd-kit](https://dndkit.com) | Accessible column-header drag-to-reorder, bound to TanStack `columnOrder` | D-05 |
| Persistence | Browser **localStorage** (custom views only) | Local-first: saved views survive reloads with no backend. Per-browser, not synced. | D-05 |
| Data source | **Built (issue #12; extended #18)** — the data-access module `lib/data/` (`board.ts` + pure `derive.ts`) reading the SQLite `board` view + the latest `engine_run`'s `projection` rows, read-only | THE read boundary (D-10): returns the `Player` shape from the latest ingested pull; free agents derived from the FantasyPros board; **Kerf ranks/tiers + Proj Points (issue #18) and the dollar fields — Kerf Value/Roster Value/Market/Edge (issue #20) — come from the latest engine run's `projection` + `valuation` rows**. Replaced `lib/mockData.ts` | [D-10](decision_log.md) |
| Ingestion | **Built (issue #12; in-season feeds #27)** — `tools/ingest/` (`npm run ingest`), reusing the profiler's parsers; migrations in `db/` (`client.mjs` runner + `migrations/*.sql`) | Parses every archived run into the normalized store inside one transaction per run: header-name column mapping, deliberate coercion, loud constitution validation, idempotent upserts, `pull` lineage on every row. **In-season (issue #27): stores the ROS/weekly STD/OP boards (with the weekly opponent + expert start/sit lean), ingests both the season (`week=0`) and current-week (`week=N`) projections, detects+skips the preseason ROS-fallback board (`isRosFallback`), and warns — never fails — when an expected in-season board is absent (old preseason runs re-ingest cleanly).** | D-10, [D-11](decision_log.md), [#27](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/27) |
| Historical ingestion | **Built (issue #17)** — `tools/ingest/ingest-historical.mjs` (`npm run ingest:historical`) + `parse-historical.mjs`, `match-players.mjs`, `scoring-crosscheck.mjs`; migration `004` | A **separate** path for the owner's manual `data/historical/` CSV exports (name-keyed, not fetched HTML): anchored index-based parse of the grouped CBS stat headers, advanced+standard join with FPTS agreement, name→`cbs_player_id` matching with loud unmatched reporting, idempotent per-file loads. Runs after `npm run ingest` (needs the player universe). TRUFFLE loaded as inert reference (D-15) | [#17](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/17), [D-14](decision_log.md), [D-15](decision_log.md) |
| Projection engine | **Built (issue #18)** — `tools/engine/` (`npm run engine`): pure `core.mjs` (first-down rates, estimation, scoring, ranks, Jenks tiers) + `run.mjs` (DB orchestration); migration `005` (`projection_source`, `engine_run`, `projection`) | The first **derived** layer. Translates FantasyPros projected stat lines → KERFUFFLE points **+ estimated first downs** (rates from #17) → Kerf ranks + tiers. A **separate offline step** run after ingestion; the pure core is unit-tested in isolation, deterministic (Jenks, not a stochastic mixture model) so runs reproduce. | [#18](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/18), [D-13](decision_log.md), [D-14](decision_log.md) |
| Valuation engine | **Built (issue #20)** — pure `tools/engine/valuation.mjs` + wired into `run.mjs`; migration `007` (`replacement_level`, `valuation`, `price_curve`) | The second **derived** layer, computed in the same `npm run engine` transaction. VORP off the Kerf points: last-starter replacement → marginal $/point → **Kerf Value** (league-generic) + **Roster Value** (replace-your-starter) + two **market curves** + **Edge**. Pure core unit-tested (incl. the prices-sum-to-cap invariant); deterministic. DST unpriced. | [#20](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/20), [D-13](decision_log.md), [D-17](decision_log.md) |
| Backtest gate | **Built (issue #19)** — `tools/backtest/` (`npm run backtest`): pure `core.mjs` (Spearman, top-N hit rate, no-leakage season selection) + `run.mjs` (orchestration + report) + `load.mjs` (the isolated historical loader); migration `006` (`pull.kind`/`season`, `latest_pull` re-scoped) | Re-runs the #18 core on 2024/2025 preseasons **out-of-sample** and compares Kerf rank vs raw ECR vs FantasyPros' own projection against actual points (Spearman + top-N by position). Historical pulls are isolated (`kind='backtest'`) so they never reach the live board. Writes `docs/backtest_results.md`. Owner judges the gate. | [#19](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/19) |
| Backend / API | Server-component read (no API routes yet) | The one page is `force-dynamic` and calls `lib/data/` directly server-side; the app never fetches CBS/FantasyPros at request time. Dedicated routes can come with deployment | D-01 |
| Database | **Built (issue #12)** — **SQLite** via **`better-sqlite3`** at `data/gart-dash.sqlite` (git-ignored), **normalized layer** + the `board` read view; the **derived layer is (planned)** for the engine issue | Relational data (player → contract → team, transactions across seasons) plus the point-in-time history the price curve and backtest need; one file, zero setup, real SQL. Rebuildable from the raw archive at any time | [D-10](decision_log.md) |
| Raw data archive | **Built (issue #10; transactions pagination added in #12; in-season feeds added in #27)** — `tools/archive/` (`npm run archive`) writes timestamped, dated folders under `data/raw/{timestamp}/{cbs,fantasypros}/` (CBS HTML incl. the full paginated transaction log, FP JSON) + a per-run `manifest.json`, append-only, git-ignored. **In-season (issue #27) it also pulls the STD/superflex ROS + weekly consensus boards and the current week's projections (`projections-week-N`); the current NFL week comes from a hardcoded 2026 date→week table (`tools/archive/nfl-week.mjs`) and is recorded in the manifest with FantasyPros' echoed week cross-checked.** | Every fetched response saved verbatim, so a wrong parser is fixed by re-parsing the archive (never re-fetching), and un-snapshotted weeks aren't lost history. Capture only — `npm run ingest` is the read path | [D-10](decision_log.md), [#27](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/27) |
| Source profiler | **Built (issue #11)** — `tools/profile/` (`npm run profile`) reads the latest `data/raw/` run and writes a committed, **shape-only** field profile to `docs/profiles/` (JSON + `PROFILE.md`) + the `/rules` scoring config in full. Uses **`node-html-parser`** (dev-only) for header-name column mapping | Turns source drift into a git diff; produces the field-shape evidence the schema (#12) is built on. Discovery/docs tooling — reads the local archive only, writes no DB, is not part of the app | [D-10](decision_log.md) |
| Auth | **(none — single-user, local)** | One owner, one machine; no accounts by design (vision non-goal) | — |
| Hosting / deploy | **(planned)** — Vercel | Local-first proves the tool; deployment waits (roadmap "Later") | D-01 |

## System boundaries

- **The data-access boundary — `lib/data/` is the only place league data enters the app (built, issue #12; replaces the old mock-data boundary).** Every component reads the typed `Player` / `PlayerRow` shapes from `lib/types.ts`; only `lib/data/board.ts` touches the database (read-only), and only `tools/ingest/` writes it. Two rules ride on this boundary: (1) **the app never fetches CBS or FantasyPros at request/page-load time** — the archiver fetches out-of-band, ingest normalizes, the UI reads the store; (2) **the raw archive is append-only and never edited** — a wrong parse is fixed by re-parsing the archive (`npm run ingest -- --all`), never by re-fetching. This boundary is also what keeps the deploy path open: a later swap to Turso/Postgres touches `lib/data/` (and `db/`) only. **Do not scatter data reads through components, and do not grow tables from the `Player` type** — it is the read model's output; the schema lives in `db/migrations/` (`data_model.md`).
- **One table, many filters.** There is exactly one table component. Flows differ only by how it is filtered (roster, position). Never add a dedicated per-flow screen (a "waiver screen", a "trade screen") that duplicates the table — that is the drift [`user_flows.md`](user_flows.md) exists to prevent.
- **Client-side storage stays localStorage-only.** No login. In-session state (filters, sort, edited ceilings) lives in React memory and resets on reload; the sole browser-persisted thing is **custom views** in `localStorage` (`lib/views.ts`, key `gartdash.customViews.v1`) — read on mount in a `useEffect` to stay SSR-safe. Keep it that way: localStorage holds UI config only, never domain data or anything sensitive. Domain data lives server-side in the SQLite store.
- **The raw-archive tool is a separate, offline operator process — not part of the app (built, issue #10).** `tools/archive/capture.mjs` (`npm run archive`) is a plain Node script the owner runs by hand; it fetches CBS + FantasyPros with the owner's credentials and writes each response verbatim to `data/raw/{timestamp}/`, append-only, with a per-run `manifest.json`. It reads credentials from the existing spike `.env` files and lives entirely outside the Next.js request path — so the "the app never fetches CBS/FantasyPros at request time" rule below is preserved (the tool *is* the out-of-band fetch). It does **only** capture: no parsing, no normalization, no database, and no read path back into the app yet (those are the planned layers below, issues #11/#12). `data/` and all credentials are git-ignored.
- **The ingest tool is a separate, offline operator process — not part of the app (built, issue #12).** `tools/ingest/ingest.mjs` (`npm run ingest`) is a plain Node script: it reads **only** the local raw archive (never the network), applies pending migrations, and normalizes each archived run inside one transaction with loud validation — so a bad page or failed invariant rolls back completely and the app keeps reading the last good pull. Re-running is idempotent; `--all` re-ingests after a parser fix. (It now also parses the archived FantasyPros projections into `projection_source`, the engine's input.)
- **The projection + valuation engine is a separate, offline operator process — not part of the app (built, issues #18 + #20).** `tools/engine/run.mjs` (`npm run engine`) reads **only** the local store (never the network) and, inside one transaction, computes Kerf points/ranks/tiers **and** the dollar valuation (Kerf Value, Roster Value, market prices, via `computeValuation`), writing the derived `engine_run` + `projection` + `replacement_level`/`valuation`/`price_curve` rows. Its **pure cores** (`core.mjs` for the points, `valuation.mjs` for the dollars) hold all the math with no DB/filesystem, so they are unit-tested in isolation and reproduce deterministically. The app reads the result through `lib/data/` like any other stored data — **no engine math runs at request time**; if the engine has never run, Kerf and dollar fields simply render "—".

## Styling & design tokens

All styling uses **Tailwind CSS with a semantic design-token layer** defined once in
[`tailwind.config.ts`](../tailwind.config.ts) — the single source of truth for the palette.
The theme is **dark** (D-03). Components reference tokens by **role, not hue**
(`bg-surface`, `text-ink-muted`, `bg-pos-qb`, `bg-group-gart`, `text-accent`), never raw
Tailwind colors like `bg-sky-50`. Change the look — restyle, rebrand, or add a light theme
later — in that one file, and every current and future component follows.

| Token group | Role | Examples |
| --- | --- | --- |
| `surface`, `ink`, `line` | Neutral base — backgrounds, text, borders | `bg-surface`, `text-ink-muted`, `border-line` |
| `accent`, `brand` | Teal accent — active/selected/links, primary control | `bg-accent`, `text-accent` |
| `pos` | Position badge fills | `bg-pos-qb` `bg-pos-rb` `bg-pos-wr` `bg-pos-te` `bg-pos-dst` |
| `group` | Column-group tints (+ legend swatches) | `bg-group-gart`, `bg-group-market`, `bg-group-contract` |
| `tier` | Tier separator band | `bg-tier-band`, `text-tier-text` |
| `edge` | The Edge value (plain) | `text-edge` |
| `warning` | The MOCK-DATA banner | `bg-warning-surface`, `text-warning-text` |

**Rule for any new component:** style with these tokens. If a role you need is missing, add a
token to `tailwind.config.ts` rather than hardcoding a color in the component. See
[`decision_log.md`](decision_log.md) D-02, D-03.

## Key flows

### Tier bands & the sort/position rules

Tier bands are not a column — they are separator rows injected between tier groups, and their
behavior is a small state machine that lives **entirely in [`lib/tierRules.ts`](../lib/tierRules.ts)**
(unit-tested). Rule of thumb: bands show only when the *active sort* is one of the six rank
columns; the band set matches that field; positional-rank sorts require a single position
(triggering one auto-switches to QB; switching to a multi-position clears the sort). Any change
to this behavior goes in that one module — never spread the rules into components.

### Rendering the table

1. `app/page.tsx` (a server component, `force-dynamic` so the store is read per request) calls `getBoard()` from `lib/data/board.ts` — which opens `data/gart-dash.sqlite` read-only, reads the `board` view (latest pull) + team names, and derives display fields in `lib/data/derive.ts` — then renders `<DataBanner capturedAt=…/>` ("League data as of …", or a loud no-data state) and `<PlayerTable players teams />`.
2. `components/PlayerTable.tsx` (`"use client"`) seeds React state from the passed players (each row gets a `ceiling` = `kerfValue` — null until the engine exists, so it starts blank) and builds a [TanStack Table](https://tanstack.com/table) from the flat column set in `components/columns.tsx`. Engine columns and real blanks render "—" and sort last (`sortUndefined`).
3. It renders the header (drag-reorder via @dnd-kit, mounted client-side) and body, tinting columns into GartStats / Market / Contract-Info groups and injecting tier-band rows (FantasyPros' real tiers; a trailing "Unranked" band for players off that board). Around it sit `ViewBar` (saved views), `ColumnPicker` (show/hide), `FilterBar` (roster toggle + Manager + position incl. DST), and `DataDictionary` (the bottom overlay defined by `lib/dataDictionary.ts`).

### Editing a ceiling / filtering / sorting / views

1. Filters come from `FilterBar` → PlayerTable turns them into TanStack `columnFilters`; sorting is TanStack's (on header click), which can auto-adjust the position filter via `lib/tierRules.ts`.
2. Filtering and sorting happen **inside** TanStack, so each row keeps its original data index; editing a Ceiling calls `meta.updateCeiling(row.index, value)` and survives re-sort/re-filter (resets on reload).
3. A **view** bundles column visibility + order + sort + filters (`lib/views.ts`); applying one sets all that state at once. Custom views persist to `localStorage`.

## Environments

| | Local | Staging | Production |
| --- | --- | --- | --- |
| **URL** | http://localhost:3000 | — (none) | — (none) |
| **Database** | `data/gart-dash.sqlite` (git-ignored; rebuild anytime with `npm run ingest`) | — | — |
| **How to run** | `npm install` (once) · `npm run archive` → `npm run ingest` → `npm run ingest:historical` → `npm run engine` (data + projections) · `npm run dev` (the app) | — | — |

## Constraints an agent must respect

- **League data enters the app only through `lib/data/`; only `tools/ingest/` writes the store.** Everything else consumes the `Player` / `PlayerRow` types. No component reads the database, the raw archive, or the network.
- **No request-time external fetches, no auth, no invented values.** Schema changes go through `db/migrations/` with owner approval (CLAUDE.md sensitive area — the current schema is approved via D-10/D-11).
- **One table.** Filtered views, not new screens.
- **Keep it deployable.** Nothing may assume a local-only environment in a way that would block a later Vercel deploy (e.g. reading the filesystem at request time). The (planned) **file-based SQLite store (D-10)** is the one deliberate exception, contained by design: a writable file doesn't survive serverless, so all access goes through the single data-access module and a later swap to **Turso/Postgres** touches only that module — no other code may assume file-SQLite.
- Secrets, when they eventually exist, live in environment variables only — never in code or the repo.

## Known architectural limits

| Limit | Bites when | What it would take to fix |
| --- | --- | --- |
| Data freshness is manual (archive → ingest by hand) | The owner forgets a weekly snapshot; the banner date goes stale | Automated scheduling — deliberately deferred until cookie lifetime is solved (roadmap "Later") |
| Free agents come from the FantasyPros board, not CBS's own FA page (`/players` is JS-rendered) | A deep, unranked FA isn't in the table; FA Proj Points are blank | Page/JS-render the `/players` capture; the board view already unions the two sources |
| Edited ceilings still reset on reload (session-only) | The owner wants ceilings saved for auction day | The auction-prep lens (`owner_ceiling_override` + persistence), roadmap #10 |
| Price curve is a step function off ~12 salaries/position | Coarse pricing at the position extremes; a deep player flattens to the cheapest salary | Add smoothing/regression to `buildPriceCurve` — a contained change in the valuation core |
| Client state resets on reload (edited ceilings) | The owner wants ceilings saved for auction day | The auction-prep lens item ("ceilings saved for auction day") — a deliberate later step |
| Single-user, no auth | Never, by design | Out of scope permanently unless the vision changes |
| Next.js 15 carries 3 high-severity transitive advisories (build-time postcss, unused sharp) | Before any public web deployment | Upgrade to Next 16 (a breaking major-dependency change — owner's call) and re-verify |

---

**Related docs:** [`data_model.md`](data_model.md) (the entities behind this — the normalized layer, migration 001) · [`decision_log.md`](decision_log.md) (why these choices were made — D-01, D-10, D-11) · [`pm/current_state.md`](pm/current_state.md) (what of this is actually built)
