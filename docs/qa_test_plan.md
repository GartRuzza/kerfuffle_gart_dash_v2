# QA & Test Plan — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code writes and maintains it; the product owner runs the manual checks.
> **Update when:** A feature ships (add its checks), or a bug is found (add the check that would have caught it).
> **This doc contains:** How to verify the product works, **written so it can be run without reading any code**.
> **This doc never contains:** Test code. This is the human-readable plan; the code lives in the test suite.
>
> **The rule that makes this doc real:** a feature is not "Built" in [`pm/current_state.md`](pm/current_state.md) until the checks below pass. When a check fails, that feature's status changes — to Partial, or to a known bug. Test results are the evidence behind every status in that doc, which is why this one keeps it honest.

**Last updated:** 2026-08-25 · **Last full pass:** 2026-08-25 — **storage + ingestion (issue #12)** verified by 46 new unit tests (parsers, loud validation incl. the bad-fixture rejection, DB-level idempotency, board derivation), a real ingest of all 3 archived runs (485-player board), a clean build, and a rendered-page check on real data. An independent code review then found **one stale-data bug** (the board could serve an older snapshot after a re-ingest) plus several hardening items; all were fixed, covered by new tests, and re-verified. · **Result:** Automated checks pass (**84 unit tests** + clean build + live ingest + render); the app's manual interaction checks on real data are pending owner sign-off.

---

## Automated tests

| | |
| --- | --- |
| **How to run them** | `npm test` (Vitest unit tests) and `npm run build` (compile + type-check + lint). |
| **What they cover** | **Unit (84 tests): app (20)** — board **derivation** (unique contiguous overall ranks even when raw ECR ties; real FantasyPros tiers; engine fields null; loud failure on a position the league doesn't roster), the tier/sort/position **state machine**, the **saved-views model**, and **data-dictionary coverage**. **Ingestion (41, issue #12)** — header-name column mapping (**missing header = loud failure**), deliberate coercion (`"$34"`→34; blank salary → null+warning; a decimal salary or an out-of-domain contract year fails loudly), the Players-cell/standings/transactions parsers, **dead-cap classification** (salary-without-id = dead cap; neither = refusal), and **end-to-end against a synthetic archive**: a full run ingests; **re-running is idempotent (no duplicates, DB-level)**; a roster **over the $500 cap is rejected loudly and rolls back completely**; a missing page or header rejects the run. **Profiler (23, issue #11)** — unchanged. **Build:** compiles clean; the page server-renders from the real store. |
| **What they do not cover** | Click/drag interactions in a real browser (drag-to-reorder, show/hide, saving a view to localStorage, applying a view). The *logic* behind them is unit-tested; the DOM wiring is verified by the manual checks below. A live `npm run ingest` against the real archive is its own check below. |
| **Currently passing?** | Yes — `npm test` (**84/84**) and `npm run build` pass clean as of 2026-08-25. |

## Manual checks — the critical flows

*The table serves [`user_flows.md`](user_flows.md) flow 1 (Auction prep), now on **real league data**. Run these after `npm install` and at least one `npm run archive` + `npm run ingest`.*

### The table (real data, issue #12)

**Setup:** In a terminal in the project folder: `npm install` (once), `npm run ingest` (builds the database from your snapshots), then `npm run dev`. Open http://localhost:3000.

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Open the page | One **dark** screen: the player table, centered "Gart Dash" title, and a quiet **"League data as of \<date\>"** line on top (the date of your latest snapshot). **No amber MOCK-DATA banner anywhere.** | ☐ |
| 2 | Read the table | **Your real league**: your Rangoon Raccoons roster with each player's **actual salary and contract**, the 11 rival teams, and real free agents. "Showing ~485 of ~485 players" (grows as rankings change). | ☐ |
| 3 | Check a few numbers against CBS | Pick 2–3 of your own players on the CBS site: salary, contract years, and roster status should match exactly. | ☐ |
| 4 | On first load | Rows are sorted by **Ovr ECR** (the expert consensus board) with **"Tier 1 / Tier 2 / …" bands** — these are **FantasyPros' real tiers** now. At the bottom, rostered players FantasyPros doesn't rank sit under an **"Unranked"** band. | ☐ |
| 5 | Look at the engine columns | **Kerf Ovr/Pos Rank, Kerf Value, Market Value, Edge show "—"**, and **Ceiling boxes start empty** — the valuation engine doesn't exist yet; nothing is invented to fill its columns. | ☐ |
| 6 | Look at the Pos column | Colored badges — QB green, RB red, WR blue, TE tan, and **DST purple** (real DSTs are rostered in this league). | ☐ |
| 7 | Set Position = **QB**, then click **Pos ECR** | Only QBs show, banded by tier, QB1 at the top. | ☐ |
| 8 | With Position = **All**, click **Pos ECR** | The app **auto-switches Position to QB** (positional rank needs one position). | ☐ |
| 9 | While positionally sorted, set Position back to **All** (or SuperFlex/Flex) | Sort falls back to the overall order with no positional bands, until you click a rank header again. | ☐ |
| 10 | Sort by **Salary** (descending) | Your league's most expensive contracts on top; free agents ("—" salary) at the bottom — blanks always sort last. | ☐ |
| 11 | Type a number in a **Ceiling** box | The row updates immediately and the value stays as you sort/filter. Clearing the box returns it to blank. | ☐ |
| 12 | Reload the page | Ceilings reset (still session-only — persistence comes with the auction-prep work). | ☐ |
| 13 | Roster toggle → **Free Agents** | Real available players (from the expert board), salary "—". Toggle **Rostered** → only the 12 teams' players. | ☐ |

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
| 6 | Open `fantasypros/ecr-draft-ppr-all.json` | **~520 players** and `"tier": "premium"` — confirms the **HOF key** returns the full board, not the 10-player free preview. ⚠ Note `"public_api_limited"` still reads **`true`** even on HOF (issue #11) — judge by row count + `tier`, not that flag. | ☐ |
| 7 | Run `git status` | **Nothing under `data/`** appears (it's git-ignored) — only code/doc files. Your cookie and key are never committed. | ☐ |

**Known, not failures:** if the CBS cookie is expired the pages show **LOGIN REDIRECT** and the run warns you (by design — a loud warning beats a silent stale snapshot); the FantasyPros `adp` endpoint returns `403` and CBS `players-rankings` returns `302`, both archived as-is.

### The source profiler (issue #11)

*An operator command — no UI. It reads the latest raw snapshot and writes a committed, **shape-only** field profile to `docs/profiles/`. Reads local files only; never fetches anything. Requires at least one `npm run archive` run to exist.*

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Run `npm run profile` | It prints the run it read, **`✓ leak check passed`**, then "Wrote 4 files to docs/profiles/" (cbs field profile, cbs scoring rules, fantasypros field profile, PROFILE.md). | ☐ |
| 2 | Open `docs/profiles/PROFILE.md` | A readable summary answering the six questions — the 12-team roster table, the FantasyPros endpoint table, and the corrections callouts. | ☐ |
| 3 | Open `docs/profiles/cbs_scoring_rules.json` | **24 scoring rules** with parsed values (flat / per-unit / tiered), roster limits, and league settings — **real values** (these are league rules). | ☐ |
| 4 | Skim `docs/profiles/cbs_field_profile.json` | Player/roster fields show **masked examples** (e.g. `"Aaaaa Aaaaaaaa AA • AAA"`, `"999.99"`) — **no real names, salaries, or ranks**. Only structural enums (Pos, Contract, Bye, Status) list real values. | ☐ |
| 5 | Run `git status` | The new/changed files are under **`docs/profiles/`** (committed); **nothing under `data/`** appears. | ☐ |

**Known, not failures:** the `adp` endpoint shows `403` and dead-cap pseudo-rows show `0` (there are none pre-auction) — both are correct findings, not errors. The **leak check failing** *is* a real failure and blocks all writes — investigate before committing.

### Ingestion — raw archive → database (issue #12)

*An operator command — no UI. It reads the local raw archive (never the network) and builds/updates the SQLite database the app reads. Requires at least one `npm run archive` run to exist.*

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Run `npm run ingest` | On first run: "migration applied: 001…", then one **`✔`** line per archive run — `teams:12 players:~170 … rules:24 boards:9 rankings:~3800` — and a closing **"Board view: N players (N rostered, N free agents)"**. | ☐ |
| 2 | Run `npm run ingest` **again** | "to ingest: 0" — already-ingested runs are skipped; the board summary is **unchanged**. | ☐ |
| 3 | Run `npm run ingest -- --all` | Every run re-ingests and the board summary is **still identical** — re-running never duplicates anything. | ☐ |
| 4 | Read the `⚠` warnings on a run | Currently expected: **three t7 players with blank salaries on CBS itself** (stored as unknown, counted $0). Warnings are informational; a **`✘ ROLLED BACK`** line is a real failure — read its reason. | ☐ |
| 5 | Look in `data/` | `gart-dash.sqlite` exists; `git status` shows **nothing under `data/`** (git-ignored). | ☐ |
| 6 | (Optional, destructive-safe) Delete `data/gart-dash.sqlite`, run `npm run ingest` | The database rebuilds completely from the raw archive — the DB is disposable; the archive is the history. | ☐ |

**What validation protects you from (proven by unit tests, not to try live):** a roster summing **over the $500 cap**, a missing/renamed column header, a missing roster page, an unparseable scoring rule, an unclassifiable roster row, **the same player showing on two rosters**, or **two FantasyPros entries claiming the same player** each **reject the whole run loudly and roll back** — the app keeps showing the last good data. The table always shows the **most recently captured** snapshot, even if you re-load an older one afterwards.

## Edge cases and things that should fail gracefully

| # | Try this | It should | Pass? |
| --- | --- | --- | --- |
| 1 | Filter to a rival team **and** a position with no players on it (e.g. a team with no TE) | Show "No players match these filters." — never a blank/broken table. | ☐ |
| 2 | Clear a Ceiling box (delete the number) | Return to blank ("—"-style empty box) rather than breaking the row. | ☐ |
| 3 | Narrow the browser window | The table scrolls sideways inside its own box; the horizontal scrollbar is reachable **without scrolling to the bottom**, and the header stays pinned while you scroll rows. | ☐ |
| 4 | Sort by **Ovr ECR**, then **Dyn Ovr ECR** (regression: tier-band bug) | Tier bands are clean — in order, no repeats — and there is **no console error**. | ☐ |
| 5 | Open the browser console on load (regression: hydration bug) | **No hydration / console errors** appear. | ☐ |

## Security and permissions checks

**The app** has no login, no accounts, and no permissions. It opens the local database **read-only** and makes **no network calls at request time** — only the archiver (an operator command you run yourself) ever talks to CBS/FantasyPros. Real league data lives only in `data/` (git-ignored, never committed or uploaded).

**The raw snapshot archiver (issue #10)** handles the credentials and the network, so it gets its own checks:

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
| Dead-cap rows against real data | Untested live | Zero exist pre-auction. The classification is unit-tested against synthetic fixtures; the first real one (post-auction cut) should be spot-checked in the DB and warnings. |
| The valuation engine and everything downstream | Not built | Engine columns deliberately show "—" — see [`pm/current_state.md`](pm/current_state.md). |

---

**Related docs:** [`user_flows.md`](user_flows.md) (every critical flow needs a check here) · [`pm/current_state.md`](pm/current_state.md) (a failing check must be reflected there as a bug or a downgraded status)
