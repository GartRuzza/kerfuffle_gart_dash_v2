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
