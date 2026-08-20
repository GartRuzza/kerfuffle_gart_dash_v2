# Feature Backlog — Gart Dash

> **How to use this doc**
> **Owner:** Shared. Anyone — you, PM Claude, Claude Code — may add to it.
> **Update when:** An idea appears. Capture it immediately, cheaply, without judging it.
> **This doc contains:** Every candidate feature, in one place, unsorted by importance.
> **This doc never contains:** Priorities or commitments. **The backlog is an inventory; [`pm/roadmap.md`](pm/roadmap.md) is the sequence.** An item sitting here is not scheduled, not agreed, and not a promise. Nothing gets built from this doc — it gets promoted to the roadmap first, then becomes a GitHub Issue.
>
> **The flow:** idea → backlog → (product owner prioritizes) → roadmap → GitHub Issue → build.
>
> *Examples are in italics and refer to a fictional product, "Ledgerly." Delete them as you fill each section in.*

**Last updated:** 2026-08-19

---

## Inbox — unsorted, unjudged

*Drop new ideas here with a date and where they came from. Do not think hard, do not rank, do not design. A backlog is only useful if adding to it is nearly free.*

| Added | Idea | Where it came from |
| --- | --- | --- |
| 2026-08-19 | **Waiver: suggested FAB bid-range column** — KERF value run through the league price curve, historical FAB winning bids as comparables, bounded by rivals' remaining cap. A per-lens add-on to the shared table, not a base column. Belongs to the waiver lens (roadmap Phase 2 #1). | Owner review of the Issue #1 prototype |
| 2026-08-19 | **Remaining cap / FAB space indicator** — so bids and ceilings can be weighed against what's left. Ties to the auction cap-sum check (roadmap #7) and the waiver lens. | Owner review of the Issue #1 prototype |
| 2026-08-19 | **Trade: side-by-side comparison + cap-legality check** — both sides in KERFUFFLE points, roster-aware value, contracts vs. curve, $500 legality for both teams. Per-lens add-on for the trade lens (roadmap Phase 2 #2). | Owner review of the Issue #1 prototype |
| 2026-08-19 | **Start/sit: matchup / this-week data** — opponent and weekly projection on the roster-filtered table. Needs a weekly data pipeline; not modeled yet (roadmap "Later"). | Owner review of the Issue #1 prototype |
| 2026-08-19 | **Drill-into-inputs** ("why did RB18 become RB11") — expose the inputs behind each KERF value/rank. Named in Issue #1 as the *next* prototype iteration; needs the real engine (roadmap #6). | Owner review of the Issue #1 prototype |

> These five were surfaced when the owner reviewed the auction-focused prototype and asked where the fields for the *other* flows live. Two general shared-table fields he asked for — **Projected KERFUFFLE points** and **KERF Rank** (positional) — were added to the prototype immediately (mock); the five above are per-lens or engine-dependent and wait for their flows.

## Candidates — thought about, not scheduled

*Ideas that have survived a first look. Sized only roughly — "S / M / L" is enough, and a precise estimate for something that may never be built is waste.*

| Feature | What problem it solves | Who asked | Size | Notes / open questions |
| --- | --- | --- | --- | --- |
| [name] | [problem, not solution] | [source] | S / M / L | [what we would need to know first] |

> *| Column mapper for unknown bank formats | Users hit a dead end when we don't recognize their bank — our biggest drop-off | 3 users | M | Cheaper than us adding bank formats one at a time forever. Strong candidate for Next. |*

## Promoted

*Items that made it onto the roadmap. Keep the row, with a pointer — it is how you remember what you decided and stop the same idea being re-proposed forever.*

| Feature | Promoted on | Where it went |
| --- | --- | --- |
| [name] | [YYYY-MM-DD] | [roadmap: Now / Next] · [Issue #NN] |

## Declined

*Ideas we said no to, and why. This section is the one that saves you time — without it, the same suggestion returns every quarter and gets re-argued from scratch. If it conflicts with a **non-goal** in [`product_brief.md`](product_brief.md), say so; that is a settled argument, not a fresh one.*

| Feature | Declined on | Why | Would we reconsider if… |
| --- | --- | --- | --- |
| [name] | [YYYY-MM-DD] | [reason] | [what would have to change] |

> *| Mobile app | 2026-02-02 | Non-goal. Reconciliation is desk work. | Users start asking to *review* exceptions on a phone — reviewing is plausible on mobile, doing the work is not. |*

---

**Related docs:** [`pm/roadmap.md`](pm/roadmap.md) (where prioritized items go) · [`product_brief.md`](product_brief.md) (its non-goals are grounds to decline an item outright) · [`user_flows.md`](user_flows.md) (friction in a real flow is the best source of backlog items)
