# Roadmap — Gart Dash

> **How to use this doc**
> **Owner:** Product owner, with PM Claude.
> **Update when:** A phase completes, priorities change, or a decision unblocks future work.
> **This doc contains:** What we are building next, in what order, and why that order.
> **This doc never contains:** Claims about what is already built. An item sitting in "Now" may not exist yet — [`current_state.md`](current_state.md) is the only doc that says what is real.

**Last updated:** 2026-08-27

---

## Current phase

> ### ▶ IN-SEASON DECISION SUPPORT — rank players through the season; decide waivers, starts, and trades on the edge
> **We are here.** The 2026 Free Agent Auction is complete (2026-08-26) and was handled **outside** the tool (open decision #3 — "the calendar won"). The engine now turns to in-season use.
> **First up:** rest-of-season (ROS) rankings — the in-season value number every other lens reuses — then weekly rankings / start-sit, then the waiver and trade lenses.

The auction is behind us; the season is the horizon now. **ROS value is foundational:** waivers, trades, and start/sit all read from it, so it is built first.

## MVP scope

> **Note (2026-08-27):** the **auction-ready** MVP below is substantially delivered (live data, valuation engine, shared table). The 2026 auction was run outside the tool, so the **auction-prep lens** is the one unfinished MVP item and is now deferred to *Later* (next auction is ~a year away). Current focus is the **in-season** phase above.

**In scope — the MVP is not done without these** *(from [`product_brief.md`](../product_brief.md))*:

- Live CBS + FantasyPros data ingestion — every view reflects real league state.
- The valuation engine — KERFUFFLE-adjusted values beside market consensus, tiers, drillable.
- The shared player table — one view, many filters, serving all decisions.
- Auction prep lens — suggested + editable ceilings, cap-sum check.
- Waiver and trade lenses — the same table filtered for FAB bids and trade evaluation/construction.

**Explicitly deferred — good ideas we are consciously not building yet:**

| Deferred | Why it can wait |
| --- | --- |
| Web deployment | Local-first proves the tool; architecture must not preclude deployment, but hosting/auth wait. |
| Drop candidates + dead-cap cost on waiver claims | Deferred from user_flows v1; strong future candidate, not auction-critical. In [`feature_backlog.md`](../feature_backlog.md). |
| Contract-duration recommendations | Gated on real-life NFL contract/depth-chart data — a vision non-goal until that changes. |
| Live auction tracking / dynamic re-ranking | Auction day is deliberately a static reference. Building this is an owner decision, never an enhancement. |
| Start/sit as a feature | The roster-filtered table is the entire support; documented in [`user_flows.md`](../user_flows.md) flow 5. |

## Now / Next / Later

### Now — In-season ranking foundation, in order

| # | Item | Why now | Depends on |
| --- | --- | --- | --- |
| 1 | **ROS + weekly data plumbing ([#27](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/27))** | The engine needs in-season inputs: ROS + weekly consensus in the league's **STD/superflex** format, plus **per-week projected stat lines**. The consensus parser already handles ROS/weekly types; this adds the STD/OP variants, the weekly projections pull, and **ROS-fallback-to-draft handling** (preseason ROS returns the draft board). | — |
| 2 | **ROS engine — Kerf ranks/tiers/dollars, weekly-refreshed ([#28](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/28), Option A)** | **The in-season value number every other lens reuses.** Re-runs the existing engine (#18/#20) on FantasyPros' **refreshed full-season projection** each week → updated Kerf ranks/tiers/dollars/Edge, with **ROS ECR** as the market column. Option A (full-season proxy); true remaining value (Option B) is queued to Next. | #27 |
| 3 | **Weekly rankings + start/sit lens ([#29](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/29))** | Per-week Kerf re-score **beside** weekly consensus (with matchup opponent + expert start/sit lean), powering the now-**supported** start/sit flow — this **reverses the vision non-goal** (owner, 2026-08-27). | #27 (uses #28 machinery) |

> **Sequencing:** ROS value (#28) is foundational — waivers, trades, and start/sit all read from it — so it is built first, on the plumbing (#27); weekly/start-sit (#29) follows.

### Completed — Auction-Ready phase (shipped; the 2026 auction happened outside the tool, so the auction-prep lens is deferred to *Later*)

| # | Item | Why now | Depends on |
| --- | --- | --- | --- |
| 1 | **Player table prototype — UI only** | The owner prototypes what's useful before anything is engineered: columns, filters, sort, tiers, and the editable-ceiling column, iterated on cheaply. Mock data uses real NFL player names with realistic-but-invented salaries (sourced via web search). **UI only — no hard data schema until item 2–3 discovery reports back.** Simple as possible, but on the stack we keep: this is the foundation of the real table, not a throwaway. | Stack decided (D-01) — GitHub Issue #1 |
| 2 | **Spike + data discovery: CBS API** | Highest architectural risk. Auth via the mobile OAuth flow against the actual KERFUFFLE league, then a full inventory: what's accessible, formats, historical depth, whether contract *lengths* live in CBS or only salaries, barriers and risks. Timeboxed to days. | nothing |
| 3 | **Spike + data discovery: FantasyPros + joint discovery** | Access is unsolved (API is approval-gated; fallbacks: scrape, manual export — manual is acceptable for MVP and cannot block the auction). Then discovery of how the two sources work *together*, especially player-ID matching between CBS and FantasyPros — the expected ugliest part. | nothing (parallel to #2) |
| 4 | **Raw snapshot archival — the append-only history layer ([#10](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/10))** | Promote the spike pulls into a minimal archival tool that saves every fetched CBS page and FantasyPros payload verbatim into dated folders, with a per-run manifest. Manual runs, tied to the ~weekly CBS cookie refresh. **Ships first, small:** two unsolved problems (historical CBS retrieval, FAB bid amounts) mean un-snapshotted weeks are unrecoverable history for the price curve and backtest — start the archive now. | #2, #3 (proven sources) |
| 5 | **Source profiling spike — CBS field-level + FP HOF re-verification ([#11](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/11))** | Close the discovery gap: CBS was profiled only to page level, `/rules` scoring values were never extracted, only 2 of 12 rosters were pulled, and transaction types were never enumerated; FantasyPros needs re-pulling on the now-active HOF key. Produces a committed field profile (shape only, no league values) and the evidence for the pseudo-row schema decision. | #4 (profiles read from the raw archive) |
| 6 | **Storage schema + ingestion — the normalized SQLite layer ([#12](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/12))** | The store the engine and every lens read from: migrations for the normalized entities, ingestion parsers (header-name column mapping, string coercion, ingest validation), `pull` lineage on every row, idempotent upserts, temp-then-swap writes, and the flat board view — replacing `lib/mockData.ts` behind the same `Player` shape. Storage architecture approved ([D-10](../decision_log.md)). | #4, #5, and the open pseudo-row decision |
| 7 | **Historical data storage + ingestion ([#17](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/17))** | New prerequisite the engine block depends on: bring the owner-provided historical data into the store — CBS 2024/25 stat lines incl. **first downs** (source of the projection's first-down rates + the backtest's actual points), KERFUFFLE 2025 salaries (pre-auction price curve), and the TRUFFLE 2026 auction as **inert reference only** ([D-15](../decision_log.md)). New tables + a name→id matcher + a scoring cross-check. | Storage layer (item 6, #12) |
| 8 | **Valuation engine — projection core ([#18](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/18))** | FantasyPros component projections **+ estimated first downs** (rates from #17) → run through parsed KERFUFFLE scoring → **Kerf points → overall/positional ranks + tiers** in the table. **No dollars yet.** Stage 1 of "stage in two" ([D-13](../decision_log.md)). | #17 |
| 9 | **Backtest — the decision gate ([#19](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/19))** | **BUILT + RUN (2026-08-26).** Re-ran the core on 2024 & 2025 preseasons vs actual points, strictly out-of-sample, vs raw ECR (CBS's own projection unrecoverable → dropped, FantasyPros' own projection shown as reference). **Verdict: a real but MARGINAL and INCONSISTENT edge** — out-of-sample 2025 ρ Kerf 0.78 vs ECR 0.77; per-position mixed (helps RB, ~ties QB/WR, trails TE). Reproducible via `npm run backtest`; see [`backtest_results.md`](../backtest_results.md). **The go/no-go on that marginal edge is now an open owner decision (#11 below) — it, not the code, gates #20.** | #18 |
| 10 | **Valuation — VORP dollars, ceilings, price curve, Edge ([#20](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/20))** | **BUILT (2026-08-26).** Stage 2 ([D-13](../decision_log.md) + [D-17](../decision_log.md)): last-starter replacement (QB24/RB34/WR34/TE17) → cap dollars → **Kerf Value** (league-generic) + **Roster Value** (Raccoons-specific, replace-your-starter); **two market curves** (current + 2025 salaries; TRUFFLE off); **Edge = Kerf Value − Market (Now)** (bargain +); single-season, dynasty as context; drillable; prices sum to the cap. Folded into `npm run engine` (migration 007). Status lives in [`current_state.md`](current_state.md). | #19 gate — resolved; **done** |
| 11 | **Auction prep lens** | Suggested $ ceilings (roster-aware, cap-aware) beside the editable owner column; cap-sum check; ceilings saved for auction day. Done = the critical flow in [`user_flows.md`](../user_flows.md) completes end to end. | #20 |

**Why the three data-foundation items (4–6) sit ahead of the engine:** the engine reads from the schema and needs the `/rules` scoring values — building it first means building it twice. Items 1–3 are the completed prototype and the two data-discovery spikes (status lives in [`current_state.md`](current_state.md), not here). **Item 7 (#17)** was added 2026-08-26 once the owner supplied historical CBS stats/contracts: the engine's first-down rates and the backtest's ground truth live there, so it precedes the engine core.

**The engine is split into four GitHub issues** ([#17](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/17)→[#18](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/18)→[#19](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/19)→[#20](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/20)), staged with the backtest as the gate between the projection core and the dollar layer ([D-13](../decision_log.md)).

### Next — Phase 2: In-season decisions, in order

| # | Item | Why this order | Depends on |
| --- | --- | --- | --- |
| 1 | Waiver additions | First real in-season decision (Wednesday FAB runs from ~Week 1). Suggested bid range = **ROS engine value** through the price curve, with historical FAB wins as comparables, bounded by rivals' cap space. Same table, free-agent filter. | ROS engine ([#28](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/28)) |
| 2 | **True ROS remaining value ([#30](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/30), Option B)** | Nets ROS dollars down to what is actually **left** (refreshed season projection − actuals-to-date). Improves waiver/trade accuracy as the season progresses; needs CBS current-season actuals captured. Ideally lands before deep trade season. | ROS engine ([#28](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/28)) |
| 3 | Trade evaluation + construction | Offers arrive on their own schedule. Side-by-side KERFUFFLE points, roster-aware value, contracts vs. curve, cap-legality check for both teams; cross-roster filtering for target hunting. Same table. | Waivers; more accurate with true ROS ([#30](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/30)) |

### Later — real, but not yet scheduled

| Item | Why it is not "Next" | Revisit when |
| --- | --- | --- |
| **Auction-prep lens completion** (persisted ceilings saved for auction day + cap-sum check — the former Now #11) | The 2026 auction was handled outside the tool; the next auction is ~a year away, so this is no longer time-critical. The engine's suggested ceilings already render; only persistence + the cap-sum check remain. | Before the next KERFUFFLE Free Agent Auction |
| Web deployment | Local serves one user fine; deployment adds hosting/auth for zero new decisions served | The owner is regularly blocked by being away from the machine |
| Drop/dead-cap tool on claims | Valuable but not auction-critical | First time a claim forces a painful manual dead-cap calc |
| Contract-duration support | Requires real-life NFL contract/depth-chart data (vision non-goal until then) | That data enters scope deliberately |
| Live auction tracking | Deliberately excluded from auction day | Only by explicit owner decision after a real auction with the static tool |
| Automated snapshot scheduling | Snapshotting (#10) runs manually for now — a scheduled task with an expired CBS cookie silently collects nothing, so scheduling waits until cookie-lifetime is solved | After the auction prep lens item (Now #10) — promoted from the backlog 2026-08-24 |
| Retire the superseded spike `pull.mjs` scripts (cleanup) | The archival tool (#10) replaced `spikes/cbs-api/pull.mjs` + `spikes/fantasypros-api/pull.mjs`, but they're left committed until the new tool has proven itself over real use (owner's call, 2026-08-25) | The tool has cleared a working threshold — then delete the two `pull.mjs` scripts, but **keep the spike `.env` files**, which the archival tool reads its credentials from |

## Sequencing constraints

- **Prototype (#1) is UI-only until discovery (#2–3) reports** — building data structures around unverified sources is how the foundation gets rebuilt.
- **Data discovery precedes the engine** — the engine's inputs are whatever discovery proves exists, not what we assume exists.
- **Source profiling (#11) must precede schema finalization (#12)** — the profiler's evidence (dead-cap pseudo-rows, Practice Squad rows, transaction types, the `/rules` scoring values) is what the schema is built around.
- **Storage (#12) must precede the valuation engine** — the engine reads from the normalized store and its parsed `/rules` scoring values; building it first means building it twice.
- **Engine core precedes the backtest; the backtest gates engine completion** — validate the edge before paying for replacement level, tiers, and the price curve.
- **The engine precedes every lens** — all lenses are the same numbers filtered differently.
- **The auction lens precedes auction day** — the one immovable date in the project.

## Open product decisions

| # | Decision needed | What it blocks | Options under consideration | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| 15 | **Elevate start/sit to a supported flow?** Weekly rankings make start/sit a real feature — reversing the vision non-goal ("nothing gets built for this flow"). | The weekly issue ([#29](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/29)); the `product_vision.md` + `user_flows.md` §5 edits | (a) Keep start/sit unsupported (reference only) vs (b) elevate it to a supported flow | Owner | **Resolved 2026-08-27 — elevate.** Weekly shows the Kerf re-score + consensus + matchup/expert lean; the pick stays human (no optimizer). Vision non-goal + user_flows §5 updated as part of #29. |
| 14 | **ROS value method: full-season proxy (A) or true remaining value (B)?** | The ROS engine ([#28](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/28)) and Option B ([#30](https://github.com/GartRuzza/kerfuffle_gart_dash_v2/issues/30)) | (a) Option A — re-rank on FantasyPros' refreshed full-season projection vs (b) Option B — net out season-to-date actuals for true remaining $ | Owner | **Resolved 2026-08-27 — A now, B later.** No first-class ROS projection exists on the FP API (a read-only probe confirmed `week=ros` falls back to the current week); A reuses the engine and ranks correctly; B is queued to *Next* once CBS current-season actuals are captured. |
| 13 | **How deep do the in-season rankings go — ROS + weekly scope?** | The four in-season ranking issues (#27–#30) | consensus-only vs full KERFUFFLE re-score; dollars on ROS or not; weekly one column or both | Owner | **Resolved 2026-08-27 — full KERFUFFLE re-score for both; ROS carries dollars; weekly shows Kerf + consensus side by side.** ROS built first as the foundational in-season value. Data availability confirmed by a read-only FantasyPros probe (2026-08-27): weekly projections + weekly/ROS consensus exist; no dedicated ROS projection. |
| 12 | **Does the VORP result match how you want to value the superflex QB premium?** Last-starter VORP prices RBs above QBs and reads elite QBs as *cheaper than the market pays* (Josh Allen Kerf $130 vs Market $201), because ~24 QBs start so even a top QB's points-above-replacement is modest. Correct, transparent VORP — but a real judgment to sanity-check before bidding. | Whether #20's dollars need a QB-scarcity adjustment on top of last-starter VORP | (a) Keep pure last-starter VORP (the Edge *is* the signal — the market overpays QBs) vs (b) add a superflex QB-premium adjustment vs (c) a richer replacement model (man-games) | Owner, informed by the live board + drill-down | **Open (raised by #20, 2026-08-26)** — currently backlog, not a blocker; the dollars ship on pure VORP. |
| 11 | **Does the backtest's marginal edge clear the gate to build the dollar layer (#20)?** The Kerf re-rank beats ECR only slightly and inconsistently (out-of-sample 2025 ρ 0.78 vs 0.77; trails at TE). | The dollar layer (#20) and everything downstream | (a) Proceed to #20 on the marginal edge vs (b) refine the #18 first-down model first, then re-gate | Owner, informed by [`backtest_results.md`](../backtest_results.md) | **Resolved 2026-08-26 — a blend:** make the cheap, evidence-driven core fix ([D-16](../decision_log.md): receiving-FD player-specific, rushing = position average — the #19 probe showed rushing FD barely persists, ρ≈0.14), which re-gated as do-no-harm, **then proceed to #20**. Value reframed as league-specific dollar valuation + Edge, not a ranking edge (a possible richer FD model is backlog, not a blocker). |
| 1 | Where does contract-length data actually live? CBS holds salaries, but lengths may only exist in the Commissioner's sheet / TRUFFLEdash | Scope of CBS spike (#2); whether the pipeline needs a second source (sheet import) | CBS custom fields vs. Google Sheet import vs. manual entry | Owner (confirm during #2) | **Resolved 2026-08-20 — contract length IS in CBS** (per-player "Contract" column on roster pages; spike #5 / issue #5). No second source needed for it. See [`../cbs_data_discovery.md`](../cbs_data_discovery.md), [`../decision_log.md`](../decision_log.md) D-08. |
| 2 | FantasyPros access method | Data pipeline (#3) and everything downstream | API application vs. scrape vs. manual export (manual acceptable for MVP) | Owner, informed by spike #3 | **Resolved 2026-08-20 — official FantasyPros API on the HOF tier (~$9/mo)** (spike #7 / issue #7). Not scraping, not manual export. The API is self-serve (not approval-gated as assumed); the CBS↔FP join is a **direct `cbs_player_id` match**. Free tier is a 10-of-520 preview, so HOF is required for the full board (owner upgraded; **HOF subscription active as of 2026-08-24** — the empirical cap-lift + gated-endpoint re-verification is folded into the source-profiling spike, Now #5 / issue #11). See [`../fantasypros_data_discovery.md`](../fantasypros_data_discovery.md), [`../decision_log.md`](../decision_log.md) D-09. |
| 3 | Auction-day fallback if the calendar wins | Nothing in the tool — but deciding in advance beats deciding in panic | Engine + manual data entry vs. going in with spreadsheets as usual | Owner | **The calendar won:** the 2026 FA auction (CBS "Live Salary Cap Draft") is **8/26/26 5pm ET** — before the engine ships. Owner is handling this auction outside the tool ("don't worry about it," 2026-08-26); the engine targets in-season use and the next auction. |
| 8 | Valuation methodology (VORP framework, replacement level, single-season vs. contract-aware, ceilings) | The valuation engine (#20) | VORP vs. points-per-dollar; last-starter vs. man-games baseline; single-season vs. dynasty-blended; one vs. two ceilings | Owner + research | **Resolved 2026-08-26 — VORP, last-starter baseline (QB24/RB~34/WR~34/TE~17/DST12), single-season value with dynasty as context, two ceilings (league-generic + roster-aware), marginal $/point.** See [`../decision_log.md`](../decision_log.md) **D-13**. |
| 9 | Where do first-down estimates + backtest ground truth come from? | Projection core (#18) + backtest (#19) | CBS league data vs. nflfastR/nflverse | Owner | **Resolved 2026-08-26 — CBS league data** (owner exported 2024/25 CBS stat lines incl. first downs; historical FantasyPros ECR/projections confirmed accessible for the backtest). nflfastR not used. See [`../decision_log.md`](../decision_log.md) **D-14**. |
| 10 | Use TRUFFLE auction data for the price curve? | Price curve (#20) — and it touches a vision non-goal | Use as secondary signal vs. don't touch TRUFFLE at all | Owner | **Resolved 2026-08-26 — retained as inert reference only, read by no consumer** (it's auction-pool only, not full rosters). Non-goal holds in practice. See [`../decision_log.md`](../decision_log.md) **D-15**. |
| 4 | Tech stack | Item #1 (the prototype is built on the keepable foundation) | Chosen: Next.js + TypeScript + TanStack Table + Tailwind (local-first, web-deployable later) | Owner approved | **Resolved 2026-08-19 — [`decision_log.md`](../decision_log.md) D-01** |
| 5 | CBS auth durability: how do we keep data refreshes working as the session cookie expires? | Whether the tool needs periodic manual re-connect vs. can refresh unattended; the security tradeoff of storing the password | (a) manual cookie re-extraction each session (~weekly; no password stored) vs. (b) automated login storing CBS username+password locally vs. (c) longer-lived "keep me signed in" cookie | Owner (when CBS ingestion is built) | Open — raised by spike #5. Cookie observed stamped ~30 days; real lifetime being measured. Default leaning (a). See [`../cbs_data_discovery.md`](../cbs_data_discovery.md) §4. |
| 6 | Local storage architecture: files vs. a database, and how to keep history without blocking a later web deploy | Issue #12 (storage schema + ingestion, Now #6) and everything that reads from the store | Flat CSV/JSON vs. a real DB; chosen: three-layer **raw archive → SQLite (normalized + derived)** via `better-sqlite3`, all access behind one data module | Owner | **Decided 2026-08-24 — [`../decision_log.md`](../decision_log.md) D-10.** |
| 7 | How are dead-cap pseudo-rows and Practice Squad players represented in the schema? | Finalizing issue #12's storage schema (Now #6) — approval D-10 covers the storage *shape*, not this | Classify as non-player rows on the roster vs. a separate table vs. flags on the roster row; the source-profiling spike (#11, Now #5) produces the evidence, owner decides | Owner, informed by #11 | **Resolved 2026-08-25 — Practice Squad = a `roster_status` on an ordinary player row; dead cap = a team-level roster row with the amount and NO player attached** (owner: "just note that the amount exists for the team"). See [`../decision_log.md`](../decision_log.md) **D-11**. Unblocked #12. |

---

**Related docs:** [`product_vision.md`](product_vision.md) is the north star this plan serves. [`current_state.md`](current_state.md) is what exists today. Decisions raised mid-build are logged in [`implementation_reality_log.md`](implementation_reality_log.md) and promoted into the table above.

---

**Related docs:** [`product_vision.md`](product_vision.md) is the north star this plan serves. [`current_state.md`](current_state.md) is what exists today. Decisions raised mid-build are logged in [`implementation_reality_log.md`](implementation_reality_log.md) and promoted into the table above.
