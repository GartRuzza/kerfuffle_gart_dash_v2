# User Flows — Gart Dash

> **How to use this doc**
> **Owner:** Product owner, with PM Claude.
> **Update when:** A new flow is designed, or an existing one changes shape.
> **This doc contains:** How a real user moves through the product, start to finish, including where they get stuck.
> **This doc never contains:** Screen-by-screen UI specs, or implementation detail.
>
> **Why this doc exists:** features get built as isolated screens, and isolated screens do not add up to a product a person can actually use. A flow is the unit that matters — if the flow does not complete, the feature does not count, however finished it looks.

**Last updated:** 2026-08-27

---

## One view, many filters — read this before building any flow

Flows 1–5 below run through the **same player table**: one data display with KERFUFFLE-adjusted value, market consensus (ECR), tier, salary, contract, and the league price curve. Those flows differ only in **how that table is filtered** (free agents, another team's roster, my roster) and **which decision is being made**. Do not build a dedicated view per flow — a "waiver screen" or "trade screen" that duplicates the table is exactly the drift this section exists to prevent. A flow may add a small decision-specific element (e.g., the editable ceiling column in auction prep, a side-by-side comparison for trades), but the data display underneath is shared.

**The one deliberate exception is flow 6 (League power rankings).** Its unit is the *team*, not the player — a 12-row rollup of the player table's own numbers — so it earns a dedicated screen rather than a filter. It is a **spin-off**, not a sixth lens on the shared table.

## The critical flow

**Auction prep.** If the owner cannot walk into the Free Agent Auction with trusted, KERFUFFLE-true ceilings for every target, nothing else this product does matters. It is also the flow whose engine every other flow reuses.

## Flows

### 1. Auction prep

**User:** the owner · **Trigger:** the Free Agent Auction is scheduled (~month before the NFL season) · **Success:** every target has a ceiling he trusts, and the ceilings collectively fit his cap space

**The happy path**

1. He refreshes data → CBS pulls rosters, salaries, contracts, and the transaction log; FantasyPros pulls current and dynasty ECR.
2. He filters the player table to the free-agent pool → each player shows KERFUFFLE value, tier, market consensus, and expected price from the league's price curve.
3. The tool auto-populates a **suggested $ ceiling per player, specific to the Raccoons' roster** (roster-aware value, capped by his available cap space) → alongside it, an **editable column where he sets his own ceiling**, overriding freely.
4. He drills into any number that surprises him → sees the inputs that moved the player (why RB18 became RB11).
5. He reviews the sum of his ceilings against his cap space → adjusts until the plan is affordable → done. The ceilings are saved for auction day.

**Where it goes wrong**

| What goes wrong | What the user sees | What they can do about it |
| --- | --- | --- |
| CBS token expired (~weekly) | "CBS data is stale as of [date] — token needs refreshing" with the re-extract steps | Re-extract the token from the browser; never a silent stale table |
| FantasyPros data unavailable | Value columns flagged as based on last-known rankings, with their date | Proceed on stale rankings knowingly, or retry later |
| Free-agent pool doesn't match CBS | Data timestamp visible on the table | Refresh; if mismatch persists, CBS is the truth |

**Where they get stuck**

- The price curve is built from contracts signed in different years at different career points, so "expected price" can mislead on legacy-contract comparables. The curve's basis must be visible, not just its output.

### 2. Auction day (companion)

**User:** the owner, with the CBS auction running in another window · **Trigger:** the auction starts · **Success:** he never bid past a ceiling he set in prep

**The happy path**

1. A player is nominated on CBS → he looks the player up in the (already-loaded) table.
2. He reads his pre-set ceiling, the suggested ceiling, and the tier → bids up to his number or passes.
3. Repeat until the auction ends.

**Deliberately dumb — do not "improve" this flow.** No live price entry, no dynamic re-ranking as players come off the board, no integration with the running auction. The tool is a static reference; the prep did the work. Building live tracking is a roadmap decision for the owner, not an enhancement an agent adds.

**Where it goes wrong**

| What goes wrong | What the user sees | What they can do about it |
| --- | --- | --- |
| Player can't be found (name mismatch) | Search that tolerates near-matches | Search by team/position as fallback |
| Data was never loaded before auction | The data timestamp, prominently | Nothing mid-auction — which is why prep ends with data confirmed fresh |

### 3. Waiver bidding (Tuesday night)

**User:** the owner · **Trigger:** prepping FAB bids before the Wednesday-night waiver run (and Saturdays, and the extra playoff runs) · **Success:** bids submitted on CBS with amounts and 1yr/2yr contract choices he trusts

**The happy path**

1. He refreshes data → same pipeline as auction prep.
2. He filters the same player table to available free agents → same columns, plus a **suggested bid range derived internally**: the player's KERFUFFLE value run through the league price curve (with historical FAB winning bids from the CBS transaction log as comparables), bounded by what rival teams' remaining cap space lets them pay.
3. He weighs value vs. bid vs. his remaining cap → decides bid amount and contract length (mindful of the $15 dead-cap threshold on 2-year deals).
4. He submits the bid **on CBS** → execution always stays on CBS; the tool never places bids.

**Where it goes wrong**

| What goes wrong | What the user sees | What they can do about it |
| --- | --- | --- |
| Stale CBS token | Same stale-data warning as auction prep | Re-extract token |
| Transaction log missing recent FAB results | Bid-range comparables flagged with their as-of date | Trust the value number over the range |
| A drop is required to fit the claim | *(Not supported — see backlog)* | He does the dead-cap math himself for now |

**Where they get stuck**

- **Cut candidates and dead-cap cost are not shown** when a claim forces a drop. Logged in [`feature_backlog.md`](feature_backlog.md) — the dead-cap rules are exactly the math a spreadsheet gets wrong, so this is a strong future candidate, deferred deliberately.

### 4. Trade evaluation and construction

**User:** the owner · **Trigger:** (a) a trade offer arrives, or (b) he wants to improve a spot and goes hunting · **Success:** an accept/decline/counter he can defend with the data, that is cap-legal for both sides

**The happy path — evaluating an offer**

1. He loads both sides of the offer from live rosters → same player table, filtered to the players involved.
2. He compares sides in KERFUFFLE points, **roster-aware value to the Raccoons specifically**, and contract terms against the league price curve.
3. He checks cap legality for both teams post-trade ($500 rule).
4. He decides: accept or decline on CBS, or move to constructing a counter.

**The happy path — constructing an offer or counter**

1. He filters the table to other teams' rosters → sorts/filters by the data: contract amount and length, projections, historical performance.
2. He shortlists targets where the league is likely mispricing (KERFUFFLE rank diverges from public ECR).
3. He assembles a package and evaluates it exactly as in the flow above → proposes it on CBS.

**Not an auto-negotiator.** The tool surfaces the data and checks the math; it does not generate offers, score "trade winners," or recommend packages. Same shared table, filtered differently — no dedicated trade screen.

**Where it goes wrong**

| What goes wrong | What the user sees | What they can do about it |
| --- | --- | --- |
| Offer includes a player traded/dropped since last refresh | Data timestamp on the table | Refresh before deciding |
| Cap math disagrees with TRUFFLEdash | Both numbers exist; CBS + constitution rules are the arbiter | Flag to the commissioner if the tool is right |

### 5. Start/sit (weekly read, not a feature)

**User:** the owner · **Trigger:** setting the lineup before games lock · **Success:** a lineup he's confident in, set on CBS

**The happy path**

1. He filters the same player table to the Raccoons' roster → reads tiers, KERFUFFLE values, and matchup-relevant data.
2. Close calls are visibly close (tiers, not decimal ranks) → he uses his judgment.
3. He sets the lineup on CBS.

**Nothing gets built for this flow.** No lineup optimizer, no start/sit recommendations, no dedicated view — the shared roster-filtered table with its existing columns is the entire support. This is a documented read of existing functionality, recorded so the decision is visible.

**Where it goes wrong**

| What goes wrong | What the user sees | What they can do about it |
| --- | --- | --- |
| Stale data on a short week (TNF) | The data timestamp | Refresh Wednesday, not just Sunday |

### 6. League power rankings / scouting (spin-off)

**User:** the owner · **Trigger:** he wants to know where the Raccoons stand and where every rival is soft — most often when a trade is on his mind, or at a season checkpoint · **Success:** he can see, at a glance, which teams are strong or weak *and at which positions*, and turn that into a trade angle

**Why this exists:** the valuation engine already values every player the KERFUFFLE way; a team's strength is just its players' Kerf values added up correctly. Surfacing that as a league-wide ranking answers a question the player table cannot: *not "what is this player worth" but "who is built to win, and who is desperate where."* Its named decision is **trade** — the positional grid is a target-finder — with a secondary "where do I stand" read. It is a **standalone spin-off**, not a sixth filter of the shared table.

**The happy path**

1. He refreshes data → the same pipeline; the engine runs (`npm run engine`) so Kerf points are current.
2. He opens the **Power Rankings** screen → all 12 teams ranked by **Starter Strength** (their best possible superflex lineup, in Kerf projected points), with **Total Roster** (depth included) beside it, and a **tier** (contender / middle / rebuilder).
3. He reads the **positional grid** → each team's startable strength at QB / RB / WR / TE → spots who is stacked at a position and thin at another.
4. He turns a gap into a trade angle → jumps to the shared player table filtered to that rival's roster (flow 4) to build the offer. The rankings *point*; the trade flow *executes*.

**Deliberately narrow for v1 — do not "improve" beyond this.** No real win/loss or actual-scoring blend (that needs current-season actuals — a later upgrade); no dynasty toggle yet (the engine has no KERFUFFLE-scored multi-year projection — only dynasty ECR); no auto-generated trade suggestions (it surfaces the grid, it does not negotiate); offense only (defenses are unscored). It is a **read**, like start/sit — it informs the trade decision, it does not make it.

**Where it goes wrong**

| What goes wrong | What the user sees | What they can do about it |
| --- | --- | --- |
| Engine not re-run after a data refresh | The data-freshness date on the screen is stale | Re-run `npm run engine`; the board is only as fresh as the last engine run |
| A rival holds players the engine can't project (e.g. defenses, unranked FAs) | Those players contribute 0 to totals | Read it as "offense, projected players only" — the intended scope |

---

**Related docs:** [`product_brief.md`](product_brief.md) (what the product is) · [`pm/roadmap.md`](pm/roadmap.md) (a broken or missing flow is the strongest argument for what to build next) · [`qa_test_plan.md`](qa_test_plan.md) (every critical flow needs a test that walks it end to end)

---

**Related docs:** [`product_brief.md`](product_brief.md) (what the product is) · [`pm/roadmap.md`](pm/roadmap.md) (a broken or missing flow is the strongest argument for what to build next) · [`qa_test_plan.md`](qa_test_plan.md) (every critical flow needs a test that walks it end to end)
