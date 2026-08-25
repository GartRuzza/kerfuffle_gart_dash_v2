# QA & Test Plan — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code writes and maintains it; the product owner runs the manual checks.
> **Update when:** A feature ships (add its checks), or a bug is found (add the check that would have caught it).
> **This doc contains:** How to verify the product works, **written so it can be run without reading any code**.
> **This doc never contains:** Test code. This is the human-readable plan; the code lives in the test suite.
>
> **The rule that makes this doc real:** a feature is not "Built" in [`pm/current_state.md`](pm/current_state.md) until the checks below pass. When a check fails, that feature's status changes — to Partial, or to a known bug. Test results are the evidence behind every status in that doc, which is why this one keeps it honest.

**Last updated:** 2026-08-25 · **Last full pass:** 2026-08-25 — the **raw snapshot archiver (issue #10)** was verified by two live end-to-end runs (see its checks below, all passed); the app's 21 unit tests + build were last verified 2026-08-20 (rendered-DOM checked; manual interaction checks still ready for the owner to run). · **Result:** Automated checks pass (21 unit tests + clean build); the archiver's live checks pass; the app's manual interaction checks are pending owner sign-off.

---

## Automated tests

| | |
| --- | --- |
| **How to run them** | `npm test` (Vitest unit tests) and `npm run build` (compile + type-check + lint). |
| **What they cover** | **Unit (21 tests):** mock-data derivation, incl. the **unique-rank invariant** (overall ECR/Dynasty ranks are 1..N and their tiers stay contiguous — the guard for the tier-band bug); the tier/sort/position **state machine**; the **saved-views model**; and **data-dictionary coverage** (every column documented, definitions under 15 words). **Build:** the app compiles clean and server-renders every column, tier bands, badges, the view selector, the column picker, the dictionary button, and drag-free headers (no hydration mismatch). |
| **What they do not cover** | Click/drag interactions in a real browser (drag-to-reorder, show/hide, saving a view to localStorage, applying a view). The *logic* behind them is unit-tested; the DOM wiring is verified by the manual checks below. |
| **Currently passing?** | Yes — `npm test` (21/21) and `npm run build` pass clean as of 2026-08-20. |

## Manual checks — the critical flows

*This prototype serves [`user_flows.md`](user_flows.md) flow 1 (Auction prep), seeded with mock data. Run these after `npm install`.*

### The table (prototype, v2 dark redesign)

**Setup:** In a terminal in the project folder, run `npm install` once, then `npm run dev`. Open http://localhost:3000.

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Open the page | One **dark** screen: the player table, centered "Gart Dash" title, amber **"MOCK DATA"** bar on top. No login. | ☐ |
| 2 | Read the header | Owner, Player, Pos, Team, then GartStats (Kerf Ovr Rank, Kerf Pos Rank, Proj Points, Kerf Value, Ceiling), Edge, Market (Market Value, Ovr ECR, Pos ECR, Dyn Ovr ECR, Dyn Pos ECR), Contract Info (Salary, Contract). A **color key** shows the three group tints. "Showing 79 of 79 players." | ☐ |
| 3 | Look at the Pos column | Each is a **colored badge** — QB green, RB red, WR blue, TE tan. | ☐ |
| 4 | On first load | Rows are sorted by **Kerf Ovr Rank** and **"Tier 1 / Tier 2 / …" band rows** separate the tiers. | ☐ |
| 5 | Click the **Proj Points** header | Rows re-sort; the **tier bands disappear** (Proj Points isn't a rank column). Filled caret shows the sort direction. | ☐ |
| 6 | Click **Kerf Ovr Rank** again | Overall Kerf tier bands come back. | ☐ |
| 7 | Set Position = **QB**, then click **Kerf Pos Rank** | Only QBs show, banded by QB Kerf tiers (QB1 at top). | ☐ |
| 8 | With Position = **All**, click **Kerf Pos Rank** | The app **auto-switches Position to QB** (positional rank needs one position) and shows QB tiers. | ☐ |
| 9 | While positionally sorted, set Position back to **All** (or SuperFlex/Flex) | Sort falls back to Kerf Ovr Rank order with **no bands**, until you click a rank header again. | ☐ |
| 10 | Sort by **Ovr ECR**, then **Dyn Ovr ECR** | Bands change to ECR-overall, then Dynasty-overall tiers — the band set follows the sort field. | ☐ |
| 11 | Edit a **Ceiling** box (pre-filled with Kerf Value) | The row updates immediately and the value stays as you sort/filter. | ☐ |
| 12 | Reload the page | Ceilings reset — expected for this prototype. | ☐ |

### The view system (Phase 2)

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Roster toggle → **Free Agents** | Only free agents show (no team, "—" salary). The **Manager** dropdown greys out. | ☐ |
| 2 | Roster toggle → **Rostered**; then pick a **Manager** (team) | Rostered shows all managers' players, no free agents; picking a team narrows to that team. **All** shows everyone incl. free agents. | ☐ |
| 3 | Click **Columns**, untick **Owner** and **Salary** | Those columns vanish; the count on the button drops. **Player** can't be unticked. | ☐ |
| 4 | **Drag** a column header (e.g. Edge) left or right | The column moves to where you drop it; the order sticks. | ☐ |
| 5 | Open the **View** menu → **Auction Prep** | Columns, sort, and filters snap to the auction preset (free agents, auction column set). Try the other presets. | ☐ |
| 6 | Change something (hide a column), then **Save as new**, name it | Your view appears under "My views" and is selected. | ☐ |
| 7 | Switch to another view, then back to yours; then **reload the page** | Your saved view is still there after reload (stored in this browser). | ☐ |
| 8 | Select your custom view → **Delete** | It's removed; the table returns to Full. (Default views can't be deleted or overwritten — only "Save as new".) | ☐ |
| 9 | Click **📖 Data Dictionary** (bottom), expand a field's **Details**, close with ✕ / Esc / clicking outside | A pop-up lists every column with a one-line definition; engine/market fields show a **Placeholder** chip; Details expands bullets. | ☐ |

### The raw snapshot archiver (issue #10)

*An operator command — no UI. It saves dated, verbatim snapshots of CBS + FantasyPros under `data/raw/`, append-only. Run from a terminal in the project folder.*

**Setup:** your **CBS cookie** must be in `spikes/cbs-api/.env` and your **FantasyPros key** in `spikes/fantasypros-api/.env`.

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Run `npm run archive:check-cookie` | A line ending **`cookie valid = YES (status 200)`**. If it says `no` / login redirect, refresh the CBS cookie in `spikes/cbs-api/.env` and retry. | ☐ |
| 2 | Run `npm run archive` | It prints the CBS pages (including **`roster-report-t1` … `roster-report-t12`**, all `200`), then the FantasyPros probes, then **"Done — N responses archived… Nothing was overwritten."** | ☐ |
| 3 | Look in `data/raw/` | A **new time-stamped folder** (e.g. `2026-08-25T21-52-46Z`) holding `cbs/` (all 12 `roster-report-t*.html` + the league pages), `fantasypros/` (the `*.json` probe set), and **`manifest.json`**. | ☐ |
| 4 | Open that `manifest.json` | It lists **every response** with `source`, `url`, `fetched_at`, and `status`; the `cbs` / `fantasypros` summaries show ok/failed counts. | ☐ |
| 5 | Run `npm run archive` a **second** time | A **second** dated folder appears and the **first folder is unchanged** — append-only, nothing overwritten. | ☐ |
| 6 | Open `fantasypros/ecr-draft-ppr-all.json` | ~520 players and `"public_api_limited": false` — confirms the **HOF key** returns the full board, not the 10-player free preview. | ☐ |
| 7 | Run `git status` | **Nothing under `data/`** appears (it's git-ignored) — only code/doc files. Your cookie and key are never committed. | ☐ |

**Known, not failures:** if the CBS cookie is expired the pages show **LOGIN REDIRECT** and the run warns you (by design — a loud warning beats a silent stale snapshot); the FantasyPros `adp` endpoint returns `403` and CBS `players-rankings` returns `302`, both archived as-is.

## Edge cases and things that should fail gracefully

| # | Try this | It should | Pass? |
| --- | --- | --- | --- |
| 1 | Filter to a rival team **and** a position with no players on it (e.g. a team with no TE) | Show "No players match these filters." — never a blank/broken table. | ☐ |
| 2 | Clear a Ceiling box (delete the number) | Treat it as 0 rather than breaking the row. | ☐ |
| 3 | Narrow the browser window | The table scrolls sideways inside its own box; the horizontal scrollbar is reachable **without scrolling to the bottom**, and the header stays pinned while you scroll rows. | ☐ |
| 4 | Sort by **Ovr ECR**, then **Dyn Ovr ECR** (regression: tier-band bug) | Tier bands are clean — in order, no repeats — and there is **no console error**. | ☐ |
| 5 | Open the browser console on load (regression: hydration bug) | **No hydration / console errors** appear. | ☐ |

## Security and permissions checks

**The app** (player table prototype) has no login, no accounts, no permissions, no database, no network calls, and no user input beyond the in-memory Ceiling boxes — deliberately, since Issue #1 is UI-only.

**The raw snapshot archiver (issue #10)** is the first thing that handles credentials and talks to the network, so it gets its own checks:

| # | Check | Expectation | Pass? |
| --- | --- | --- | --- |
| 1 | Credentials never leave the machine | The CBS cookie and FantasyPros key live only in the git-ignored spike `.env` files; `git status` and `git check-ignore data/` confirm neither the keys nor `data/` are tracked. | ☐ |
| 2 | Read-only only | Every request is an HTTP **GET**. The tool has no code path that bids, drops, sets a lineup, or writes anything to CBS or FantasyPros. | ☐ |
| 3 | Pulled league/third-party data stays local | Everything the tool writes goes under `data/` (git-ignored) — real rosters/salaries and FantasyPros payloads are never committed or uploaded. | ☐ |
| 4 | Expired-cookie safety | A run with a stale cookie shows **LOGIN REDIRECT** warnings and records them in the manifest, rather than silently saving login pages as if they were data. | ☐ |

## Known-failing / untested

| Area | State | Why |
| --- | --- | --- |
| Click-level interactions in a real browser (sort, filter, inline edit) | Untested by automation | The pure logic under them (tier rules, derivation) is unit-tested; the DOM wiring is not yet — covered by the manual checks above. Add component tests (Testing Library) when it stabilizes. |
| Everything downstream of mock data | Not built | No real data, engine, or persistence exists yet — see [`pm/current_state.md`](pm/current_state.md). |

---

**Related docs:** [`user_flows.md`](user_flows.md) (every critical flow needs a check here) · [`pm/current_state.md`](pm/current_state.md) (a failing check must be reflected there as a bug or a downgraded status)
