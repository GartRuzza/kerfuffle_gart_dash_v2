# Implementation Reality Log — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code (the implementing agent), read by the product owner and PM Claude.
> **Update when:** At the end of every build cycle, before reporting the work complete — one entry per cycle.
> **This doc contains:** Where reality diverged from the plan, and what that means for the product.
> **This doc never contains:** A changelog of everything that shipped. If the work went exactly as planned, the entry is three lines. **This log exists to capture surprises**, not activity.
>
> **Append-only. Newest entry at the top. Never edit or delete an old entry** — a log you can rewrite is a log nobody can trust.
>
> **Why this doc matters:** plans are made without full knowledge of the code. Every build teaches us something the plan did not know. This is where that knowledge goes, so that the next planning conversation starts from reality instead of from the last plan.
>
> *The example entry at the bottom is in italics and refers to a fictional product, "Ledgerly." Delete it once you have a real entry.*

---

## Entry template — copy this block for each build cycle

### [YYYY-MM-DD] — [Short title]

**Ticket / Issue:** [#NN, or a link] · **Branch:** [branch] · **Deviated from plan:** Yes / No

**Original intent**
*What the ticket asked for, in one or two sentences. Written from the plan, not from hindsight.*

**What was actually built**
*What now exists in the code. Be concrete and honest — this is the sentence that either grounds or misleads every future decision.*

**Deviations**
*The gap between the two sections above. If there is none, write "None" and skip the next two sections.*

**Why we deviated**
*The honest reason. Usually one of: the plan assumed something about the code that was not true; the work was larger than it looked; we found a better way; something outside our control changed. If it was a shortcut taken under time pressure, say so plainly — that is exactly the kind of thing this log exists to surface.*

**Product implications**
*The section the product owner reads. In plain English: what can a user now do, or not do, that the plan assumed they could? Does this change the roadmap, the MVP definition, or a promise we have made?*

**Technical tradeoffs and debt**
*What we now owe. Name the cost and what it will take to pay it down — "we will fix this later" with no description is how debt becomes invisible.*

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| [debt] | [reason] | [what it will break, and when] | [rough effort] |

**Follow-up decisions needed from the product owner**
*Questions this build raised that an agent must not answer alone. Anything listed here should be promoted into the Open product decisions table in [`roadmap.md`](roadmap.md). If there are none, write "None."*

- [ ] [Decision needed] — [what it blocks]

---

## Log

<!-- Newest entry goes here, directly below this line. -->

### 2026-08-26 — Backtest → core fix: receiving-only first-down personalization (D-16)

**Ticket / Issue:** follow-up to [#19](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/19) (the gate feeding back into #18) · **Branch:** feat/issue-18-projection-core · **Deviated from plan:** N/A — this is the gate doing its job.

**Original intent**
The #19 gate says an inconclusive result goes back into the projection core before dollars. The owner asked the sharp follow-up: for players whose first-down rate differs a lot from their position average, does the adjustment help vs ECR?

**What was actually built**
An out-of-sample probe (`tools/backtest/ppfd-probe.mjs`) that (a) measures whether FD conversion rate persists year to year and (b) isolates the adjustment's effect by scoring each 2025 player with his own vs the position rate. Finding: **rushing FD/carry barely persists (ρ 0.14); receiving FD/reception persists (ρ 0.52)**, and the adjustment moves rank by <1 spot — in 2025 it nudged the wrong (aging, regressing) players. On that evidence (D-16) the engine now personalizes **only receiving** first downs; rushing uses the position average. `scoreProjection` gained a per-component `opts`; `FD_POLICY` lives in the engine orchestrator and is shared with the backtest. Re-gate: **do-no-harm** (overall ρ unchanged).

**Deviations / Why we deviated**
None from plan — the gate is designed to feed the core. The surprise is the *content*: the first-down "edge," the product's intended differentiator, is largely redundant with volume for ranking, and its rushing half is close to noise.

**Product implications**
The tool's value proposition shifts from "we out-rank consensus" (not supported by the data) to "we translate consensus-grade projections into league-specific **dollar** decisions — value, Edge vs market, cap math" (still strong, and the actual in-season/auction use). The owner accepted this reframe and chose to proceed to the dollar layer (#20) after the cheap core fix. The vision's 6-month success measure ("KERFUFFLE-adjusted values beat consensus") should be read as being about *dollar decisions*, not ranking — worth an explicit revisit with PM Claude.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| Rushing FD is now a position constant | Its per-player rate is near-noise year to year (ρ 0.14) | A genuinely elite short-yardage back isn't individually credited on the ground | Revisit with more seasons or a role/goal-line-aware rushing model (backlog) |
| `ppfd-probe.mjs` is unwired, untested scratch | It answered a one-off question and grounds D-16 | Minor clutter; could bit-rot | Promote into the backtest report as a "signal persistence" section (~half a day) if we want it standing |

**Follow-up decisions needed from the product owner**

- [ ] **Reframe the vision's success measure** from "beat consensus ranking" to "league-specific dollar decisions"? — a vision-doc edit for the owner + PM Claude (not blocking #20).

---

### 2026-08-26 — Backtest: the decision gate (#19)

**Ticket / Issue:** [#19](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/19) · **Branch:** feat/issue-18-projection-core · **Deviated from plan:** No on scope; the **result** is the surprise.

**Original intent**
Prove the KERFUFFLE re-rank predicts *actual* KERFUFFLE points better than raw FantasyPros ECR (and CBS's own projection) on 2024 & 2025, before investing in the dollar layer. Pass → build dollars; fail/inconclusive → fix the projection core first.

**What was actually built**
`npm run backtest` (`tools/backtest/`): captures the 2024/2025 preseason FantasyPros boards + projections (archiver season override, FP-only), loads them into **isolated `kind='backtest'` pulls** (migration `006`; `latest_pull` re-scoped to current so history can't masquerade as the live board), re-runs the #18 core **strictly out-of-sample**, and compares Kerf rank vs raw ECR vs FantasyPros' own projection against actual CBS points by Spearman ρ + top-N hit rate per position. Writes a plain-English artifact to `docs/backtest_results.md`. Owner judges the gate.

**Deviations**
Two, both anticipated in the pre-build Q&A: (1) **CBS's own projection is not recoverable** for past seasons (the CBS year switch isn't a URL param), so the intended three-way is a two-way Kerf-vs-ECR, with FantasyPros' own projection shown as the reference third line — the issue explicitly allows dropping CBS. (2) The historical data is captured *today*, so it is the newest by capture time; isolating it (migration 006 + a separate loader) was necessary work the ticket implied but didn't spell out.

**Why we deviated**
Data-availability reality (CBS history) and a schema-safety reality (the `latest_pull`-by-capture-time rule from migration 002 would have served a 2025 board as "current"). Neither changes the question the gate answers.

**Product implications**
**The headline: the KERFUFFLE re-rank shows a REAL but MARGINAL and INCONSISTENT edge over consensus — not the decisive win the thesis hoped for.** Out-of-sample 2025: overall ρ Kerf 0.78 vs ECR 0.77 (edge +0.01, "≈ tie"); per position Kerf helps RB, roughly ties QB/WR, and **trails TE**. The pooled correlation is ~0.8 for both predictors because separating stars from scrubs across ~450 players is easy and dominates the number; the first-down adjustment is a fine-grained re-rank that barely moves the board. This is exactly the call the gate exists to force: **is a marginal edge enough to justify building the dollar machinery on top of it, or should the first-down model be sharpened first?** That is a material product decision — escalated, not decided here.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| Two-season sample; verdict is directional | Only 2024/2025 CBS actuals exist; one clean holdout (2025) | Over-reading a small-sample result | Accrues naturally — each new season adds a holdout year |
| Overall ρ is dominated by stud/scrub separation | Standard Spearman over the full pool | Could mask (or flatter) the real top-of-board edge | Add a starters-only / top-N-weighted correlation lens (~half a day) |
| First-down shrinkage (`rushK=75/recK=40`) is heavy and un-tuned | #18 shipped a "moderate" dial; the backtest was meant to calibrate it | The player-specific FD edge may be muted, understating Kerf | A shrinkage sensitivity sweep in the backtest (~half a day) — a natural next step if the owner wants the edge sharpened |

**Follow-up decisions needed from the product owner**

- [ ] **Does the marginal backtest edge clear the gate to build the dollar layer (#20), or do we refine the #18 first-down model first?** — blocks #20 and everything downstream. (Promote to Open product decisions in `roadmap.md`.)

---

### 2026-08-26 — KERFUFFLE projection engine core: first-down-aware points, ranks, tiers (#18)

**Ticket / Issue:** [#18](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/18) · **Branch:** main · **Deviated from plan:** No (four owner decisions taken in the pre-build Q&A)

**Original intent**
Turn FantasyPros' projected stat lines into KERFUFFLE-scored projected points — including an *estimated* first-down component derived from our own league history (#17) — then surface real Kerf overall/positional ranks and tiers in the table. No dollars (that's the valuation issue, gated behind the backtest). Stage 1 of "stage in two" (D-13).

**What was actually built**
Migration `005` adds three tables: `projection_source` (normalized input — the FantasyPros projected stat line per player per pull, written by `npm run ingest`), `engine_run` (one stamped row per engine execution), and `projection` (derived output — per-player Kerf points, the estimated first downs as named components, the full component breakdown, and Kerf ranks + tiers). A new offline step, **`npm run engine`** (`tools/engine/run.mjs` + a pure `core.mjs`), derives **per-player** first-down rates from `player_season_stats` (2024+2025 pooled), **each shrunk toward its position rate by sample size** (empirical-Bayes — see the mid-build addition below), estimates each projected player's rushing/receiving first downs, scores the full line through the parsed `scoring_rule` config (reusing #17's validated scoring logic), and derives Kerf overall/positional ranks and gap-based tiers (Jenks natural breaks, calibrated to FantasyPros' own tier counts). `lib/data/` now joins the latest engine run onto the board, filling Kerf Ovr/Pos Rank + tiers and — per the owner — the Proj Points column (KERFUFFLE-scored, for every projected offensive player including free agents). Dollar columns stay "—". 26 new tests (141 total — incl. a DB-integration test of `runEngine` added on review); build clean; live run scored 520 players with Josh Allen #1 overall (the superflex sanity check).

**Deviations**
Four product/display decisions the owner made in the pre-build Q&A (2026-08-26), none a departure from the issue's locked design:
1. **Defenses (DST) render "—" for Kerf** — the offensive projection feed can't produce a trustworthy KERFUFFLE-scored defensive number (its biggest component, points-allowed, comes through as zeros; our stat history is offense-only). They keep their existing positional rank/tier from the market board.
2. **Proj Points now shows OUR number for all offense** (incl. free agents), replacing CBS's displayed projection there. CBS's own projection is still stored for reference.
3. **First-down rates pool 2024+2025** (more stable than one season).
4. **Tiers are gap-based (Jenks), calibrated to FantasyPros' tier counts** — after the owner asked for a researched method that stays consistent with FP's banding. Chose Jenks over a Gaussian-mixture model because it is deterministic (an acceptance requirement) and reads as clean value-cliffs.

**Mid-build addition (owner, 2026-08-26, after first review):** the owner asked that first downs be based on **each player's own historical production**, not just his position's average — that's the competitive edge (a back who converts more first downs than average should be worth more). The issue had scoped this as "later"; the owner pulled it forward. Implemented as **empirical-Bayes shrinkage**: each player's own 2024+2025 rate blended toward his position rate, weighted by sample size (`rushK=75`/`recK=40` — "moderate", ~half a season). A rookie or thin sample falls back to the position rate with no hard cutoff. Verified on real data: Kyren Williams (575 carries, 0.277 FD/carry) keeps ~his own rate vs the 0.229 RB average and rises; a below-average small-sample back is softened back toward average. The applied/own/position rates + sample size are stored per player for drill-down. No schema change — the data was already loaded (#17) and the breakdown rides in `components_json`.

**Product implications**
The table now shows a genuinely KERFUFFLE-aware board for the first time: QBs correctly sit at the top (Josh Allen #1 overall, best-QB overall rank = 1), because first downs and superflex are both baked into one ranking pool. Free agents finally carry a projection. What still reads "—": all dollar columns (Kerf Value, Market Value, Edge, Ceiling) — those are the valuation issue (#20), deliberately gated behind the backtest (#19) — and defenses' Kerf columns. The ranks are now something the backtest can actually test.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| Shrinkage strength (`rushK=75`/`recK=40`) is a **hand-set starting value**, not yet empirically calibrated | The backtest (#19) is the right place to tune it; "moderate" is a sensible default | A too-strong/weak dial slightly over- or under-personalizes | The backtest calibrates K against actual scoring — a one-parameter sweep, already planned |
| First downs are **estimated**, never actual (projections have none) | FantasyPros doesn't project them; that's the whole engine | The estimate carries the rate's error; a player whose usage/role shifts is mis-projected (the 2-yr pool + shrinkage soften but can't see a changed situation) | Nothing to fix — it's inherent; the backtest (#19) measures whether it helps |
| `engine_run` rows **accumulate** (no auto-prune) | history is useful and the app reads only the latest | The table grows slowly with each `npm run engine` | Trivial prune later if it ever matters (it won't at this scale) |
| DST **excluded** from Kerf entirely | can't score defense from the offensive feed | Defenses have no Kerf value/rank on auction day | A defensive projection source + DST scoring — a separate, low-priority effort |

**Follow-up decisions needed from the product owner**
None. The four decisions above were made in the Q&A and are recorded in the roadmap's Open-decisions notes / here.

---

### 2026-08-26 — Historical data storage: CBS 2024/25 stats, 2025 salaries, TRUFFLE reference (#17)

**Ticket / Issue:** [#17](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/17) · **Branch:** docs/valuation-engine-plan · **Deviated from plan:** No (a few owner-approved refinements)

**Original intent**
Bring the owner-provided historical exports into the normalized store — CBS 2024/25 stat lines (incl. first downs), KERFUFFLE 2025 salaries, and the TRUFFLE 2026 auction as inert reference — behind a separate ingestion path, with a name→id matcher and a scoring cross-check. Data layer only; the prerequisite for the whole engine block.

**What was actually built**
Migration `004` added three tables — `player_season_stats` (season×player: rush/rec/pass first downs + 2pt from the "Advanced" export joined with full volume from the "Standard" export + FPTS), `contract_history` (KERFUFFLE 2025 salary per player), `auction_result` (TRUFFLE 2026, `is_reference=1`). A new `npm run ingest:historical` (`tools/ingest/ingest-historical.mjs` + `parse-historical.mjs` + `match-players.mjs`) reads `data/historical/`, parses the 3-row grouped CBS headers by anchored column index, joins the two files per player asserting their FPTS agree, matches names→`cbs_player_id`, and loads idempotently inside one whole-run transaction (each season/league replaced wholesale, not merged). A scoring cross-check (`scoring-crosscheck.mjs`) recomputes KERFUFFLE points from components using the parsed `scoring_rule` config and compares to CBS's FPTS Total. 28 new tests (115 total); build clean; live full-rebuild verified.

**Deviations**
Three owner-approved refinements to the issue's shape (all decided during the pre-build Q&A, 2026-08-26):
1. **Stat coverage:** store only players in our ~960-player universe (not all ~1,943 exported) — the engine only values players we can rank. 864 of each season matched; the ~1,077 deep-bench rows are skipped by design (count reported).
2. **Contract grain:** store **only the 2025 salary** as authoritative, not the full `'24`..`'28` schedule. The owner flagged the `'24` column as unreliable (a 1-yr-2024 player who changed teams) and future years as superseded by CBS. The raw schedule is kept verbatim in a `schedule_raw` column for provenance only, read by nothing.
3. **Cross-check:** run **both** a tight curated-sample pass and a loose all-players pass (owner's "do both").

**Why we deviated**
Each is a data-quality/scope judgment the owner owns; none changes the issue's intent. They make the stored data smaller and more trustworthy (no unreliable future-year salaries, no deep-bench noise).

**Post-review fixes (the real surprise)**
Independent code + data-model reviews caught a genuine matching bug before it could mislead the engine: the name-matcher's name-only fallback matched a source row to a sole same-name universe player **even across a different position**, so a deep-bench "Josh Johnson WR | DET" was force-matched to the rostered "Josh Johnson QB | CIN" (same for a Brandon Johnson RB/WR pair) — silently overwriting the real player's stat line. The loud same-id collision guard (added on the reviewers' recommendation) turned this into a hard, named failure instead; the fix makes the fallback respect position, so those rows now correctly fall to *unmatched/skipped*. Corrected stat coverage is **864/season** (was an inflated 870 that included the false matches). Also hardened: whole-season/league **replace** on load (a re-match after an alias fix can't leave a phantom old-id row), a **single whole-run transaction** (a late failure rolls back everything, matching the documented temp-validate-swap invariant), and 2025 salary taken **only** from the `'25` cell (no fallback to a possibly-stale generic Salary column). This is exactly the class of error the validation gate exists to catch — the green synthetic-fixture suite passed while the real ingest was wrong, so the real-data cross-check and a live rebuild are the checks that count.

**Product implications**
No user-visible change yet — this is plumbing. What it unlocks: the projection core (#18) now has real per-position **first-down rates** (the KERFUFFLE scoring edge), the backtest (#19) has **actual KERFUFFLE points** for 2024/25, and the price curve (#20) has **2025 salaries**. The scoring cross-check is the headline result: recomputing points from components lands on CBS's own FPTS Total for **~96% of players within 0.5 pt and 99.8% within 5 pt**, with every residual a small *negative* (CBS awards special-teams/return points the offense-only export omits). This proves our stat parse and our parsed scoring rules agree — de-risking the engine before it's built. It also surfaced a scoring fact that matters for #18: **this league scores no PPR reception points and no passing first downs** — only rushing/receiving first downs (1 pt each) on top of standard yardage/TD scoring.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| 11 KERFUFFLE contract players stored with a null `cbs_player_id` | They're dropped/retired/unranked since 2025 (Amari Cooper, Derek Carr, Russell Wilson, …) — no id exists in the current universe to match to | The price curve (#20) can't per-player-join those 11; it must treat them as raw salary signals or skip them | Adding them would mean synthesizing player-identity rows (rejected, same reason as D-11) — leave as-is; they're named in the ingest report |
| CBS stat parse maps by fixed column **index**, not header name | The 3-row grouped headers are positionally shifted and don't align 1:1 with data rows, so header-name mapping isn't possible here | If CBS changes the export layout, a silent misalignment | Mitigated now: anchor assertions (Josh Allen 177/46, Chase 73) + per-player cross-file FPTS agreement fail the ingest loudly on any drift |
| 1 dead-cap row (`Pos='DC'`, "Mark Andrews Dead Cap") stored with null id | It's a team cap obligation, not a player | The price curve must filter `cbs_player_id IS NOT NULL` for player prices | None needed — honest as stored; documented |

**Follow-up decisions needed from the product owner**
None blocking. One thing for the **backtest (#19)** to decide explicitly, not now: `player_season_stats` holds only players in the *current* universe (~864/season), so a player who was rostered/projected in 2024–25 but has since left the league has no stored actual — the backtest can only score survivors. That's defensible (replacement level QB24/RB34/WR34 sits well inside the universe), but #19 should choose whether to exclude missing-actual players or treat them as a named blind spot, rather than discover it mid-build. (Raised by the data-model review.)

---

### 2026-08-26 — Valuation-engine planning: scoped, de-risked, and split into four issues (#17–#20)

**Ticket / Issue:** planning cycle → created [#17](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/17)–[#20](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/20) · **Branch:** n/a (docs + issues only) · **Deviated from plan:** N/A (this *is* the plan)

**Original intent**
Plan the valuation engine (roadmap's next item) and create the GitHub issue(s) for it. No code.

**What actually happened**
A full read of the docs surfaced a load-bearing gap the roadmap's one-line "scoring translation + superflex adjustment" hid: **FantasyPros projections carry no first-down field**, yet 1 pt per rushing/receiving first down is the entire KERFUFFLE edge. That reframed the engine around a first-down *estimation* problem and a data-source question. Over the session:

- **The strategy framework was imported from a separate owner/PM chat and adopted:** VORP (points above positional replacement → cap dollars), two ceilings (league-generic + roster-aware), a two-snapshot price curve, Edge = price − ceiling. Logged as **D-13**.
- **Replacement level was researched** (a subagent produced a sourced brief, recorded via its findings) and the owner chose the **last-starter method** — QB24/RB~34/WR~34/TE~17/DST12, the superflex QB baseline being the pivotal number — with **single-season value** and dynasty kept as context. **D-13**.
- **The first-down source resolved to CBS/our own league, not nflfastR:** the owner exported **2024 & 2025 CBS stat lines** (Advanced = first downs; Standard = volume; they join per player) plus **KERFUFFLE 2025 salaries** and a **TRUFFLE 2026 auction** file. Verified the CBS files really carry per-player rushing/receiving first downs (checked against real players). **D-14.**
- **Historical FantasyPros access was tested and confirmed** (the API serves distinct 2024/2025/2026 ECR + projections by season param) — which **unblocks the backtest end to end** (truth from CBS actuals, prediction from historical FP).
- **TRUFFLE was parked, not used** (auction-pool only, not full rosters; touches the "no TRUFFLE" non-goal) — stored as inert reference, read by nothing. **D-15.**
- **The engine was split into four issues** with the backtest as the gate: #17 historical storage → #18 projection core (points/ranks/tiers) → #19 backtest → #20 VORP dollars/ceilings/Edge.

**Product implications**
- The engine is now fully specified and **every input is in hand** — no remaining data blockers. Build can start at #17.
- **The 2026 FA auction (8/26 5pm ET) happens before the engine ships.** The owner is handling this auction outside the tool ("don't worry about it"); the engine targets in-season decisions and the next auction. Roadmap open decision #3 (auction-day fallback) is thus settled in practice for this cycle.
- The pre-auction price curve, previously blocked on missing history, is now buildable from the 2025 KERFUFFLE salary file.

**Follow-up decisions needed from the product owner**
None blocking. Deferred by design (not open questions): a deeper "man-games" replacement baseline (v2), a contract/age-adjusted dollar value (rejected per the vision), and any future use of TRUFFLE data (needs full rosters + a new decision).

### 2026-08-26 — The market board was the wrong one: switched to superflex (D-12)

**Ticket / Issue:** [#12](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/12) follow-up · **Branch:** feat/issue-12-storage-ingestion · **Deviated from plan:** Yes — corrects a choice made during the build.

**Original intent**
Display FantasyPros consensus rankings beside real league state. The build shipped the **draft / standard / ALL** board, chosen in conversation on 2026-08-25.

**What was actually wrong**
`ALL` is a **1-QB** board. KERFUFFLE starts **two** quarterbacks. The owner caught it the next day. Measured on the live board, the error was large and one-directional: the first five QBs ranked **23/27/35/43/50** on the board we were showing, versus **1/2/3/4/5** on the superflex board, and the 1-QB top twelve contained **no quarterbacks at all**. The owner would have walked toward an auction reading a board that systematically underpriced the most expensive position on his roster.

**What was built**
Research first (the owner asked for it before any change), and it resolved the anticipated trade-off in our favour: FantasyPros exposes superflex as `position=OP`, and **`draft`+`STD`+`OP` is a genuinely distinct board** — 475 of 521 shared players rank differently from the PPR superflex board — so *standard scoring* and *superflex* were both available, not either/or. `SUPERFLEX`/`SF` are rejected by the API; `OP` is the only spelling. Dynasty turned out to be scoring-agnostic (one board per position scope), so `dynasty`+`OP` is simply *the* dynasty superflex board. Two probes were added to the archiver, a fresh snapshot taken, and **migration 003** repointed the read view. Result on real data: QBs occupy 6 of the top 8; rostered-player ranking coverage is unchanged at 162/170.

**Deviations**
**Team defenses lost their overall rank.** `OP` means *offensive* player, so superflex boards exclude DSTs — and the owner rosters 8. Presented as a decision; he chose **positional rank only** (DST1, DST2… and tier, from the 1-QB board) with overall rank left blank. Borrowing their overall rank was rejected on the merits: the two boards have different scales, so a defense ranked ~250th on the 1-QB board would have floated into mid-pack among superflex players and read as more valuable than it is. Blank also sorts defenses last, which is correct here.

**Why we deviated**
The original choice was made in a conversation about *scoring format* (PPR vs standard) and the *league shape* question was never separated out from it. The scoring axis got the attention; the position-scope axis — which mattered far more for this league — was left at its default. Worth noting for future source choices: **an API's default parameter is not a neutral choice**, and "ALL" reads like "everything" when it actually means "one quarterback".

**Product implications**
- The market column the owner reads against is now the right one for his league. This is the number the valuation engine will be measured against, so it would have propagated into the engine, the backtest baseline, and every auction ceiling.
- Defenses show "—" for overall rank by design; their positional rank is intact.
- **Every board is still ingested at full grain** (11 per pull), so the 1-QB board remains queryable and any future display change is a view migration, not a re-fetch. That property is what made this correction a one-migration change rather than a re-archive.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| The board view now reads four ranking sources (superflex draft/dynasty + the DST rows of both 1-QB boards) | Superflex boards exclude defenses, and the owner rosters 8 | More `COALESCE` logic in one view; a reader must know why DST is special | Contained to migration 003 and documented in `data_model.md` |
| DST overall rank is permanently blank | Mixing board scales would misprice defenses | Defenses can't be sorted against flex players by overall rank | If FantasyPros ever ships a defense-inclusive superflex board, one view migration |

**Follow-up decisions needed from the product owner**
None.

### 2026-08-25 — Storage schema + ingestion: the table is on real data (issue #12)

**Ticket / Issue:** [#12](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/12) · **Branch:** feat/issue-12-storage-ingestion · **Deviated from plan:** Small, additive deviations — the issue's core was built as written.

**Original intent**
Build the D-10 normalized SQLite store (`better-sqlite3`): migrations for the seven entities, ingestion parsers (header-name mapping, deliberate coercion, loud validation of the constitution invariants), `pull` lineage on every row, idempotent upserts, temp-validate-swap writes, and the flat board view — replacing `lib/mockData.ts` behind the same `Player` shape. Blocked-on decision (dead cap / Practice Squad) resolved by the owner before the build: PS = a status; dead cap = a team-level row with no player id (D-11).

**What was actually built**
Everything the issue asked: `db/migrations/001` + a tiny runner, `npm run ingest` (`tools/ingest/`) reading every archived run in date order inside one transaction per run (rollback = temp-validate-swap), all invariants enforced loudly (12 teams, id-or-dead-cap, cap ≤ $500 incl. IR, contract years 1–4, header-name mapping), idempotent re-ingest proven at DB level, the `board` view, and a data-access module (`lib/data/`) feeding the UI real data — mock module deleted, banner replaced with "League data as of \<date\>". 69 unit tests pass (31 new), build clean, rendered with the real league (485 players: 170 rostered + 315 FAs).

**Deviations**
1. **The archiver grew transaction pagination** (strictly #10 territory): CBS's transaction log is paginated and only page 1 was being captured. Owner approved. Pagination is plain URL params; both the `?print_rows=9999` print-all view and every `?start_row=N` page are captured (proven live: 60 transactions, was 27).
2. **The `Player` shape got nullable fields instead of staying identical.** The issue said "same `Player` shape"; in truth engine outputs (Kerf values/ranks/tiers, market value) don't exist yet, and real data has real blanks (FA salaries, unranked players). Fields became `number | null` and the UI renders "—". Same columns, honest values.
3. **CBS's own `Proj` column is stored and shown** (`contract.proj_points` → "Proj Points") — real, traceable source data the roster page already carries; without it the column would sit empty for no reason. FAs show "—" (their projections live on the JS-rendered `/players` page).
4. **DST became a real position** (the league rosters DSTs — profiler evidence); position filters updated (SuperFlex excludes DST; a DST option added).
5. **Default sort moved from Kerf Ovr Rank to Ovr ECR** — the Kerf ranks are blank pre-engine, so the load order is the real FantasyPros board (which also makes tier bands real tiers on load). Display board per owner: **draft, standard scoring** (closest to a first-downs league; trivially changeable).
6. **`transaction` table is named `league_transaction`** (`TRANSACTION` is a SQL keyword). CBS's log has no type column, so the type is **inferred from the row text** ("- Dropped" → `Dropped`) with the raw text kept verbatim.
7. **FP payloads self-describe their board, and the file name lies sometimes:** the dynasty board is scoring-agnostic (the "-std" and "-ppr" dynasty files are byte-identical) and the pre-season "ROS" request returns the draft board. Ingestion trusts the payload's declaration and dedupes — 9 distinct boards per pull, not 11 files.

**Why we deviated**
(1) un-captured transactions are unrecoverable history — the archive exists precisely for this; (2–4) the plan was written before we could see real blanks, real DSTs, and CBS's own projections; (5) a default sort on an all-blank column would render an arbitrary order; (6–7) reality of SQL keywords and the FP API.

**Product implications**
- The owner now looks at **his actual league** in the tool: real rosters, salaries, contracts, transactions, rules, and market ranks — every value traceable to a dated raw snapshot (`pull` lineage). The routine is `npm run archive` → `npm run ingest` → refresh.
- The engine (roadmap #7) has everything it was waiting for: the parsed scoring rules in SQL, contract history accruing per pull, and the ranking boards at their proper grain.
- The Kerf/engine columns visibly show "—" until the engine lands — the table is honest about what's computed vs. sourced.
- Three rostered players currently have **blank salaries on CBS itself** (t7) — shown as "—", counted $0 toward the cap, warned on every ingest. Worth watching after the auction.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| FA rows come from the FantasyPros board, not CBS's own free-agent page | `/players` is JS-rendered — not in the static archive | An unranked FA (deep bench stash) isn't in the table; FA "Proj Points" blank | Page/JS-render the `/players` capture later; the board view already unions rostered + FA sources |
| Transaction `players_text` is one verbatim cell; type is inferred, no per-player normalization | CBS gives no type column; full enumeration needs in-season variety | FAB analysis needs parsing later; unknown future type labels land as-is | Parse `players_text` into per-player moves when the price-curve work needs it — raw text is all preserved |
| Salary is INTEGER; a decimal salary would fail ingestion loudly | League deals in whole dollars; a decimal means CBS changed something | An intentional CBS change to fractional salaries blocks ingest until we look | One-line migration + coercion change — deliberate tripwire, not an accident |
| `posEcrTier`/`dynPosTier` reuse the overall board's tier | FP's positional boards weren't ingested for STD; overall tiers group identically within one position | Positional tier bands are the overall tiering filtered — fine until someone wants FP's per-position tiers | Ingest positional STD boards (archiver probe + grain already support it) |

**Post-build review round (same day, same issue).** An independent read-only review of the committed diff found **one bug that mattered and several worth fixing**; all are fixed, tested, and re-verified. Recording it here because the first one is the kind of failure that would have been trusted rather than noticed:

- **The board could serve a stale snapshot (fixed — migration 002).** `latest_pull` picked the highest `pull_id`, which is assigned at first successful *ingest*, not at *capture*. The documented recovery workflow — a run fails validation, the parser is fixed, the run is re-ingested with `--all` — would give that older snapshot the highest id and make it "latest": old rosters in the table, the stale date in the banner, and **nothing flagged as wrong**. On auction day that is the worst failure this store has. Now ordered by `captured_at`, with a test that ingests an older run last and asserts the newer one still wins.
- **FantasyPros nulls were becoming zeros (fixed).** `Number(null)` is `0`, so an untiered player would have rendered a literal **"Tier 0"** band and a single-vote player would have handed the engine an expert spread of `0` — "perfect consensus" — when the truth was "unknown". Writing the test for this surfaced a second instance the reviewer hadn't caught: a null `rank_ecr` was silently becoming **rank 0, the best rank on the board**. No live rows hit either path yet, so this was latent, not observed.
- **Hardening, all fixed:** the board view's rostered branch now filters to the league's positions (one rostered kicker would have taken the *whole page* down via `deriveBoard`'s throw); the data-access module falls back to the loud "no data" banner instead of a 500 if the store is unreadable; ingestion iterates the team ids CBS actually published rather than a hardcoded 1–12; warnings collected before a failure are printed with it (they are usually the explanation); `ingestRun` wraps its own transaction so no caller can forget atomicity; a duplicate `cbs_player_id` within one FantasyPros board is now refused (the last remaining path to a duplicated table row).
- **`lib/dataDictionary.ts` was stale and user-visible** — it still said positions were "QB, RB, WR, or TE" and that data was "pending", on the same screen as real league data. Sourced fields now describe the real pipeline; only engine outputs remain marked placeholder.
- **Tests:** 69 → **84**. The FantasyPros mapper had no tests at all despite being the module whose entire job is surviving source-format drift; it now has 13.

**Follow-up decisions needed from the product owner**
None. (D-11 was decided before the build; the display-board choice — draft/standard — was decided in the same conversation.)

### 2026-08-25 — Source-profiling spike (CBS field inventory + FantasyPros HOF re-verification)

**Ticket / Issue:** [#11](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/11) · **Branch:** feat/issue-10-raw-archival · **Deviated from plan:** Yes (one owner decision changed the deliverable's contents; findings corrected several plan assumptions)

**Original intent**
Close the discovery gap: profile the raw archive field-by-field, extract the `/rules` scoring values, profile all 12 rosters (characterizing dead-cap pseudo-rows and Practice Squad), enumerate transaction types, re-verify the FantasyPros HOF unlock, and confirm whether CBS projections are KERFUFFLE-scored. Deliver a committed profile — shape only, no real league values.

**What was actually built**
A generator at `tools/profile/` (`npm run profile`) that walks the latest raw run and writes four committed files to `docs/profiles/`: `cbs_field_profile.json`, `fantasypros_field_profile.json`, `cbs_scoring_rules.json` (real values, in full), and a human-readable `PROFILE.md` answering the six questions. Pure logic (type inference, blank-rate, scoring parser, sanitizer) is unit-tested (23 new tests); a leak self-check fails the run if any private field would publish a real value.

**Deviations**
1. **Sanitization scope became an explicit owner decision.** The owner pushed back on *why* we sanitize at all. Surfacing that the repo is **public** reframed it: the answer is "A" — mask player/roster/market values, list only non-private structural enums, commit league *rules* in full.
2. **Several plan/discovery assumptions were wrong** and are now corrected in the discovery docs (see below).
3. Added a dev-only dependency (`node-html-parser`) rather than hand-rolling a fragile HTML parser.

**Why we deviated**
(1) The owner is right that most of this data isn't secret — the real reasons are public-repo exposure of the league's private roster/salary state, keeping the drift-diff meaningful, and FantasyPros ToS; none is "critical," so the honest framing mattered. (2) The earlier spikes profiled only to page level (word-count signals); field-level profiling exposed the reality. (3) CBS HTML carries heavy inline JS; a real DOM parser is more reliable and de-risks the #12 parser too.

**Product implications**
- The **schema (#12) can now be designed against proven shapes.** Rosters, `/rules`, `/standings`, `/history` parse cleanly; **`/players`, `/transactions`, `/draft/results`, `/scoring/live` are JS-rendered/paginated** and their data is *not* in the first static snapshot — ingestion must page/JS-render those. This is the biggest correction.
- **KERFUFFLE scoring is captured** and **CBS disagrees with the written constitution** (defensive Int = 2 on CBS, not 3). CBS is authoritative; the engine must use the parsed value. Good thing it was never hardcoded.
- **FantasyPros HOF is fully confirmed** (full board, projections/metadata/news unlocked) — but the issue's success signal `public_api_limited: false` was **wrong**: the flag stays `true` even on HOF. Use row count + `tier` instead. ADP still `403` (nice-to-have).
- **Dead-cap pseudo-rows: none exist right now** (pre-auction), so the open modelling decision (#7) still can't be settled from live examples — but the detection rule is confirmed (a roster row with a salary and no player id).

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| `node-html-parser` dev dependency | Reliable header-name column mapping vs. fragile regex | None (dev-only, not shipped in the app) | Removable; the #12 parser will likely reuse it |
| Profile can't characterize dead-cap pseudo-rows (none in snapshot) | They don't exist pre-auction | #12 schema for pseudo-rows rests on the constitution + a detection rule, not a live example | Re-run `npm run profile` after a cut/auction creates one |
| ADP endpoint unresolved (`403`) | Out of scope; nice-to-have | No ADP "market" signal yet | Find the correct path/params on a later pass |

**Follow-up decisions needed from the product owner**
- [ ] **Dead-cap pseudo-row / Practice-Squad schema modelling** (roadmap open decision #7) — still the owner's call before #12. #11 delivered the evidence (detection rule + current counts: 0 pseudo-rows, 10 PS players) but no live pseudo-row to model against.

### 2026-08-25 — Raw snapshot archival tool (issue #10, roadmap #4)

**Ticket / Issue:** [#10](../../../../issues/10) · **Branch:** feat/issue-10-raw-archival · **Deviated from plan:** No — built to the issue as written; the only choices were the builder's-call items the issue flagged.

**Original intent**
Promote the throwaway spike pull scripts into a minimal, repeatable archival tool that saves every fetched CBS page and FantasyPros response **verbatim** into dated, append-only folders under `data/raw/`, each with a small manifest — so no week's data is lost while historical-CBS retrieval and FAB amounts remain unsolved. Explicitly no parsing, no database, no scheduling.

**What was actually built**
A durable tool at `tools/archive/`: `capture.mjs` (archiver), `check-cookie.mjs` (promoted cookie checker), `shared.mjs` (env-loading + paths + run-id helpers), and a how-to-run `README.md`, wired to `npm run archive` and `npm run archive:check-cookie`. Each run creates `data/raw/{timestamp}/` with `cbs/*.html` (all 12 rosters + the league page set), `fantasypros/*.json` (the probe set), and a per-run `manifest.json` listing every response (source, URL, fetched_at, HTTP status, plus bytes and a login/expired flag). Append-only via a fresh timestamped folder per run, with a collision guard so an existing folder is never overwritten. Credentials are read from the existing spike `.env` files; `data/` is git-ignored.

**Deviations**
None from the issue's scope. The owner's builder's-call decisions: (1) credentials **reused from the spike `.env` files** rather than a new consolidated file (zero re-paste); (2) the spike `pull.mjs` scripts **left in place** for now, with a follow-up to delete them once the tool is trusted; (3) the **cookie checker carried into the tool**. Two small realities the plan didn't name, both handled and archived-as-is: the CBS `players-rankings` page returns a `302` redirect (not content), and the FantasyPros `adp` endpoint still returns `403`.

**Product implications**
The owner now has one command that captures a complete, dated, verbatim snapshot of the league and expert rankings — the history layer that can no longer be lost to un-snapshotted weeks. It is **not** ingestion: nothing is parsed, and no number reaches the app (still 100% mock). A useful side-observation for planning: the archival runs pulled **~520-row** FantasyPros payloads with **projections and player-metadata unlocked** on the HOF key — strong evidence the HOF cap-lift is real, which de-risks the engine build. That does **not** close issue #11 — the formal, committed field profiling and rate-limit re-check still belong there; #10 only proves the pipes carry data.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| The durable tool reads credentials from the **throwaway spike `.env` files** | Owner chose zero re-paste over a clean consolidated env file | The "durable" tool is coupled to folders we intend to retire; a careless spike cleanup could delete the `.env` and break archiving | Move two `.env` files into the tool's home and repoint `shared.mjs` — a few minutes, do it when the spikes are cleaned up |
| Superseded spike `pull.mjs` scripts left committed | Removing committed files is separate scope; owner wants a working-threshold first | Two copies of the pull logic can drift/confuse | Delete `spikes/*/pull.mjs` once the tool is trusted — **keep the `.env` files** (see above). Tracked in `roadmap.md`. |
| The tool has **no unit tests** (validated by live runs only) | It is thin credential-and-network I/O; the meaningful proof is an end-to-end run against the real sources | A future refactor isn't regression-guarded | Add a fake-fetch unit test around the folder/append + manifest logic if the tool grows |
| CBS `players-rankings` `302` and FantasyPros `adp` `403` archived without resolution | Archival preserves whatever the source returns; resolving them is a parser/#11 concern | A parser that assumes those are content will misread them | Note is in `current_state.md`; resolve during #11/ingestion |

**Follow-up decisions needed from the product owner**
- [ ] **Delete the superseded spike `pull.mjs` scripts** once the archival tool has cleared a working threshold — **without** removing the spike `.env` files the tool now reads from. Promoted to `roadmap.md` (Later). Not blocking.

---

### 2026-08-20 — FantasyPros data discovery spike (issue #7, roadmap #3)

**Ticket / Issue:** [#7](../../../../issues/7) · **Branch:** spike/issue-7-fantasypros-discovery · **Deviated from plan:** Yes — reality was *easier* than the plan feared, on the two hardest points.

**Original intent**
Timeboxed spike to prove FantasyPros access and, above all, solve the roadmap's "expected ugliest part" — matching FantasyPros players to CBS players. The roadmap assumed FantasyPros access was **approval-gated** (fallbacks: scrape, or manual export) and that player-ID matching would be a messy name/team/position problem.

**What was actually built / found**
A read-only discovery harness (`spikes/fantasypros-api/` — `pull.mjs`, `match.mjs`, README, `.env.example`) and a findings report ([`../fantasypros_data_discovery.md`](../fantasypros_data_discovery.md)). Findings:
- FantasyPros has an **official JSON API that is self-serve, not approval-gated.** A free key authenticates immediately (`x-api-key`).
- Rankings return everything the engine needs: **ECR, positional rank, tiers, and the expert spread**, across redraft + dynasty + ROS + weekly and PPR/half/standard, from 99 experts.
- **The join is trivial, not ugly:** every FantasyPros player carries a **`cbs_player_id`** equal to CBS's own id. Confirmed against real CBS ids (Chase `2966320`, Nacua `3121687`, McCaffrey `2136743`). No fuzzy matching needed.
- **The real constraint is cost, not access:** the free tier is a **top-10-of-520 preview** (`public_api_limited: true`) and blocks projections/metadata/ADP/news (`403`). The full board needs the **HOF tier (~$9/mo)**.

**Deviations**
Two, both favorable: access was **self-serve, not approval-gated**, and the player-match was a **direct id join, not fuzzy matching**. One scope deviation by owner decision: the **manual-export fallback was not tested** (API-only spike). And a reality the plan didn't name: the free tier is preview-only, so the product now depends on a **paid subscription**.

**Why we deviated**
FantasyPros shipped a real self-serve API since the roadmap was written, and — unusually helpfully — publishes the CBS id directly, which collapses the entire cross-source matching problem. The cost gate is simply how FantasyPros monetizes the API (free = preview).

**Product implications**
FantasyPros ingestion is **viable**, and the scariest architectural risk (joining two independent player universes) is effectively gone — a direct `cbs_player_id` map replaces what could have been a brittle, error-prone matcher. Both data sources (#2 CBS, #3 FantasyPros) are now access-proven, so the **valuation engine (#4) is unblocked**. The cost: the tool now requires a **~$108/yr FantasyPros HOF subscription** to function on real data (the owner upgraded). One thing is **assumed, not yet confirmed**: that HOF lifts the 10-of-520 cap and opens the gated endpoints — the key hadn't propagated to HOF at write-time, so a confirming re-run is owed before the engine build. Downstream planning may proceed on the GO, but should treat "full 520-player board" as confirmed-pending until that re-run.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| A paid single-vendor dependency (FantasyPros HOF ~$108/yr) for ECR/tiers | It's the source the product is defined around, and the only one that publishes the CBS id | Ongoing cost; a provider outage/price change hits ingestion | Cached, `cbs_player_id`-keyed ingestion keeps a provider swap contained |
| HOF unlock assumed, not verified | The key hadn't propagated at write-time; owner didn't want to block on it | Engine could be planned against a board we haven't actually pulled in full | One re-run of `pull.mjs` once the key is live (expect ~520 rows, `public_api_limited: false`) |
| Rate limiting observed (429 on bursts) | Free-tier throttling | Naive per-view fetching would get throttled | Ingestion must pull-and-cache + refresh on a schedule (noted in findings §5) |

**Follow-up decisions needed from the product owner**
- [ ] None blocking. When ingestion is built, the HOF **API key is a credential** (local env only, never committed). The one owed action is a **confirming re-run** once the key reflects HOF — not a decision, just verification.

---

### 2026-08-20 — CBS data discovery spike (issue #5, roadmap #2)

**Ticket / Issue:** [#5](../../../../issues/5) · **Branch:** spike/issue-5-cbs-api-discovery · **Deviated from plan:** Yes — the *method* is not what the plan assumed.

**Original intent**
Timeboxed spike to prove CBS access against the real league and inventory the data — especially whether **contract length** lives in CBS. The issue assumed the likely path was the documented CBS v3 JSON API (`access_token` + `response_format=json`).

**What was actually built / found**
A read-only discovery harness (`spikes/cbs-api/`) and a findings report ([`../cbs_data_discovery.md`](../cbs_data_discovery.md)). We proved we can pull real KERFUFFLE data — but **not** the way the issue assumed:
- The **old JSON API is dead.** `…/fantasy/<method>/?response_format=json` returns the web page (HTML), not JSON, even authenticated. The `access_token` route is gone.
- The **working method is authenticated HTML scraping**: the modern league site renders data into page tables, gated only by the owner's **session cookie**. Every team's roster, the FA pool, transactions, rules/scoring, and draft/auction values are reachable read-only at clean URLs.
- **Contract length IS in CBS** — a per-player "Contract" column (1–4 yrs) beside Salary. Confirmed against the owner's real roster.

**Deviations**
The auth mechanism (session cookie, not `access_token`) and the data format (HTML tables, not JSON) both differ from the issue's assumption. The plan's fallback intuition — "re-extract the token from the browser" (already in `user_flows.md`) — turned out to be exactly right; the automated-login path was moot.

**Why we deviated**
CBS deprecated and then effectively removed the public v3 fantasy API; the current site is a server-rendered app. We discovered this empirically by probing hosts and then analysing a browser HAR the owner captured.

**Product implications**
CBS ingestion is **viable** and the biggest unknown is retired: contract length is available, so we do **not** need a Commissioner's-sheet import for it (roadmap open decision #1 → resolved). The engine and lenses can plan on real rosters, salaries, contracts, transactions, and scoring. Two capabilities are **not yet proven** and become their own follow-ups: pulling a **specific past season** (the backtest needs this — the year filter is JS/POST-driven, not a URL param) and reading **FAB winning-bid amounts** (the waiver price curve needs this). Ingestion also now implies a per-refresh **cookie re-extraction** step and a real schema — both deliberately deferred until the ingestion build.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| Ingestion will parse HTML, not consume an API | CBS offers no working API | Parser is sensitive to CBS layout changes | Keep it thin/central; re-verify if a page changes |
| Auth is a session cookie that expires | It's the only thing that works | Data goes stale (~weekly) until re-extracted | Build re-extraction + a clear "stale/expired" state |
| Historical-season + FAB-bid retrieval unsolved | Out of this spike's timebox | Blocks backtest (#5) and waiver curve until solved | Focused follow-up spikes when those items come up |

**Follow-up decisions needed from the product owner**
- [ ] None blocking now. When ingestion is built, storing the session cookie is a **secrets/credentials** matter (local env only, never committed) and introducing a real **schema** is a sensitive change — both will be flagged then.

---

### 2026-08-20 — Table redesign Phase 3: data dictionary shell (placeholders)

**Ticket / Issue:** [#1](../../../../issues/1) (owner design feedback) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** No (owner asked for structure now, content later)

**Original intent**
Final phase of the redesign: a bottom-of-page overlay defining each field — a concise (<15-word) definition plus an expandable bulleted deep-dive (mechanics + source). Owner explicitly asked to **set up the structure with placeholders now** and fill real content after data discovery.

**What was actually built**
Exactly that. `lib/dataDictionary.ts` holds one entry per column (definition + deep-dive bullets + a `placeholder` flag), with real one-liners for the UI-native fields (Owner, Player, Pos, Team, Ceiling, Edge) and clearly-flagged placeholders for the engine/market fields. `components/DataDictionary.tsx` renders a "📖 Data Dictionary" button that opens a modal (Esc/backdrop/✕ to close) listing every field with an expandable "Details" section. A unit test guarantees every column is documented and every definition stays under 15 words.

**Product implications**
The owner can open a per-column reference now; the honest "Placeholder" chips make clear which entries still need real source/mechanics content. This closes the 3-phase redesign. The next real work is data discovery (roadmap #2–3), after which the placeholders get filled.

**Technical tradeoffs and debt**
- Content is a stub by design — the debt is intentional and tracked by the `placeholder` flags; nothing to pay down until discovery.
- The modal is a lightweight custom overlay (no focus-trap library); fine for a single-user prototype.

**Follow-up decisions needed from the product owner:** None now. The dictionary **content** (real source + mechanics per field) gets written during/after data discovery and the engine build.

---

### 2026-08-20 — Phase 2 polish: filter model + two bug fixes

**Ticket / Issue:** [#1](../../../../issues/1) (owner review of Phase 2) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** No (owner-requested changes + bug fixes)

**What changed**
- **Filter model** reshaped at owner's request: the roster control is now a 3-way toggle (All / Rostered / Free Agents) beside a renamed **Manager** dropdown (All / team). The old "Free Agents in the dropdown + include-FA checkbox" model was replaced. The saved-views model changed shape accordingly (`{ manager, rosterMode }`), and the default views were remapped (Auction/Waivers → Free Agents; Trades → Rostered; Start/Sit → Manager = Raccoons).
- **Bug 1 (tier bands):** sorting by Ovr ECR / Dyn Ovr ECR produced duplicated, out-of-order bands and a React duplicate-key crash. Root cause: those columns sorted by the **raw** ECR values, which have ties, so the row order didn't match the (unique) tier ranking → non-contiguous tiers. Fix: those columns now sort/display the **unique derived overall rank** (`ovrEcrRank`/`dynOvrRank`), matching the other four rank columns; band keys also made collision-proof. Guarded by a new unit test.
- **Bug 2 (hydration):** @dnd-kit emitted server/client-mismatched accessibility ids. Fix: the drag context now mounts **client-side only** (SSR renders plain, sortable-on-click headers), verified by checking the server HTML is drag-attribute-free.
- **Scroll UX:** the table now lives in a bounded-height container with a **sticky header**, so the horizontal scrollbar is reachable without scrolling to the bottom of a tall table.

**Product implications**
Cleaner, less-ambiguous roster filtering; the tier view is trustworthy on every rank sort; no console errors on load; easier side-to-side scrolling. Still mock data.

**Technical tradeoffs and debt**
- "Ovr ECR" now shows a contiguous 1..N overall rank rather than the raw authored consensus number — arguably more correct, and it's what makes tiers stable. Noted in case the real FantasyPros data wants the raw ECR shown instead (revisit at ingestion).
- The sticky-header `max-height` is a rough `calc(100vh - 15rem)`; may need tuning as the controls above it change.

**Follow-up decisions needed from the product owner:** None new. Phase 3 (data dictionary) content questions still pending.

---

### 2026-08-20 — Table redesign Phase 2: the view system

**Ticket / Issue:** [#1](../../../../issues/1) (owner design feedback) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** No (built to the agreed Phase 2 scope)

**Original intent**
Phase 2 of the redesign: replace the roster buttons with a single dropdown, add a free-agent toggle, add column show/hide + drag-to-reorder, and add saved custom views (with default views mirroring the user flows), persisted in localStorage.

**What was actually built**
All of it. Roster dropdown (All Players / Free Agents / each team) + a separate "include free agents" toggle; a column picker (show/hide, with "Player" locked visible); drag-to-reorder headers via **@dnd-kit** (bound to TanStack's `columnOrder`); and a saved-views system (`lib/views.ts`) — five built-in default views plus user-created custom views, stored in **localStorage** and unit-tested. Opens to Full.

**Decisions worth noting (owner-resolved this session)**
- **"Free agents only" gap:** the dropdown+toggle model couldn't express "free agents only" (which Auction/Waiver need). Resolved by adding **"Free Agents" as a dropdown option**; the toggle then folds FAs into the All-Players/team views.
- **Opens to Full** (not last-used); **ceilings keep resetting** (owner deferred ceiling persistence); a saved view stores visible columns + order + sort + all filters; the **Player** column is always visible.
- Default-view sorts were all set to **Kerf Ovr Rank** (kept the sort column visible in every preset, so its bands/indicator make sense).

**Product implications**
The owner can now shape the table for each use case and save those arrangements — the mechanism the user flows imply. Still mock data; the default views' column choices are a starting point to react to. Nothing about the real build changed.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| Two new deps (@dnd-kit; Vitest earlier) | Drag UX + strong validation, both owner-requested | Standard, well-maintained libs | — |
| Saved views persist in localStorage (per-browser, not synced) | Local-first, no backend yet | Views don't follow the owner across machines | Real sync needs a backend — out of scope until deployment |
| No component/interaction tests (drag, save-view wiring) | jsdom + Testing Library is a bigger lift; the *logic* is unit-tested | DOM wiring not regression-guarded | Add Testing Library when it stabilizes |
| `window.prompt` used to name a new view | Simplest for a local prototype | Slightly clunky UX | Swap for an inline input later |

**Follow-up decisions needed from the product owner:** For **Phase 3** (data dictionary): the per-field definitions + how much "source/mechanics" detail to write now, given the engine fields aren't real yet. Comes when we start it.

---

### 2026-08-20 — Table redesign Phase 1: dark theme, columns, tier bands

**Ticket / Issue:** [#1](../../../../issues/1) (owner design feedback) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** N/A (new, owner-directed redesign, phased 1 of 3)

**Original intent**
Owner feedback asked to mirror a dark Gamecast/FantasyPros aesthetic and substantially expand the table: dark theme, colored position badges, tier *bands* (not a column) with field-specific tier sets and a coupled sort↔position rule set, a position dropdown with SuperFlex/Flex, expanded/renamed rank+ECR columns, group tints + a color key, and a sleeker sort caret. Agreed to build in **three phases**; this is Phase 1 (look + columns + tier logic). Phase 2 = the view system (filter-bar redesign, column show/hide, drag-reorder, saved views on localStorage, via @dnd-kit). Phase 3 = the data-dictionary popup.

**What was actually built**
All of Phase 1. Dark tokens (teal accent, compact) — the design-token layer from D-02 made this a config-level change. Six mock tier dimensions and the sort/position/tier state machine, both **unit-tested** in `lib/tierRules.ts` + `lib/mockData.ts`. The position dropdown, badges, regrouped/renamed columns, plain Edge, group legend. **Vitest** was added as the test runner (14 tests).

**Deviations & decisions worth noting**
- **Scope nudge:** the position dropdown (with SuperFlex/Flex) was pulled into Phase 1 because the tier bands depend on it. The rest of the filter bar stays Phase 2.
- **Default-tier vs revert nuance (owner-resolved):** load shows Kerf-Ovr-Rank tiers ON; leaving a positional sort by picking a multi-position clears the sort → same base order, tiers OFF. Implemented as "bands show only when the *active* sort is a rank column," so clearing the sort naturally removes bands.
- **SuperFlex == All** with the current data (only QB/RB/WR/TE) — kept anyway at owner's request for future-proofing.
- **Tiers are mock** (bucketed by rank). Real tiers come from the engine (Kerf) and FantasyPros (ECR) later.
- Added **Vitest** — a new dev dependency (see decision_log D-04).

**Product implications**
The owner now has the near-final look and the full column/tier behavior to react to, on mock data. Nothing about the real build changed. Interactive view features (hiding/reordering columns, saving views) and the data dictionary are explicitly still to come (Phases 2–3).

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| The sort↔position↔tier coupling is intricate stateful UI | It's the owner's designed behavior | Could grow hard to reason about if scattered | Mitigated: all rules live in `lib/tierRules.ts` with unit tests |
| Six mock tier dimensions bucketed by rank | Real tiering needs the engine/FantasyPros | Bands aren't "real" groupings yet | Replaced when engine/ECR tiers land |
| Legacy `tier` field left on the data (unused) | Avoided editing 79 rows | Minor dead field | Delete when convenient |

**Follow-up decisions needed from the product owner:** None new — Phase 2 questions (free-agent toggle logic, default-view contents, drag UX) come when we start it.

---

### 2026-08-19 — Follow-up: semantic design-token layer for styling

**Ticket / Issue:** [#1](../../../../issues/1) (same build cycle) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** Yes — an owner-requested structural improvement

**What happened**
Reviewing the styling, the owner asked whether it was built for expandability — specifically whether there was a single style-guide/token file that components pull from, so a second module would stay consistent. There wasn't: colors were hardcoded as raw Tailwind classes (e.g. `bg-sky-50`) repeated across 8 files, and `tailwind.config.ts` defined no palette. At his direction I introduced a **semantic design-token layer** (D-02): the palette is now defined once in `tailwind.config.ts` by role (`yours`, `market`, `edge`, `tier`, `warning`, plus neutral `surface`/`ink`/`line`/`brand`), and all 8 files were refactored to use those tokens.

**Deviations / why:** A structural refactor beyond Issue #1's scope, done because the owner wanted the foundation right before layering on visual feedback — which is sound: the token layer means his coming feedback is a one-file change.

**Product implications**
No user-facing change — the tokens map to the exact shades already in use, so the app looks the same. The one deliberate visual delta: tier badges now use a single subtle neutral ring instead of a per-tier darker ring. Verified: `npm run build` passes, no raw color classes remain in `app/`/`components/`, and each token compiles to its expected color.

**Technical tradeoffs and debt:** None of note. Slight indirection (token name vs. raw color), accepted for the single-source-of-truth payoff. Neutrals are tokenized too, so dark mode later is a config change rather than a rewrite.

**Follow-up decisions needed from the product owner:** None. (The owner has visual feedback coming next — it now lands in `tailwind.config.ts`.)

---

### 2026-08-19 — Follow-up: shared-table columns for the non-auction flows (Proj Pts, KERF Rank)

**Ticket / Issue:** [#1](../../../../issues/1) (same build cycle) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** Yes — a small, owner-directed scope addition

**What happened**
Reviewing the auction-focused prototype, the owner noted it lacked fields the *other* flows (waivers, trades, start/sit) need — projections and rankings — and asked where they were. Per the product's "one table, many filters" rule, two are genuine shared-table fields, so at his direction I added mock **Proj Pts** (projected KERFUFFLE points) and **KERF Rank** (positional rank from KERFUFFLE value, e.g. "RB1") to the "Yours" column group. Proj Pts is derived from the mock KERF value (not an independent projection); KERF Rank is computed from value ordering — both clearly mock. The remaining fields the review surfaced (waiver bid range, remaining cap, trade side-by-side + cap legality, start/sit matchup data, drill-into-inputs) are per-lens or engine-dependent and were logged to [`../feature_backlog.md`](../feature_backlog.md) rather than faked onto the auction view.

**Product implications**
The prototype now shows a fuller version of the shared table, so the owner's reactions cover the non-auction flows too — not just auction prep. Nothing about scope for the *real* build changed; the per-lens fields still arrive with their flows (roadmap Phase 2 / #6–7).

**Deviations / why:** A deliberate step beyond Issue #1's fixed column list, made on the owner's explicit call during review — the kind of change the UI-only prototype exists to invite. `npm run build` passes; render of both columns verified.

**Follow-up decisions needed from the product owner:** None new.

---

### 2026-08-19 — Player table prototype (UI only, mock data)

**Ticket / Issue:** [#1](../../../../issues/1) · **Branch:** feat/issue-1-player-table-prototype · **Deviated from plan:** No

**Original intent**
Build the centerpiece player table as a clickable local prototype on mock data — one screen, ~80 real-name players with invented salaries, the full column set, sort plus roster/position filters, tier badges, an inline-editable Ceiling, and a permanent "MOCK DATA" indicator — on the keepable stack (Next.js/TypeScript, D-01), so the owner can react before any real data pipeline or valuation engine is built.

**What was actually built**
Exactly that. A single-screen Next.js (App Router) + TypeScript app, styled with Tailwind, table powered by TanStack Table v8. 79 hand-authored mock players across QB/RB/WR/TE spanning the free-agent pool, the Rangoon Raccoons' roster, and three rival rosters. Columns: Owner, Player, Pos, Team, Tier (color badge), KERF Value, Ceiling (editable), Edge, Market Price, ECR, Dynasty ECR, Salary, Contract. Runs with `npm install` then `npm run dev` at http://localhost:3000 — no login, no second screen, no data schema, no engine.

**Deviations**
None from the approved plan. Three owner-approved choices were folded in during planning (confirmed before building, not deviations): a derived **Edge** column (KERF Value − Market Price, color-coded, sortable); an **Owner** column showing the fantasy team; and the Ceiling column **pre-seeded** with each player's KERF Value. All three go slightly beyond the issue's literal column list.

**Product implications**
The owner can now open a realistic auction-prep table locally and feel out what's useful — sort it, filter it to roster views, read tiers, type ceilings — and tell us what to change before we build the real pipeline and engine. It is a prototype: every number is invented and resets on reload; it reflects no real league state.

**Technical tradeoffs and debt**

| What we took on | Why | Cost of leaving it | Cost of fixing it |
| --- | --- | --- | --- |
| 3 high-severity npm advisories in Next 15's transitive deps (postcss build tooling; sharp image lib) | The only patch bumps Next to v16 — a breaking major-dependency change, which is the owner's call | Negligible for a local, no-image, no-untrusted-input prototype; would matter before any web deployment | ~half a day to move to Next 16 and re-verify |
| Mock data is a flat in-repo fixture (`lib/mockData.ts`), not a schema | Deliberate — no real sources verified yet (roadmap #2–3) | None now, provided it is never mistaken for a real data model | Replaced wholesale when real ingestion lands |
| No automated tests; verification is build/lint + manual QA | Prototype with throwaway data; owner approved in the plan | Sort/filter/edit interactions aren't regression-guarded | Add component tests once the table stabilizes on real data |

**Follow-up decisions needed from the product owner**

- [ ] Upgrade to Next.js 16 to clear the 3 npm advisories? — blocks nothing now; settle it before any web deployment.
- [ ] After using the prototype: which columns / filters / interactions to change — the whole reason it shipped. Feeds roadmap #6 (table on real data).

---

**Related docs:** [`current_state.md`](current_state.md) is the up-to-date snapshot this log rolls into. [`roadmap.md`](roadmap.md) is where follow-up decisions get promoted. [`product_vision.md`](product_vision.md) is what a repeated deviation should eventually make us question.
