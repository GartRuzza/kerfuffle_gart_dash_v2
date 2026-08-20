# Architecture — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code, with the product owner's approval for anything structural.
> **Update when:** The structure of the system changes — a new service, a new boundary, a swapped dependency, a changed deployment target. Not for ordinary feature work.
> **This doc contains:** How the system is put together, and the rules an agent must build within.
> **This doc never contains:** Feature status. Whether a component is actually built is answered by [`pm/current_state.md`](pm/current_state.md).
>
> **Describe what is real.** If a component is planned but not built, mark it **(planned)** explicitly.

**Last updated:** 2026-08-19 · **Reflects commit:** feat/issue-1-player-table-prototype (Issue #1)

---

## The shape of it

Gart Dash is a single [Next.js](https://nextjs.org) web app written in TypeScript. Today it is one screen: an interactive player table. The whole thing runs in the browser — you start it locally with `npm run dev`, and the page renders a table from a hand-authored mock-data file bundled into the app. There is no server logic, no database, no login, and no network calls yet. The same app is built so it can be deployed to the web later (e.g. Vercel) without rearchitecting — that is why the stack was chosen up front (decision [D-01](decision_log.md)).

Everything the product will become — CBS + FantasyPros ingestion, the valuation engine, the auction/waiver/trade lenses — is **(planned)** and will grow inside this same app (server routes for data, a pure engine module), reusing this one table.

## The stack

| Layer | Choice | Why | Decision |
| --- | --- | --- | --- |
| Frontend | Next.js (App Router) + React + TypeScript | One language across the whole app; best-in-class React ecosystem for a rich interactive table; local now, web-deployable later with no rework | [D-01](decision_log.md) |
| Data grid | [TanStack Table](https://tanstack.com/table) v8 | Handles exactly the sort / filter / grouped-columns / editable-cell behavior that *is* the product | D-01 |
| Styling | [Tailwind CSS](https://tailwindcss.com) v3 | Fast, consistent styling in-markup; no separate design system to maintain for a solo owner | D-01 |
| Data source | In-repo mock fixture (`lib/mockData.ts`) | Prototype only — real data (CBS API, FantasyPros) is unverified and deliberately deferred (roadmap #2–3) | — |
| Backend / API | **(planned)** — Next.js server routes | Real data ingestion + engine live here later, behind a clean boundary | D-01 |
| Database | **(planned / none yet)** | No schema exists; mock data is a flat fixture, not a data model | — |
| Auth | **(none — single-user, local)** | One owner, one machine; no accounts by design (vision non-goal) | — |
| Hosting / deploy | **(planned)** — Vercel | Local-first proves the tool; deployment waits (roadmap "Later") | D-01 |

## System boundaries

- **The mock-data boundary — `lib/mockData.ts` is the only place invented data enters.** Every component reads the typed `Player` / `PlayerRow` shapes from `lib/types.ts`; none of them know the numbers are fake. When real CBS/FantasyPros data arrives, this one module is replaced (with a server route that returns the same shapes) and the UI does not change. **Do not scatter mock values through components**, and **do not grow a database around the `Player` type** — it is a fixture shape, not a schema. If a real schema becomes necessary, stop and flag the owner.
- **One table, many filters.** There is exactly one table component. Flows differ only by how it is filtered (roster, position). Never add a dedicated per-flow screen (a "waiver screen", a "trade screen") that duplicates the table — that is the drift [`user_flows.md`](user_flows.md) exists to prevent.
- **The prototype does no I/O.** No network, no storage, no login. State lives in React memory and resets on reload. This is deliberate for Issue #1 (UI-only, no sensitive surfaces).

## Key flows

### Rendering the table

1. `app/page.tsx` (a server component, the one screen) renders `<PlayerTable />`.
2. `components/PlayerTable.tsx` (`"use client"`) seeds React state from `MOCK_PLAYERS`, giving each row a `ceiling` equal to its `kerfValue`.
3. It builds a [TanStack Table](https://tanstack.com/table) from `components/columns.tsx` (grouped "Yours" / "Edge" / "The Market" columns, tier badge, editable ceiling) and renders header + body, tinting the paired columns so the value-vs-price gap reads at a glance.

### Editing a ceiling / filtering / sorting

1. Filters come from `components/FilterBar.tsx` (roster + position) → PlayerTable turns them into TanStack `columnFilters`. Sorting is TanStack's, on header click.
2. Filtering and sorting happen **inside** TanStack, so each row keeps its original data index.
3. Editing a Ceiling box calls `table.options.meta.updateCeiling(row.index, value)`, which updates that row in React state by its original index — so edits survive re-sorting and re-filtering. (They reset on reload; no persistence yet.)

## Environments

| | Local | Staging | Production |
| --- | --- | --- | --- |
| **URL** | http://localhost:3000 | — (none) | — (none) |
| **Database** | none | — | — |
| **How to run** | `npm install` (once), then `npm run dev` | — | — |

## Constraints an agent must respect

- **Mock data stays in `lib/mockData.ts`.** Nowhere else invents numbers. Everything else consumes the `Player` / `PlayerRow` types.
- **No schema, no persistence, no auth, no network** in this prototype. Adding any of these is a structural change — update this doc and flag the owner first (per CLAUDE.md, these are sensitive areas).
- **One table.** Filtered views, not new screens.
- **Keep it deployable.** Nothing may assume a local-only environment in a way that would block a later Vercel deploy (e.g. reading the filesystem at request time).
- Secrets, when they eventually exist, live in environment variables only — never in code or the repo.

## Known architectural limits

| Limit | Bites when | What it would take to fix |
| --- | --- | --- |
| All data is an in-memory mock fixture | The first real feature needs live CBS/FantasyPros data | Add server routes + a real data source behind the mock-data boundary; the `Player` shape likely grows into a real schema (`data_model.md`) |
| No persistence — state resets on reload | The owner wants ceilings saved for auction day | Add storage (roadmap #7, "ceilings saved for auction day") — a deliberate later step |
| Single-user, no auth | Never, by design | Out of scope permanently unless the vision changes |
| Next.js 15 carries 3 high-severity transitive advisories (build-time postcss, unused sharp) | Before any public web deployment | Upgrade to Next 16 (a breaking major-dependency change — owner's call) and re-verify |

---

**Related docs:** [`data_model.md`](data_model.md) (the entities behind this — none yet) · [`decision_log.md`](decision_log.md) (why these choices were made — D-01) · [`pm/current_state.md`](pm/current_state.md) (what of this is actually built)
