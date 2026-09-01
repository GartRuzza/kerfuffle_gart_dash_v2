# QA & Test Plan — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code writes and maintains it; the product owner runs the manual checks.
> **Update when:** A feature ships (add its checks), or a bug is found (add the check that would have caught it).
> **This doc contains:** How to verify the product works, **written so it can be run without reading any code**.
> **This doc never contains:** Test code. This is the human-readable plan; the code lives in the test suite.
>
> **The rule that makes this doc real:** a feature is not "Built" in [`pm/current_state.md`](pm/current_state.md) until the checks below pass. When a check fails, that feature's status changes — to Partial, or to a known bug. Test results are the evidence behind every status in that doc, which is why this one keeps it honest.

**Last updated:** 2026-08-26 · **Last full pass:** 2026-08-26 — **storage + ingestion (issue #12)** verified by 49 new unit tests (parsers, loud validation incl. the bad-fixture rejection, DB-level idempotency, board derivation), a real ingest of all 4 archived runs (572-player board), a clean build, and a rendered-page check on real data. An independent code review then found **one stale-data bug** (the board could serve an older snapshot after a re-ingest) plus several hardening items; all were fixed, covered by new tests, and re-verified. The **superflex display board** (D-12) was then verified live: quarterbacks occupy 6 of the top 8, defenses carry positional rank with no overall rank, and rostered-player coverage held at 162/170. · **Historical data (issue #17, 2026-08-26):** three tables loaded via `npm run ingest:historical` and verified by **28 new unit tests** (anchored stat parsing, advanced+standard FPTS-join, name-matching incl. DST-by-team + alias, DB-level idempotency, TRUFFLE reference guard) plus the **scoring cross-check** against the real loaded data (~96% of players within 0.5 pt of CBS's FPTS Total) and a clean live full rebuild. · **Projection engine (issue #18, 2026-08-26):** the projection core built and verified by **21 new unit tests** (first-down rate derivation, first-down-aware scoring translation incl. a **reconstruct-points-from-stored-components** test, one-pool + positional rank derivation, and deterministic Jenks tiering) plus the projections parser (offense-only, dup-fpid refusal) and the data-layer wiring (Kerf ranks/tiers + Kerf-scored Proj Points surface; a player with no projection keeps "—"). A live `npm run engine` scored **520 players** with **Josh Allen #1 overall** (the superflex sanity check — best-QB overall rank = 1), and a **DB-integration test** exercises `runEngine` end to end (the fp→cbs join, rate derivation, tier-calibration query, and persistence) on an in-memory store. · **Backtest gate (issue #19, 2026-08-26):** the decision gate built and verified by **19 new unit tests** (Spearman with tie handling, top-N hit rate, the **no-leakage** season-selection guard, and a DB-integration suite asserting the loader's isolation — a far-future backtest pull **never** becomes `latest_pull`), plus a live `npm run backtest` (out-of-sample 2025 Kerf ρ 0.78 vs ECR 0.77, scoring cross-check re-passing) and live no-regression checks (the current board + `npm run engine` unchanged after loading the historical pulls). · **Valuation engine (issue #20, 2026-08-26):** the dollar layer built and verified by **27 new unit tests** — 19 pure-core (the last-starter baselines incl. the superflex QB30 depth (D-19), replacement points, PAR floored at 0, marginal $/point with the **prices-sum-to-cap invariant**, replace-your-starter roster replacement, and the market price curve), 6 DB-integration (`runEngine` writes the valuation rows, the cap-sum balances on real seeded salaries, both market curves build, and the roster-aware value diverges from the generic ceiling in the right direction), and 2 data-layer cases (dollars surface from a valuation row; stay null for defenses). A live `npm run engine` produced **520 priced players**, a **balanced cap-sum check**, and (after the post-review fixes) **balanced QB/RB top values** with elite QBs premium; a rendered-DOM check confirmed whole-dollar Kerf/Roster/Market columns and signed Edge. · **Post-#20 owner review (2026-08-26):** two fixes — **Market (Now) = a rostered player's actual salary** (D-18) and the **superflex QB replacement floor moved to ~QB30** (D-19); re-verified by the updated engine tests (`$/point ≈ $0.73`, QB30 baselines), a fresh render check (Allen $151/Edge −$50, Lamar Market $201/Edge −$84, Gibbs $152), and a clean build. · **Result:** Automated checks pass (**197 unit tests** + clean build + live ingest + engine run (points **and** dollars) + backtest run + render); the app's manual interaction checks on real data are pending owner sign-off.

---

## Automated tests

| | |
| --- | --- |
| **How to run them** | `npm test` (Vitest unit tests) and `npm run build` (compile + type-check + lint). |
| **What they cover** | **Unit (197 tests): app (24)** — board **derivation** (unique contiguous overall ranks even when raw ECR ties; real FantasyPros tiers; **Kerf ranks/tiers + Kerf-scored Proj Points now surface from the engine, or "—" when a player has no projection**; loud failure on a position the league doesn't roster), the tier/sort/position **state machine**, the **saved-views model**, and **data-dictionary coverage**. **Ingestion (77)** — *issue #12 (44):* header-name column mapping (**missing header = loud failure**), deliberate coercion (`"$34"`→34; blank salary → null+warning; a decimal salary or an out-of-domain contract year fails loudly), the Players-cell/standings/transactions parsers, **dead-cap classification**, and **end-to-end against a synthetic archive** (full run; **DB-level idempotency**; **$500-cap violation → loud rollback**; missing page/header rejection). *Issue #17 (28):* anchored parsing of the grouped CBS stat headers, the advanced+standard **FPTS-join**, name→id **matching**, TRUFFLE guards, and the **scoring cross-check**. *Issue #18 (5):* the projections parser (offense-only; missing categories → 0; **dup-fpid refusal**). **Engine (26, issue #18)** — *pure core (21):* first-down **rate derivation** (season pooling, no divide-by-zero); **per-player empirical-Bayes shrinkage** (a big-sample standout keeps his own above-average rate; a tiny-sample outlier is pulled back toward the position average; a no-history player falls exactly to the position rate); first-down-aware **scoring** (first downs are a material part of the score; a player's own rate is used when supplied; **points reconstruct deterministically from the stored components**); one-pool + positional **rank derivation** (superflex → a QB tops the pool; deterministic tie-break); and **Jenks tiering** (two obvious clusters split; tier 1 = best; deterministic). *DB integration (5):* `runEngine` on an in-memory store — the **fp→cbs join**, rate derivation, the tier-calibration query, and **engine_run/projection persistence** (hand-computed points reconstruct; QB tops the pool). **Valuation (25, issue #20)** — *pure core (19):* the **last-starter baselines** (incl. the superflex QB30 depth (D-19), not QB12), replacement points, **PAR floored at 0**, marginal **$/point with the prices-sum-to-cap invariant** (Σ(kerfValue−1) == discretionary), **replace-your-starter** roster replacement (thin position → higher value, stacked → lower), and the **market price curve** (Nth-priciest ordering, read by rank, flatten past the last knot). *DB integration (6):* `runEngine` writes one valuation row per priced player, records the baselines, **balances the cap-sum on real seeded salaries**, builds both market curves, produces a roster-aware value that diverges from the generic ceiling in the right direction, and stamps the params. **Profiler (23, issue #11)** — unchanged. **Build:** compiles clean; the page server-renders from the real store with real Kerf ranks/tiers. |
| **What they do not cover** | Click/drag interactions in a real browser (drag-to-reorder, show/hide, saving a view to localStorage, applying a view). The *logic* behind them is unit-tested; the DOM wiring is verified by the manual checks below. A live `npm run ingest` against the real archive is its own check below. |
| **In-season plumbing (17, issue #27)** | The **2026 date→week table** boundaries (Tuesday flip, preseason default, post-season clamp); FantasyPros parser **weekly-field extraction** (opponent/note/tag/recommendation → null on non-weekly boards); the **ROS-fallback detector** on a real `fallback_for:"ROS"` fixture; a **`week=N` projection** payload through `mapProjections`; and an **end-to-end in-season ingest** (weekly board + both projection weeks land; ROS fallback skipped). |
| **ROS lens (3, issue #28)** | The engine stamps **`horizon='ros'`** and `latest_engine_run` / `latest_engine_run_by_horizon` resolve to it; the **board view prefers ROS ECR** over draft when a ROS/STD/OP board is present, and **falls back to draft** when it isn't (preseason no-regression). |
| **Weekly lens (5, issue #29)** | The engine produces a **separate `horizon='weekly'` run** with projection rows and **NO valuation** while `latest_engine_run` stays ROS and the by-horizon view exposes both; it **skips the weekly run** when only a season projection exists (preseason). `deriveWeekly` fills Kerf fields from the weekly run, ECR from the weekly consensus, the **matchup opponent**, nulls all dollars + weekly-tier fields, and leaves weekly fields null for a player the weekly feeds don't cover. |
| **Actuals + Option B (26, issue #30)** | **Capture (6):** the stats-actuals URL is offense-only, year-to-date, the *actuals* view (not projections), captures both categories, paginates by pinning our own segments + `?start_row=N`, and the as-of week is 0 preseason / last completed week in-season. **Parser (10):** id extracted from the Action cell, player cell parsed off the `•` separator, volume + first-down columns mapped by the anchored fixed index, **header-drift → loud failure**, standard+advanced join by id, **FPTS disagreement → failure**, one-sided-view players reported not dropped, multi-page merge. **Ingest (4):** `player_actuals` rows stored with the recompute matching CBS's FPTS Total (cross-check), **idempotent** re-ingest by week, **universe-only** (a non-league player is skipped, not FK-violating), lenient skip when only one view is present. **Engine (4):** no actuals → Option A unchanged; netting re-ranks the whole lens **and** re-prices to remaining; **floor-at-zero** (a player who outscored his projection nets to 0, min $1); the netting is stamped on the run. **UI (2):** `deriveBoard` surfaces remaining `projPts` + full-season/actuals/as-of-week context; falls back to the projection (Full-Season) with null actuals when not netted. |
| **Currently passing?** | Yes — `npm test` (**248/248**) and `npm run build` pass clean as of 2026-08-28. Note: the issue-#17 **real-data** scoring cross-check + column anchors run at **ingest time** and in the test suite only where the (git-ignored) historical data is present (`describe.skipIf`); on a fresh clone without data they skip, so confirm them locally with `npm run ingest:historical`. The engine unit tests are pure (no data needed); the live 520-player engine run needs the store populated (`npm run engine`). The **live in-season archive+ingest (issue #27)** needs the CBS cookie / FP key — it is the owner's manual check (see the in-season-feeds section below). |

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
| 1 | Run **`npm run engine`**, read the Valuation block | Baselines `QB30 / RB34 / WR34 / TE17 / DST12` (QB floor is the last **rostered** QB for superflex depth, D-19); a `$/point` and `discretionary` figure; and **"prices-sum-to-cap check: … ✔ balanced"**. If it reads "⚠ OFF", stop — the $/point is miswired. | ☐ |
| 2 | Open the table, look at **Kerf Value** | Whole-dollar values; the top of the board **balances QB and RB** — an elite QB (e.g. Josh Allen ~$150) sits alongside the top RBs (~$150), and several QBs clear $100. Every projected offensive player and free agent has one. | ☐ |
| 3 | Compare **Kerf Value** vs **Roster Value** for a player at a position you're **deep** at (e.g. a QB, since you roster two good ones) | Roster Value is **lower** than Kerf Value there (you don't need another — the marginal boost over your current starters is small). At a **thin** position it's **higher**. That's the roster-aware point. | ☐ |
| 4 | Read **Market (Now)** for a **rostered** player, then check his **Salary** column | Market (Now) **equals his Salary** (D-18 — a rostered player's market price is his real contract). For a **free agent** (no salary) it instead shows a curve estimate. | ☐ |
| 5 | Read **Market (Auction)** | The 2025-auction price curve for the position/rank — a top player shows a high market price. | ☐ |
| 6 | Read **Edge** | Green **+** when Kerf Value is above Market (Now) — a bargain; red **−** when below. A rostered player who's **overpaid** (e.g. a QB held at a top salary but valued lower) shows a **red** Edge — that's a real overpay signal, not a bug. | ☐ |
| 7 | Set Position = **DST** | Defenses show **"—" for every dollar column** (not priced). | ☐ |
| 8 | Open the **Data Dictionary** (button at the bottom), read **Kerf Value / Roster Value / Market / Edge** | Each explains its method in plain English (VORP with the superflex QB floor, replace-your-starter, salary-or-curve for Market) — no "Placeholder" flags remain on the dollar columns. | ☐ |
| 9 | Re-run `npm run engine`, reload | The dollars are the **same** (deterministic). | ☐ |

### The ROS lens — in-season rest-of-season rankings (issue #28)

*In-season, `npm run engine` IS the rest-of-season lens (Option A). These checks confirm the labeling + market column + freshness. Needs the store populated and the engine run; the ROS-ECR check needs a real in-season pull (a ROS/STD/OP board present — the owner's live archive).*

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Run `npm run engine`, then open the app | The banner reads **"League data as of \<date\> · Rest-of-Season ranks · updated \<date\>"** — the active lens (ROS) and the engine-run freshness, distinct from the data-fetch date. | ☐ |
| 2 | Look at the Kerf columns | Kerf Ovr/Pos Rank, tiers, Proj Points, Kerf Value/Roster Value/Market/Edge all populated for offense — these ARE the ROS numbers (the engine scored the latest refreshed full-season projection). | ☐ |
| 3 | (In-season only) Compare **Ovr ECR** to a preseason snapshot | In-season the ECR columns read the **rest-of-season** consensus (a player whose ROS outlook differs from his draft rank moves). Preseason (no ROS board yet) they read the **draft** board unchanged — no error either way. | ☐ |
| 4 | Spot-check a player whose season projection moved (injury/role change) | His Kerf ROS rank/dollars visibly reflect it after a fresh `archive → ingest → engine`. | ☐ |
| 5 | Click into a dollar (drill-down / Data Dictionary) | Every ROS dollar still traces to its inputs exactly as #20 (points → PAR → $/point → price). | ☐ |
| 6 | Note the dollar **magnitude** | Preseason it's full-season value (Option A). **In-season it's true remaining value** — the Option-A "runs high" limitation is fixed by Option B ([#30](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/30), section below). | ☐ |

**What validation protects you from (proven by unit tests):** the engine stamps `horizon='ros'` and `latest_engine_run` resolves to the latest ROS run (so the app defaults to ROS even after #29 adds weekly runs); the board view **prefers ROS ECR** when a ROS board exists and **falls back to draft** when it doesn't (preseason no-regression). Migration 009 was verified on the live store (board unchanged, all runs labeled `ros`, integrity ok, 0 FK) and a rendered-DOM check confirmed the banner's ROS lens + freshness line.

### Option B — true remaining value (issue #30)

*Nets each player's season-to-date actuals out of the projection so the ROS lens shows what's LEFT. **Preseason (no games played) remaining == full-season, so these checks look like Option A until real actuals accrue.** Needs the full weekly cycle: `npm run archive` (now grabs the CBS season-stats pages) → `npm run ingest` → `npm run engine`.*

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Run `npm run archive`, then check `data/raw/<run>/cbs/` | `stats-actuals-standard*.html` and `stats-actuals-advanced*.html` pages captured (HTTP 200); the manifest's `sources.cbs.actuals_as_of_week` is 0 preseason, the last completed week in-season. | ☐ |
| 2 | Run `npm run ingest` | The run line shows `actuals:<N>@wk<W>`; a note reports how many `player_actuals` were stored + any recompute-vs-CBS cross-check gaps. | ☐ |
| 3 | Run `npm run engine` | The output says **"Option A"** preseason (0 actuals) or **"Option B (remaining value): … as-of week N"** in-season, with how many players were netted and points removed. | ☐ |
| 4 | (In-season) Open the app | The banner reads **"Rest-of-Season remaining value through Week N"**; **Proj Points** shows the remaining number with a small `*`; hovering it shows *full-season − scored (through Week N) = remaining*; the **Full-Season** column (Full / Trades views) shows the pre-net figure. | ☐ |
| 5 | (In-season) Spot-check a player who's played several games | His Proj Points is visibly below his Full-Season, his Kerf Value is priced on the remaining points, and a player who has already outscored his projection shows ~0 remaining / $1 (never negative). | ☐ |
| 6 | Cross-check one player's actuals | His recomputed KERFUFFLE points-to-date match CBS's displayed season FPTS Total within tolerance (return/special-teams points are the expected small residual — offense-only, by design). | ☐ |

**What validation protects you from (proven by unit tests + a live check on a DB copy):** the parser fails loudly on a CBS column-layout drift and on the two stats pages disagreeing on a player's FPTS Total; ingest stores universe-only, is idempotent by week, and is lenient (skips) when the pages are absent; the engine nets **before** ranking/valuation so ranks, tiers, and dollars all reflect remaining value, floors at 0, and falls back to Option A with no actuals. A live ingest+engine on a copy of the store produced **426 `player_actuals` rows** (as-of week 0, all zero preseason, `integrity_check` ok) and a simulated in-season case re-ranked correctly with the drill-down reading *full-season − actuals = remaining*. **Not yet run against real non-zero league actuals — the season hasn't started; that's the first in-season pass.**

### The Weekly lens + Start/Sit view (issue #29)

*Weekly rankings + the supported start/sit flow. Needs an **in-season** pull whose current-week board + projections ingested, then `npm run engine` (which produces the weekly run). Preseason, the Weekly toggle is disabled — that's the expected empty state.*

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Run `npm run engine` in-season, read the tail | A **"Weekly lens (Week N): … players re-scored … (no dollars)"** line. Preseason it instead says "no current-week projection ingested yet — skipped (ROS only)". | ☐ |
| 2 | Open the app, find the **Lens** toggle (top of the table) | Two segments: **Rest-of-Season** (active) and **Weekly**. In-season Weekly is **enabled** and labeled with the week ("Weekly · Wk N"); preseason it's **greyed out** with a tooltip. | ☐ |
| 3 | Click **Weekly** | The Kerf columns re-point to **this week's** re-score, the **Ovr/Pos ECR** columns now show the **weekly consensus**, a new **Opp** column shows the matchup (e.g. "@KC"), and the **dollar columns go to "—"** (no weekly value). A "Week N · updated …" freshness note sits by the toggle. | ☐ |
| 4 | Open the **Start/Sit** saved view | It opens the **Weekly** lens filtered to the **Raccoons**, columns = Player/Pos/Team/Opp/Kerf ranks/Proj/ECR — your roster with this week's numbers beside the consensus. | ☐ |
| 5 | Find a player where our number and the consensus **disagree** | Both are visible side by side (e.g. our Kerf weekly QB7 next to a consensus QB1) — the tool shows the gap and leaves the call to you. | ☐ |
| 6 | Sort by **Kerf Ovr Rank** in the Weekly lens | Tier bands appear from **our Kerf weekly tiers** (weekly consensus has none), so close calls group visibly. | ☐ |
| 7 | Confirm what's NOT there | No lineup optimizer, no auto start/sit pick, no "Start/Sit" verdict column — numbers + matchup only. | ☐ |

**What validation protects you from (proven by unit tests):** the engine writes a **separate `weekly` run** (projection rows, no valuation) while `latest_engine_run` stays ROS; it **skips** the weekly run preseason; `deriveWeekly` maps this-week Kerf + weekly consensus + opponent, nulls dollars and weekly-tier fields, and leaves weekly fields null for an uncovered player. The full pipeline was validated **end-to-end on the real Week-1 data** (586 players re-scored; the Lens toggle went live; a rendered check confirmed the enabled "Weekly · Wk 1" toggle and no errors).

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
| 4 | Read the `⚠` warnings on a run | Currently expected: **blank salaries on CBS itself** (stored as unknown, counted $0) and, post-auction, **`contract length "0"` warnings** for just-won players whose term isn't set yet (stored as unknown → Contract shows "—"). Warnings are informational; a **`✘ ROLLED BACK`** line is a real failure — read its reason. | ☐ |
| 4b | (Post-auction) Confirm the finished auction loaded | The closing "Board view:" line shows the **full rostered count** (e.g. **241**, not 170); a just-won player (e.g. Sam Darnold) shows his **manager and salary** in the table with Contract **"—"**. A contract value **outside {0,1,2,3,4}** — or a genuinely **blank** contract cell — must still roll the run back loudly. | ☐ |
| 5 | Look in `data/` | `gart-dash.sqlite` exists; `git status` shows **nothing under `data/`** (git-ignored). | ☐ |
| 6 | (Optional, destructive-safe) Delete `data/gart-dash.sqlite`, run `npm run ingest` | The database rebuilds completely from the raw archive — the DB is disposable; the archive is the history. | ☐ |

**What validation protects you from (proven by unit tests, not to try live):** a roster summing **over the $500 cap**, a missing/renamed column header, a missing roster page, an unparseable scoring rule, an unclassifiable roster row, **the same player showing on two rosters**, **two FantasyPros entries claiming the same player**, or **a missing superflex display board** each **reject the whole run loudly and roll back** — the app keeps showing the last good data. The table always shows the **most recently captured** snapshot, even if you re-load an older one afterwards.

### In-season feeds — ROS, weekly, per-week projections (issue #27)

*Operator commands, no UI — this issue is plumbing (the ROS/weekly lenses that display it are #28/#29). Requires a **live in-season** `npm run archive` (needs the CBS cookie / FP key) followed by `npm run ingest`. The numbers below are what to expect once the season is underway.*

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Run `npm run archive` in-season | An early line **"current NFL week: N (2026 date→week table)"**; FantasyPros lines for **`ecr-ros-std-op`**, **`ecr-weekly-std-op`** and **`projections-week-N`** returning rows; the weekly lines print **`week=N`**. A closing **"FantasyPros: … (week N)"** with **no "⚠ echo mismatch"**. | ☐ |
| 2 | Open the run's `manifest.json` | `sources.fantasypros` records **`week`**, **`weekSource`** ("2026 date→week table"), and **`weekEchoes`** — the week FantasyPros echoed for each weekly probe, matching the requested week. | ☐ |
| 3 | Run `npm run ingest` | The `✔` line's **`projections:`** count is **higher than before** (season + current week both loaded). No `✘ ROLLED BACK`. | ☐ |
| 4 | (Preseason only) Read the `⚠` warnings | Preseason you should see **"ROS board is FantasyPros' draft-board fallback (preseason) — not stored as ROS"**, and "no ROS/STD/OP / weekly/STD/OP board" warnings — these are **informational, not failures** (in-season they disappear). | ☐ |
| 5 | Spot-check the store (ROS fallback) | Preseason: `SELECT COUNT(*) FROM market_ranking WHERE ranking_type='ros'` is **0** (the fallback was skipped). In-season, once ROS differentiates, it becomes a real count. | ☐ |
| 6 | Spot-check the store (both weeks) | `SELECT DISTINCT week FROM projection_source WHERE pull_id=(SELECT pull_id FROM latest_pull)` returns **both `0` and `N`** — the season line and the current week's line coexist. | ☐ |
| 7 | Spot-check the store (start/sit signals) | A weekly row carries the matchup + expert lean: `SELECT player_opponent, tag, recommendation FROM market_ranking WHERE ranking_type='weekly' LIMIT 5` shows real opponents (e.g. `@KC`) and lean text where FantasyPros provides it. | ☐ |
| 8 | Run `npm run engine` | Unchanged by this issue — it still scores the **season (`week=0`)** line only; the top-10/valuation output looks as it did before #27. | ☐ |

**What validation protects you from (proven by unit tests):** the 2026 date→week table's boundaries (the Tuesday flip, preseason default, post-season clamp); a **preseason ROS fallback** (`fallback_for:"ROS"`) is detected and **never stored as ROS**; a `week=N` projection payload parses through `mapProjections` unchanged; and an end-to-end in-season ingest lands the weekly board (with opponent/tag/recommendation) **and** both projection weeks while skipping the ROS fallback. Migration 008 was verified on a copy of the live store (rows preserved, integrity ok, 0 FK violations).

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
