# Product Vision — Gart Dash

> **Owner:** Product owner (Garrett), with PM Claude.
> **Update when:** The direction of the product genuinely changes. Expect this to be rare.
> **This doc contains:** Why the product exists and who it is for.
> **This doc never contains:** Timelines, sequencing, or the status of any feature. Those belong in [`roadmap.md`](roadmap.md) and [`current_state.md`](current_state.md).

**Last reviewed:** 2026-08-19

---

## Mission

Gart Dash gives the owner of the Rangoon Raccoons a decision edge in the KERFUFFLE dynasty league. It converts NFL history and expert consensus into KERFUFFLE-specific player value, overlays that value on the league's actual contract economy, and puts both numbers — what a player is worth, and what the market will pay — in front of the owner at the moment of every bid, claim, trade, and lineup call. The change it creates: decisions that today rest on standard rankings and manual mental adjustment instead rest on evidence nobody else in the league has.

## Target users

**Primary user:** Garrett, owner of the Rangoon Raccoons (KERFUFFLE). He is the only user. Every design decision optimizes for his workflow, his roster, and his decisions — there is no second user whose needs can conflict.

This is deliberate and load-bearing: the product never needs onboarding, permissions, multi-league support, or explanations of things the owner already knows. Anything built to serve a hypothetical other user is scope creep by definition.

## Core problem

**The problem:** Every decision in KERFUFFLE — auction bids, contract durations, trades, waivers, lineups — is currently made using rankings and projections built for *other leagues' scoring*. KERFUFFLE's PPFD scoring meaningfully re-orders player value (chain-movers rise, touchdown-dependent players fall), and its $500 salary-cap economy adds a second dimension — price — that no fantasy site models at all. Today, connecting "what is this player worth under our rules" to "what does he cost in our economy" is manual, mental, and error-prone. The two most expensive recurring mistakes have been overpaying at auction and committing to wrong contract durations, followed by mispriced trades.

**Why it is still unsolved:** No commercial tool will ever model one 12-team league's custom scoring and bespoke contract rules; the market is one person. CBS hosts the league but cannot answer even basic questions about real cap position, let alone value. The only way this gets solved is by the one person it serves building it.

**The edge, stated plainly:** leaguemates anchor on standard rankings (ECR or similar) that don't reflect KERFUFFLE scoring, and they have no systematic mechanism for overlaying performance against salary and contract economics. Gart Dash exploits both gaps at once.

## Desired future state

It is the week before the auction. The owner opens Gart Dash and sees every relevant free agent with two numbers side by side: a **market price** (what the KERFUFFLE economy has historically paid for a player of this rank and position) and a **ceiling** (what the player is worth in projected points above replacement, in dollars against the $500 cap). He walks into the auction with a pre-committed maximum for every player he wants, bids confidently below his ceiling, and lets someone else win the overpays.

In season, a Tuesday night takes ten minutes: the waiver wire ranked by expected KERFUFFLE points rather than standard projections, breakouts separated into sustainable first-down volume versus touchdown luck, and every bid checked against remaining FAAB and cap space. When a trade offer arrives, he compares both sides in KERFUFFLE points, roster-aware value to the Raccoons specifically, and contract terms against the league curve — and can see at a glance which players the rest of the league is likely mispricing because their KERFUFFLE rank diverges from their public ECR.

He no longer adjusts rankings in his head, keeps salary math in spreadsheets, or wonders after the fact whether he overpaid.

## Product principles

1. **Every view serves a named decision.** Bid, claim, start, trade. A screen that doesn't sharpen one of those four decisions doesn't get built, however interesting the data is. This costs us fun exploratory features; it keeps a one-person tool small enough to actually maintain.

2. **Always both numbers: the market's and mine.** Value is never shown without price, and KERFUFFLE-adjusted numbers are never shown without the standard consensus they diverge from. The edge lives in the *gap* between those pairs — a view that shows only one side hides the edge. This costs us screen simplicity and we accept it.

3. **Transparent enough to overrule.** The owner follows the engine when the gap is large and his own judgment when it's close — which means every projection must be drillable to the inputs driving it (why did this player move from RB18 to RB11?). A black box that's right 60% of the time is worth less than a glass box that's right 55%, because only the glass box can be trusted at the moment of a real-money bid. This costs us modeling sophistication when sophistication can't be explained.

4. **Tiers over false precision.** Adjacent ranks are usually the same player in disguise. The product shows expected-value groups, not decimal-point pecking orders, so a close call is *visibly* a close call. This costs us the satisfying illusion of exactness.

5. **Win-now wins ties.** When this-season value and long-term value point in different directions, the product's defaults, rankings, and recommendations favor this season. Dynasty perspective (via dynasty ECR) is displayed as supporting context — chiefly for contract-duration judgment — not blended into the primary numbers.

## Non-goals

- **We will not recommend contract durations.** Duration depends heavily on real-life NFL contract and depth-chart situations that this product does not yet model. The product displays dynasty ECR as the owner's best single duration indicator; the call itself stays human. (Revisit only when real-life contract/depth-chart data is in scope.)
- **We will not model real-life NFL contract situations or depth charts (yet).** Acknowledged as the two biggest unmodeled inputs to dynasty decisions — explicitly deferred to a later version, not forgotten.
- **We will not build for the Bench Cup.** It doesn't factor into the owner's decisions. No bench-depth valuation, no Bench Cup views.
- **We will not build tanking or draft-lottery optimization.** Out of scope entirely.
- **We will not touch TRUFFLE.** KERFUFFLE data only, even though the sister league shares scoring. Extra sample size is not worth the data plumbing. *(Qualified 2026-08-26, [`../decision_log.md`](../decision_log.md) D-15: one TRUFFLE 2026 auction file is **stored inert as reference only** and read by no consumer — the non-goal still holds in practice, since no TRUFFLE data feeds any KERFUFFLE value.)*
- **We will not serve other owners.** No sharing, no accounts, no "what if my leaguemates used this." The edge depends on them *not* having it.
- **We will not replace CBS.** CBS remains the system of record for rosters, scoring, and transactions. Gart Dash reads reality; it never becomes a second place where league state must be maintained.

## Success definition

| Horizon | What success looks like | Measure |
| --- | --- | --- |
| By next auction | The owner walks in with a pre-set market price and ceiling for every targeted player, and never bids past a ceiling in the room | 100% of winning bids ≤ pre-committed ceiling; zero "what did I just pay" moments |
| 6 months | KERFUFFLE-adjusted rankings demonstrably beat the standard consensus at predicting what actually happens in this league | Backtest on the last 2+ seasons: engine's preseason/weekly ranks correlate with actual KERFUFFLE PPG better than raw FantasyPros ECR does |
| 18 months | The tool is the default first stop for every bid, claim, trade, and lineup decision — spreadsheets and manual adjustment are gone | Every in-season transaction the Raccoons make was checked in Gart Dash first; subjective but honestly assessable |

*(A championship is the point, but a 12-team league is noisy enough that one season proves little either way. The measures above are the controllable inputs to winning; the trophy is the lagging indicator.)*

---

**Related docs:** [`roadmap.md`](roadmap.md) sequences this vision into a build plan. [`current_state.md`](current_state.md) records how far along we actually are.
