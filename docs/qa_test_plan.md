# QA & Test Plan — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code writes and maintains it; the product owner runs the manual checks.
> **Update when:** A feature ships (add its checks), or a bug is found (add the check that would have caught it).
> **This doc contains:** How to verify the product works, **written so it can be run without reading any code**.
> **This doc never contains:** Test code. This is the human-readable plan; the code lives in the test suite.
>
> **The rule that makes this doc real:** a feature is not "Built" in [`pm/current_state.md`](pm/current_state.md) until the checks below pass. When a check fails, that feature's status changes — to Partial, or to a known bug. Test results are the evidence behind every status in that doc, which is why this one keeps it honest.

**Last updated:** 2026-08-26 · **Last full pass:** 2026-08-26 — **storage + ingestion (issue #12)** verified by 49 new unit tests (parsers, loud validation incl. the bad-fixture rejection, DB-level idempotency, board derivation), a real ingest of all 4 archived runs (572-player board), a clean build, and a rendered-page check on real data. An independent code review then found **one stale-data bug** (the board could serve an older snapshot after a re-ingest) plus several hardening items; all were fixed, covered by new tests, and re-verified. The **superflex display board** (D-12) was then verified live: quarterbacks occupy 6 of the top 8, defenses carry positional rank with no overall rank, and rostered-player coverage held at 162/170. · **Historical data (issue #17, 2026-08-26):** three tables loaded via `npm run ingest:historical` and verified by **28 new unit tests** (anchored stat parsing, advanced+standard FPTS-join, name-matching incl. DST-by-team + alias, DB-level idempotency, TRUFFLE reference guard) plus the **scoring cross-check** against the real loaded data (~96% of players within 0.5 pt of CBS's FPTS Total) and a clean live full rebuild. · **Projection engine (issue #18, 2026-08-26):** the projection core built and verified by **21 new unit tests** (first-down rate derivation, first-down-aware scoring translation incl. a **reconstruct-points-from-stored-components** test, one-pool + positional rank derivation, and deterministic Jenks tiering) plus the projections parser (offense-only, dup-fpid refusal) and the data-layer wiring (Kerf ranks/tiers + Kerf-scored Proj Points surface; a player with no projection keeps "—"). A live `npm run engine` scored **520 players** with **Josh Allen #1 overall** (the superflex sanity check — best-QB overall rank = 1), and a **DB-integration test** exercises `runEngine` end to end (the fp→cbs join, rate derivation, tier-calibration query, and persistence) on an in-memory store. · **Backtest gate (issue #19, 2026-08-26):** the decision gate built and verified by **19 new unit tests** (Spearman with tie handling, top-N hit rate, the **no-leakage** season-selection guard, and a DB-integration suite asserting the loader's isolation — a far-future backtest pull **never** becomes `latest_pull`), plus a live `npm run backtest` (out-of-sample 2025 Kerf ρ 0.78 vs ECR 0.77, scoring cross-check re-passing) and live no-regression checks (the current board + `npm run engine` unchanged after loading the historical pulls). · **Valuation engine (issue #20, 2026-08-26):** the dollar layer built and verified by **27 new unit tests** — 19 pure-core (the last-starter baselines incl. the superflex QB24, replacement points, PAR floored at 0, marginal $/point with the **prices-sum-to-cap invariant**, replace-your-starter roster replacement, and the market price curve), 6 DB-integration (`runEngine` writes the valuation rows, the cap-sum balances on real seeded salaries, both market curves build, and the roster-aware value diverges from the generic ceiling in the right direction), and 2 data-layer cases (dollars surface from a valuation row; stay null for defenses). A live `npm run engine` produced **520 priced players**, `$/point ≈ $0.96`, a **balanced cap-sum check**, and RB-heavy top values with elite QBs reading below their market price (a real Edge); a rendered-DOM check confirmed whole-dollar Kerf/Roster/Market columns and signed Edge. · **Result:** Automated checks pass (**195 unit tests** + clean build + live ingest + engine run (points **and** dollars) + backtest run + render); the app's manual interaction checks on real data are pending owner sign-off.

---

## Automated tests

| | |
| --- | --- |
| **How to run them** | `npm test` (Vitest unit tests) and `npm run build` (compile + type-check + lint). |
| **What they cover** | **Unit (195 tests): app (24)** — board **derivation** (unique contiguous overall ranks even when raw ECR ties; real FantasyPros tiers; **Kerf ranks/tiers + Kerf-scored Proj Points now surface from the engine, or "—" when a player has no projection**; loud failure on a position the league doesn't roster), the tier/sort/position **state machine**, the **saved-views model**, and **data-dictionary coverage**. **Ingestion (77)** — *issue #12 (44):* header-name column mapping (**missing header = loud failure**), deliberate coercion (`"$34"`→34; blank salary → null+warning; a decimal salary or an out-of-domain contract year fails loudly), the Players-cell/standings/transactions parsers, **dead-cap classification**, and **end-to-end against a synthetic archive** (full run; **DB-level idempotency**; **$500-cap violation → loud rollback**; missing page/header rejection). *Issue #17 (28):* anchored parsing of the grouped CBS stat headers, the advanced+standard **FPTS-join**, name→id **matching**, TRUFFLE guards, and the **scoring cross-check**. *Issue #18 (5):* the projections parser (offense-only; missing categories → 0; **dup-fpid refusal**). **Engine (26, issue #18)** — *pure core (21):* first-down **rate derivation** (season pooling, no divide-by-zero); **per-player empirical-Bayes shrinkage** (a big-sample standout keeps his own above-average rate; a tiny-sample outlier is pulled back toward the position average; a no-history player falls exactly to the position rate); first-down-aware **scoring** (first downs are a material part of the score; a player's own rate is used when supplied; **points reconstruct deterministically from the stored components**); one-pool + positional **rank derivation** (superflex → a QB tops the pool; deterministic tie-break); and **Jenks tiering** (two obvious clusters split; tier 1 = best; deterministic). *DB integration (5):* `runEngine` on an in-memory store — the **fp→cbs join**, rate derivation, the tier-calibration query, and **engine_run/projection persistence** (hand-computed points reconstruct; QB tops the pool). **Valuation (25, issue #20)** — *pure core (19):* the **last-starter baselines** (incl. the superflex QB24, not QB12), replacement points, **PAR floored at 0**, marginal **$/point with the prices-sum-to-cap invariant** (Σ(kerfValue−1) == discretionary), **replace-your-starter** roster replacement (thin position → higher value, stacked → lower), and the **market price curve** (Nth-priciest ordering, read by rank, flatten past the last knot). *DB integration (6):* `runEngine` writes one valuation row per priced player, records the baselines, **balances the cap-sum on real seeded salaries**, builds both market curves, produces a roster-aware value that diverges from the generic ceiling in the right direction, and stamps the params. **Profiler (23, issue #11)** — unchanged. **Build:** compiles clean; the page server-renders from the real store with real Kerf ranks/tiers. |
| **What they do not cover** | Click/drag interactions in a real browser (drag-to-reorder, show/hide, saving a view to localStorage, applying a view). The *logic* behind them is unit-tested; the DOM wiring is verified by the manual checks below. A live `npm run ingest` against the real archive is its own check below. |
| **Currently passing?** | Yes — `npm test` (**195/195**) and `npm run build` pass clean as of 2026-08-26. Note: the issue-#17 **real-data** scoring cross-check + column anchors run at **ingest time** and in the test suite only where the (git-ignored) historical data is present (`describe.skipIf`); on a fresh clone without data they skip, so confirm them locally with `npm run ingest:historical`. The engine unit tests are pure (no data needed); the live 520-player engine run needs the store populated (`npm run engine`). |

## Manual checks — the critical flows

*The table serves [`user_flows.md`](user_flows.md) flow 1 (Auction prep), now on **real league data**. Run these after `npm install` and at least one `npm run archive` + `npm run ingest`.*

### The table (real data, issue #12)

**Setup:** In a terminal in the project folder: `npm install` (once), `npm run ingest` (builds the database from your snapshots), then `npm run dev`. Open http://localhost:3000.

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Open the page | One **dark** screen: the player table, centered "Gart Dash" title, and a quiet **"League data as of \<date\>"** line on top (the date of your latest snapshot). **No amber MOCK-DATA banner anywhere.** | ☐ |
| 2 | Read the table | **Your real league**: your Rangoon Raccoons roster with each player's **actual salary and contract**, the 11 rival teams, and real free agents. "Showing ~570 of ~570 players" (the exact number moves as rankings change). | ☐ |
| 3 | Check a few numbers against CBS | Pick 2–3 of your own players on the CBS site: salary, contract years, and roster status should match exactly. | ☐ |
| 4 | On first load | Rows are sorted by **Ovr ECR** (the expert consensus board) with **"Tier 1 / Tier 2 / …" bands** — these are **FantasyPros' real tiers** now. At the bottom, players with no overall rank (and all defenses) sit under an **"Unranked"** band. | ☐ |
| 4b | Look at the top of the board | **Quarterbacks fill the top spots** (roughly 6 of the top 8). This is the superflex board — the correct one for a two-QB league. If you see no QBs in the top ten, the wrong board is loaded. | ☐ |
| 4c | Set Position = **DST** | Defenses show **"—" for Ovr ECR** but a real **Pos ECR (DST1, DST2…)** and tier, plus real salary/contract for the ones you roster. | ☐ |
| 5 | Look at the engine columns | **Kerf Ovr/Pos Rank + Kerf tiers** (issue #18) and now the **dollar columns — Kerf Value, Roster Value, Market (Now), Market (Auction), Edge — all show real numbers** (issue #20). **Ceiling boxes start pre-filled** with the Kerf Value (a whole dollar), still editable. Defenses show "—" for every Kerf and dollar column. | ☐ |
| 6 | Look at the Pos column | Colored badges — QB green, RB red, WR blue, TE tan, and **DST purple** (real DSTs are rostered in this league). | ☐ |
| 7 | Set Position = **QB**, then click **Pos ECR** | Only QBs show, banded by tier, QB1 at the top. | ☐ |
| 8 | With Position = **All**, click **Pos ECR** | The app **auto-switches Position to QB** (positional rank needs one position). | ☐ |
| 9 | While positionally sorted, set Position back to **All** (or SuperFlex/Flex) | Sort falls back to the overall order with no positional bands, until you click a rank header again. | ☐ |
| 10 | Sort by **Salary** (descending) | Your league's most expensive contracts on top; free agents ("—" salary) at the bottom — blanks always sort last. | ☐ |
| 11 | Type a number in a **Ceiling** box | The row updates immediately and the value stays as you sort/filter. Clearing the box returns it to blank. | ☐ |
| 12 | Reload the page | Ceilings reset (still session-only — persistence comes with the auction-prep work). | ☐ |
| 13 | Roster toggle → **Free Agents** | Real available players (from the expert board), salary "—". Toggle **Rostered** → only the 12 teams' players. | ☐ |

### The projection engine (real data, issue #18)

**Setup:** after `npm run ingest` and `npm run ingest:historical`, run **`npm run engine`** once (it prints the top-10 overall and the best-QB rank). Then `npm run dev` and open the table.

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Click **Kerf Ovr Rank** to sort by it | Rows order 1, 2, 3… with **Kerf tier bands**. **Quarterbacks sit near the very top** — a top-5 QB should be in the overall top few (superflex + first downs, baked into one ranking). | ☐ |
| 2 | Read **Proj Points** for a star and a free agent | Both show a real projected-points number now (it's KERFUFFLE-scored — our number, not CBS's). Free agents are no longer blank here. | ☐ |
| 3 | Set Position = **QB**, click **Kerf Pos Rank** | QBs only, QB1 at the top, banded into Kerf positional tiers. | ☐ |
| 4 | Set Position = **DST** | Defenses show **"—" for every Kerf column** (they're not projected) but keep their real Pos ECR/salary. | ☐ |
| 5 | Re-run `npm run engine`, reload | The Kerf numbers are the **same** (the engine is deterministic — identical inputs give identical ranks/tiers). | ☐ |

### The valuation engine — dollars, ceilings, market, Edge (issue #20)

*Turns the Kerf points into money. Runs inside the same **`npm run engine`** step (it prints the replacement baselines, $/point, a **prices-sum-to-cap** check, and a top-8-by-value table). Needs the store populated (`npm run ingest` + `npm run ingest:historical`).*

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Run **`npm run engine`**, read the Valuation block | Baselines `QB24 / RB34 / WR34 / TE17 / DST12`; a `$/point` and `discretionary` figure; and **"prices-sum-to-cap check: … ✔ balanced"**. If it reads "⚠ OFF", stop — the $/point is miswired. | ☐ |
| 2 | Open the table, look at **Kerf Value** | Whole-dollar values; the biggest are the top RBs (e.g. a top RB near $200). Every projected offensive player and free agent has one. | ☐ |
| 3 | Compare **Kerf Value** vs **Roster Value** for a player at a position you're **deep** at (e.g. a QB, since you roster two good ones) | Roster Value is **lower** than Kerf Value there (you don't need another). At a **thin** position it's **higher**. That's the roster-aware point. | ☐ |
| 4 | Read **Market (Now)** and **Market (Auction)** | Two dollar columns — what the position/rank costs on current salaries vs the 2025 auction. A top player shows a high market price. | ☐ |
| 5 | Read **Edge** | Green **+** when Kerf Value is above Market (Now) — a bargain; red **−** when below. Elite QBs may show a **red** Edge (the market pays more than our VORP) — that's a real signal, not a bug. | ☐ |
| 6 | Set Position = **DST** | Defenses show **"—" for every dollar column** (not priced). | ☐ |
| 7 | Open the **Data Dictionary** (button at the bottom), read **Kerf Value / Roster Value / Market / Edge** | Each explains its method in plain English (VORP, replace-your-starter, the price curve) — no "Placeholder" flags remain on the dollar columns. | ☐ |
| 8 | Re-run `npm run engine`, reload | The dollars are the **same** (deterministic). | ☐ |

### The backtest — the decision gate (issue #19)

*Answers "does the Kerf re-rank beat raw FantasyPros ECR at predicting actual points?" No UI — it prints a verdict and writes `docs/backtest_results.md`. Needs the store populated (`npm run ingest` + `npm run ingest:historical`) and the historical FantasyPros snapshots present in `data/raw/` (captured FP-only per season). All read-only.*

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Run **`npm run backtest`** | "migration applied: 006…" (first run only), then `loaded 2024… / loaded 2025…`, a **BACKTEST VERDICT** block per season with a scoring cross-check %, overall Kerf ρ vs ECR ρ, and a per-position table, and "Report written: docs/backtest_results.md". | ☐ |
| 2 | Read the **2025** line (the out-of-sample one) | Labeled `out-of-sample (rates from 2024)`; the scoring cross-check reads **~95%** within 0.5 pt (so a weak edge isn't a scoring bug); the overall result is an honest label (currently "≈ tie (marginal Kerf edge)"). | ☐ |
| 3 | Open **`docs/backtest_results.md`** | A plain-English report: verdict-at-a-glance table, a primary (out-of-sample) verdict, per-season per-position tables, and a caveats section. | ☐ |
| 4 | Confirm the live board is **untouched** — `npm run dev`, open the table | Still the **current** league (banner date is today's snapshot, top players are the 2026 board), not a 2024/2025 board. The historical data is isolated. | ☐ |
| 5 | Run `npm run backtest` **again** | Same numbers (deterministic; the loader is idempotent). | ☐ |
| 6 | Run `npm run ingest` after a backtest load | It reports "skipping N FP-only historical run(s)" and does **not** error on them. | ☐ |

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

**What validation protects you from (proven by unit tests, not to try live):** a roster summing **over the $500 cap**, a missing/renamed column header, a missing roster page, an unparseable scoring rule, an unclassifiable roster row, **the same player showing on two rosters**, **two FantasyPros entries claiming the same player**, or **a missing superflex display board** each **reject the whole run loudly and roll back** — the app keeps showing the last good data. The table always shows the **most recently captured** snapshot, even if you re-load an older one afterwards.

### Historical ingestion — CBS 2024/25 stats, 2025 salaries, TRUFFLE (issue #17)

*A separate operator command for the manual exports in `data/historical/` (git-ignored). Run `npm run ingest` **first** — the matcher needs the player universe. No UI.*

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Run `npm run ingest:historical -- --dry-run` | A parse + match report with **no writes**: `2024 stats … 864 matched`, `2025 stats … 864 matched`, `contracts: 234 rows → 222 player-matched, 1 dead-cap, 11 unmatched`, `TRUFFLE: 69 … reference only`, and the **11 unmatched contract players named** (dropped/retired since 2025). | ☐ |
| 2 | Run `npm run ingest:historical` | The same summary, then **"Done. (…TRUFFLE is reference-only…)"**. The three tables are now loaded. | ☐ |
| 3 | Run `npm run ingest:historical` **again** | Row counts are **identical** — re-running loads nothing twice (idempotent). | ☐ |
| 4 | Read the unmatched report | The 11 named players are **expected** (no CBS id in the current universe); they are stored with a null id, **not dropped**. A different, larger unmatched list would mean the player universe or an alias needs attention. | ☐ |
| 5 | (Optional) Full rebuild | Delete `data/gart-dash.sqlite`, run `npm run ingest` **then** `npm run ingest:historical` — both complete clean; historical row counts match step 2. | ☐ |

**Scoring cross-check (the key validation, proven by unit tests):** recomputing KERFUFFLE points from each player's stat components (using the scoring rules parsed from CBS, never hardcoded) lands on CBS's own **FPTS Total** — a **tight** curated sample (Josh Allen, Chase, Bijan, McBride, …) within **0.5 pt**, and a **loose** all-players pass with **≥95% within 1 pt, ≥99% within 5 pt, and no positive misalignment** (a positive diff would mean a mis-mapped column). This is the check that would have caught a stat-column misalignment or a wrong scoring coefficient.

**What validation protects you from (proven by unit tests):** a CBS stat-file **column layout drift** (the anchor players' first downs no longer match, or the two files disagree on FPTS Total) **fails the ingest loudly**; invalid TRUFFLE bid-history JSON is rejected; the historical load **refuses to run against an empty player universe**; and **no consumer path reads the TRUFFLE `auction_result`** (a test asserts the board view and `lib/data/` never reference it — D-15).

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
