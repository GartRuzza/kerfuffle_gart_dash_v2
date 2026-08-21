# Roadmap — Gart Dash

> **How to use this doc**
> **Owner:** Product owner, with PM Claude.
> **Update when:** A phase completes, priorities change, or a decision unblocks future work.
> **This doc contains:** What we are building next, in what order, and why that order.
> **This doc never contains:** Claims about what is already built. An item sitting in "Now" may not exist yet — [`current_state.md`](current_state.md) is the only doc that says what is real.

**Last updated:** 2026-08-19

---

## Current phase

> ### ▶ AUCTION-READY — walk into the 2026 Free Agent Auction with tool-generated ceilings
> **We are here.** Everything under **Now** belongs to this phase.
> **We do not start the next phase until:** the owner has used the tool's ceilings in the real 2026 KERFUFFLE Free Agent Auction.

The auction date is fixed and weeks away. It is the hard constraint on everything below: scope bends, the date does not.

## MVP scope

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

### Now — the Auction-Ready phase, in order

| # | Item | Why now | Depends on |
| --- | --- | --- | --- |
| 1 | **Player table prototype — UI only** | The owner prototypes what's useful before anything is engineered: columns, filters, sort, tiers, and the editable-ceiling column, iterated on cheaply. Mock data uses real NFL player names with realistic-but-invented salaries (sourced via web search). **UI only — no hard data schema until item 2–3 discovery reports back.** Simple as possible, but on the stack we keep: this is the foundation of the real table, not a throwaway. | Stack decided (D-01) — GitHub Issue #1 |
| 2 | **Spike + data discovery: CBS API** | Highest architectural risk. Auth via the mobile OAuth flow against the actual KERFUFFLE league, then a full inventory: what's accessible, formats, historical depth, whether contract *lengths* live in CBS or only salaries, barriers and risks. Timeboxed to days. | nothing |
| 3 | **Spike + data discovery: FantasyPros + joint discovery** | Access is unsolved (API is approval-gated; fallbacks: scrape, manual export — manual is acceptable for MVP and cannot block the auction). Then discovery of how the two sources work *together*, especially player-ID matching between CBS and FantasyPros — the expected ugliest part. | nothing (parallel to #2) |
| 4 | **Valuation engine core** | The KERFUFFLE re-projection mechanism only: scoring translation and superflex/positional adjustment. Minimal — it exists to be tested, not admired. | #2, #3 |
| 5 | **Backtest — the decision gate** | Does the engine-core re-rank beat raw ECR at predicting actual KERFUFFLE points on best-available historical data? CBS historicals already carry KERFUFFLE scoring; historical ECR is the scarce side — scope to best available, don't let perfect data eat the calendar. Results viewable in the prototype table. **If the edge isn't there, we fix the core before building anything below this line.** | #1, #4 |
| 6 | **Engine completion + table on real data** | Replacement level (data-defined), tiers, the league price curve (roster salaries + historical FAB wins), roster-aware values, drillable inputs — each validated by the owner in the table as it lands. | #5 passed |
| 7 | **Auction prep lens** | Suggested $ ceilings (roster-aware, cap-aware) beside the editable owner column; cap-sum check; ceilings saved for auction day. Done = the critical flow in [`user_flows.md`](../user_flows.md) completes end to end. | #6 |

### Next — Phase 2: In-season, in order

| # | Item | Why this order | Depends on |
| --- | --- | --- | --- |
| 1 | Waiver additions | First real in-season decision (Wednesday FAB runs from ~Week 1). Suggested bid range = engine value through the price curve, with historical FAB wins as comparables, bounded by rivals' cap space. Same table, free-agent filter. | Auction-Ready phase complete |
| 2 | Trade evaluation + construction | Offers arrive on their own schedule. Side-by-side KERFUFFLE points, roster-aware value, contracts vs. curve, cap-legality check for both teams; cross-roster filtering for target hunting. Same table. | Waiver additions (shares curve work) |

### Later — real, but not yet scheduled

| Item | Why it is not "Next" | Revisit when |
| --- | --- | --- |
| Web deployment | Local serves one user fine; deployment adds hosting/auth for zero new decisions served | The owner is regularly blocked by being away from the machine |
| Drop/dead-cap tool on claims | Valuable but not auction-critical | First time a claim forces a painful manual dead-cap calc |
| Contract-duration support | Requires real-life NFL contract/depth-chart data (vision non-goal until then) | That data enters scope deliberately |
| Live auction tracking | Deliberately excluded from auction day | Only by explicit owner decision after a real auction with the static tool |

## Sequencing constraints

- **Prototype (#1) is UI-only until discovery (#2–3) reports** — building data structures around unverified sources is how the foundation gets rebuilt.
- **Data discovery precedes the engine** — the engine's inputs are whatever discovery proves exists, not what we assume exists.
- **Engine core precedes the backtest; the backtest gates engine completion** — validate the edge before paying for replacement level, tiers, and the price curve.
- **The engine precedes every lens** — all lenses are the same numbers filtered differently.
- **The auction lens precedes auction day** — the one immovable date in the project.

## Open product decisions

| # | Decision needed | What it blocks | Options under consideration | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Where does contract-length data actually live? CBS holds salaries, but lengths may only exist in the Commissioner's sheet / TRUFFLEdash | Scope of CBS spike (#2); whether the pipeline needs a second source (sheet import) | CBS custom fields vs. Google Sheet import vs. manual entry | Owner (confirm during #2) | **Resolved 2026-08-20 — contract length IS in CBS** (per-player "Contract" column on roster pages; spike #5 / issue #5). No second source needed for it. See [`../cbs_data_discovery.md`](../cbs_data_discovery.md), [`../decision_log.md`](../decision_log.md) D-08. |
| 2 | FantasyPros access method | Data pipeline (#3) and everything downstream | API application vs. scrape vs. manual export (manual acceptable for MVP) | Owner, informed by spike #3 | Open |
| 3 | Auction-day fallback if the calendar wins | Nothing yet — but deciding in advance beats deciding in panic | Engine + manual data entry vs. going in with spreadsheets as usual | Owner | Open |
| 4 | Tech stack | Item #1 (the prototype is built on the keepable foundation) | Chosen: Next.js + TypeScript + TanStack Table + Tailwind (local-first, web-deployable later) | Owner approved | **Resolved 2026-08-19 — [`decision_log.md`](../decision_log.md) D-01** |
| 5 | CBS auth durability: how do we keep data refreshes working as the session cookie expires? | Whether the tool needs periodic manual re-connect vs. can refresh unattended; the security tradeoff of storing the password | (a) manual cookie re-extraction each session (~weekly; no password stored) vs. (b) automated login storing CBS username+password locally vs. (c) longer-lived "keep me signed in" cookie | Owner (when CBS ingestion is built) | Open — raised by spike #5. Cookie observed stamped ~30 days; real lifetime being measured. Default leaning (a). See [`../cbs_data_discovery.md`](../cbs_data_discovery.md) §4. |

---

**Related docs:** [`product_vision.md`](product_vision.md) is the north star this plan serves. [`current_state.md`](current_state.md) is what exists today. Decisions raised mid-build are logged in [`implementation_reality_log.md`](implementation_reality_log.md) and promoted into the table above.

---

**Related docs:** [`product_vision.md`](product_vision.md) is the north star this plan serves. [`current_state.md`](current_state.md) is what exists today. Decisions raised mid-build are logged in [`implementation_reality_log.md`](implementation_reality_log.md) and promoted into the table above.
