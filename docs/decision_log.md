# Decision Log — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Claude Code records the decision; the product owner makes any decision that is a product decision.
> **Update when:** A choice is made that would be expensive to reverse, or that a future agent might quietly undo without knowing it was a choice at all.
> **This doc contains:** What we decided, why, what we gave up, and what would make us change our mind.
> **This doc never contains:** Everyday implementation choices. If reversing it would take an afternoon, it does not belong here.
>
> **Append-only. Newest at the top. Never edit or delete a past decision** — if it turns out to be wrong, write a new entry that supersedes it and link the two. The history of a wrong turn is often more useful than the correction.
>
> **Decision log vs. reality log:** this doc says *why we chose what we chose*. [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) says *how the build diverged from the plan*. A deviation in the reality log often produces a decision here.
>
> **Before reversing anything in this log, read the entry.** It exists so you do not re-litigate a settled question, or undo a choice whose reasons are invisible in the code.
>
> *The example entry is in italics and refers to a fictional product, "Ledgerly." Delete it once you have a real one.*

---

## Entry template — copy this block

### D-[NN] · [YYYY-MM-DD] · [Short title]

| | |
| --- | --- |
| **Status** | Active / Superseded by [D-NN] / Reversed [YYYY-MM-DD] |
| **Type** | Product / Technical / Both |
| **Decided by** | [product owner / Claude Code + owner approval] |

**The question**
*What was actually being decided. State it as a question — it forces honesty about what was open.*

**What we decided**
*The choice, in one sentence.*

**Why**
*The reasoning as it stood at the time. Do not clean it up with hindsight — a future agent needs to know what we actually knew.*

**What we gave up**
*The alternative and what was genuinely good about it. If the rejected option had no merit, this was not a decision worth logging.*

**What would make us reconsider**
*The trigger. A decision with no reversal condition is a decision nobody can ever revisit safely.*

---

## Decisions

<!-- Newest entry goes directly below this line. -->

### D-09 · 2026-08-20 · FantasyPros data via the official API (HOF tier); join to CBS on `cbs_player_id`

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical + Product (data sourcing + a recurring cost) |
| **Decided by** | Claude Code (spike #7) + owner (chose the API path, approved the HOF upgrade) |

**The question**
How do we get FantasyPros expert-consensus rankings/tiers — the roadmap listed three candidates: the API (thought to be approval-gated), scraping, or manual export (roadmap open decision #2) — and how do we match FantasyPros players to CBS players (the roadmap's "expected ugliest part")?

**What we decided**
Ingest FantasyPros data through its **official JSON REST API** (`https://api.fantasypros.com/public/v2/json`, `x-api-key` header), on the paid **HOF tier (~$9/mo)**, and **join to CBS on the `cbs_player_id`** that FantasyPros publishes on every player. Not scraping (prohibited by their terms), not manual export (unnecessary).

**Why**
Proven empirically in the spike: the API is now self-serve (not approval-gated as the roadmap assumed), authenticates with a simple key, and returns exactly what the engine needs — `rank_ecr`, `pos_rank`, `tier`, and the expert spread — across redraft/dynasty and all scoring formats. The feared player-matching problem evaporated: FantasyPros hands back a `cbs_player_id` that equals CBS's own id (confirmed against real CBS ids — Chase, Nacua, McCaffrey), so the join is a direct id map, not fuzzy name matching. The free tier is a top-10-of-520 preview (`public_api_limited: true`), so the full board requires HOF — a small, sanctioned, license-clean recurring cost that fits a single-user, non-commercial, local tool.

**What we gave up**
A zero-cost path. The free tier can't feed production (10 of 520 players), so the product now depends on a ~$108/yr subscription. We also accept a single-vendor dependency for ECR/tiers (mitigated: the `cbs_player_id` join and cached pulls make swapping providers a contained change if ever needed). And we took the HOF unlock partly on faith — at decision time the upgrade hadn't propagated to the key (still reported `tier: free`); the full-list + projections/metadata/ADP/news unlock must be confirmed on a re-run before the engine build.

**What would make us reconsider**
HOF failing to lift the cap or open the gated endpoints (regenerate the key, then escalate); FantasyPros changing its API terms to bar our personal-use case; the tool ever being shared/sold (would require a commercial license); or the subscription cost no longer being worth it versus a cheaper/free ECR source (e.g. Fantasy Nerds) — the `cbs_player_id`-keyed, cached ingestion is deliberately swappable. Full evidence: [`fantasypros_data_discovery.md`](fantasypros_data_discovery.md).

---

### D-08 · 2026-08-20 · CBS data via authenticated HTML scraping; contract length comes from CBS

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical + Product (data sourcing) |
| **Decided by** | Claude Code (spike #5) + owner (confirmed the data) |

**The question**
How do we get real KERFUFFLE data out of CBS, and — the open one (roadmap decision #1) — where does player **contract length** come from?

**What we decided**
Ingest CBS data by **authenticated HTML fetch + parse**: send the owner's browser **session cookie** to the league's clean URLs (`/teams/roster-report/{teamId}/1`, `/players`, `/transactions`, `/rules`, `/draft/results`) and parse the server-rendered tables. And take **contract length from CBS itself** (the per-player "Contract" column), not from the Commissioner's sheet.

**Why**
Proven empirically in the spike: CBS's old v3 JSON API is dead (it returns HTML even with `response_format=json`/`access_token`), but the modern site renders every record we need into page HTML, gated only by the session cookie. Contract length turned out to be a first-class column on the roster pages (confirmed against the owner's real roster), which removes the need for a second data source for it.

**What we gave up**
The robustness of a real API. HTML parsing is sensitive to CBS layout changes, and the session cookie expires (needs periodic re-extraction). We accept this because it's the only thing that works, it's one league's rarely-changing pages, and read-only scraping of one's own league is low-risk. We also did **not** solve two things here: fetching a specific **past season** (needed for the backtest) and reading **FAB bid amounts** (needed for the price curve) — both deferred to focused follow-ups.

**What would make us reconsider**
CBS shipping a usable API again (switch to it), CBS blocking or materially changing the pages (revisit the parser or the whole approach), or contract length disappearing from the roster view (fall back to the Commissioner's-sheet import from roadmap decision #1). Full evidence: [`cbs_data_discovery.md`](cbs_data_discovery.md).

---

### D-07 · 2026-08-20 · Roster filtering: 3-way status toggle + Manager dropdown

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Product (UX) |
| **Decided by** | Owner |

**The question**
How should the owner filter the table by who holds a player — and, crucially, how do you express "free agents only" (which the Auction and Waiver lenses need)?

**What we decided**
Two orthogonal controls: a **3-way roster-status toggle** — **All / Rostered / Free Agents** — beside a **Manager dropdown** (All / a specific team). The combined rule (in the `owner` column's `filterFn`, `components/columns.tsx`): if the toggle is **Free Agents**, show only FAs (Manager ignored, dropdown disabled); else if a **specific Manager** is chosen, show that team; else **Rostered** = all rostered minus FAs, **All** = everyone including FAs. This replaced an earlier "Free Agents in the dropdown + an include-FA checkbox" model.

**Why**
The dropdown-plus-checkbox model couldn't cleanly express "free agents only." Splitting *roster status* (the toggle) from *which manager* (the dropdown) makes every combination meaningful and reads at a glance. The default views rely on it (Auction/Waivers → Free Agents; Trades → Rostered; Start/Sit → a Manager).

**What we gave up**
A tiny redundancy: with a specific Manager selected, "All" vs "Rostered" makes no difference (a team has no FAs). Accepted — it keeps the two controls independent and predictable.

**What would make us reconsider**
A real need to view "a team plus the free-agent pool" together, or added positions (K/DST) that change what "rostered" means.

---

### D-06 · 2026-08-20 · Tier bands as a sort-driven, field-specific overlay

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Product (UX), load-bearing |
| **Decided by** | Owner |

**The question**
How do tiers appear in the table, and how do they interact with sorting and the position filter?

**What we decided**
Tiers are **not a column** — they render as **FantasyPros-style band rows** between tier groups, and the behavior is a small state machine centralized in **`lib/tierRules.ts`** (unit-tested):
- Bands show **only** when the active sort is one of six rank columns; the band set is **specific to the sort field** (Kerf / ECR / Dynasty × overall / positional).
- **Overall-rank** sort → overall tiers (position filter just narrows rows). **Positional-rank** sort needs a single position: triggering it on a multi-position (All/SuperFlex/Flex) **auto-switches the position to QB**; switching *to* a multi-position while positionally sorted **clears the sort** (back to the default overall order, no bands).
- Default/load: active Kerf-Ovr-Rank sort → overall Kerf tiers on.
- For contiguity, every rank column sorts by a **unique derived rank** (the two overall-ECR columns use `ovrEcrRank`/`dynOvrRank`, not the raw ECR which has ties).

**Why**
It matches the owner's mental model (a tiered board you re-tier by choosing a ranking) and vision principle 4 (tiers, not decimal ranks). Centralizing the rules keeps intricate, coupled behavior testable and in one place.

**What we gave up**
Simplicity: this is the most intricate UI logic in the app, and tiers are (for now) **mock** bucketings by rank — real tiers come from the engine (Kerf) and FantasyPros (ECR). "Ovr ECR" also now shows a contiguous overall rank rather than the raw consensus number (revisit at ingestion if the raw ECR is wanted).

**What would make us reconsider**
Real tier data arriving with its own grouping semantics, or the owner wanting tiers visible regardless of sort. Any change goes in `lib/tierRules.ts`, never scattered into components.

---

### D-05 · 2026-08-20 · Saved views persisted in localStorage; @dnd-kit for column reorder

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical (product-approved) |
| **Decided by** | Owner (persistence mechanism, drag approach) |

**The question**
How should the table remember user-created "views" (column choices, order, sort, filters) between sessions, and how should columns be reordered?

**What we decided**
Persist **custom views in the browser's localStorage** (`lib/views.ts`), keyed `gartdash.customViews.v1`; built-in default views stay in code. Reorder columns by **dragging headers**, using **@dnd-kit** bound to TanStack's `columnOrder`.

**Why**
localStorage fits the local-first, single-user, no-backend prototype: views survive reloads with zero infrastructure. @dnd-kit is the standard, well-maintained, accessible drag toolkit and integrates cleanly with TanStack column ordering; the owner explicitly chose real drag over a lighter reorder UI.

**What we gave up**
localStorage is **per-browser and not synced** across machines, and it's the first persisted client state (a small step up in complexity). @dnd-kit adds a dependency. Both accepted for the UX; real cross-device sync waits for a backend (deployment era).

**What would make us reconsider**
Web deployment with multiple devices, or a login — then views (and other state) move to a real per-user store behind the API, and localStorage becomes a cache at most.

---

### D-04 · 2026-08-20 · Vitest for unit testing

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical |
| **Decided by** | Claude Code + owner request for strong validations |

**The question**
How do we validate the app's growing pure logic (mock-data derivation, the tier/sort/position state machine) beyond build + eyeballing?

**What we decided**
Add **Vitest** as the test runner (`npm test`), with unit tests co-located in `lib/*.test.ts`. Tests cover the pure logic only; UI interaction checks stay manual for now.

**Why**
The owner asked for a strong validation gate at each component. The tier state machine and derived ranks/tiers are exactly the kind of tricky pure logic that benefits from fast unit tests. Vitest is TS-native, near-zero-config with our stack, and reusable as the app grows.

**What we gave up**
A new dev dependency and the small upkeep of tests. Accepted — it directly serves correctness and the owner's request.

**What would make us reconsider**
Nothing likely. If we later add component/E2E testing we'd extend (Testing Library / Playwright), not replace, Vitest.

---

### D-03 · 2026-08-20 · Dark theme (Gamecast-style), dark-only for now

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Both (product look + technical) |
| **Decided by** | Owner |

**The question**
What visual direction should the table take — and light, dark, or both?

**What we decided**
A **dark, Gamecast-style** theme with a teal/cyan accent and compact rows, **dark-only** for now (no light/dark toggle yet). Expressed entirely through the design tokens (D-02).

**Why**
The owner's primary reference (Gamecast) is dark; dark-only avoids ~1.5–2× the styling/testing work of maintaining both themes for a single-user local prototype. The token layer keeps a future light theme cheap.

**What we gave up**
A light mode (and the FantasyPros-style light look). Recoverable later: because colors are tokens, adding a light theme is a config/variant change, not a rewrite.

**What would make us reconsider**
The owner wanting to present/use the tool somewhere a light theme reads better, or accessibility needs. Then we add a light token set + a toggle.

---

### D-02 · 2026-08-19 · Semantic design-token layer for styling

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical |
| **Decided by** | Claude Code proposal + owner approval |

**The question**
How do we keep colors and styling consistent across the app as more components are built, instead of hardcoding the palette into every file?

**What we decided**
Define a **semantic design-token layer** once in [`../tailwind.config.ts`](../tailwind.config.ts) — roles like `yours`, `market`, `edge`, `tier`, `warning`, plus a neutral base (`surface`, `ink`, `line`, `brand`) — and require components to style with those token names, never raw Tailwind color classes (`bg-sky-50`). Applied to the player-table prototype as the first consumer; the token values map to the exact shades already in use (no visual change).

**Why**
The prototype is the foundation of the real tool, and more components are coming. A single source of truth for the palette gives consistency by default, one-place restyling/rebranding, and a clear path to dark mode. The owner asked for this structure *before* giving visual feedback, so that feedback lands as a one-file change rather than an edit spread across many components.

**What we gave up**
A little indirection — `bg-yours-surface` requires knowing it maps to sky-50 — versus the immediacy of raw Tailwind classes. Accepted: the names are self-documenting by role, and the config is short and centralized.

**What would make us reconsider**
Adopting a full component/design-system library with its own theming — we'd align the tokens to that instead. (If the app somehow stayed a single component forever, the layer would be mild overhead; that is not the trajectory.)

---

### D-01 · 2026-08-19 · Tech stack: Next.js + TypeScript

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical (product-approved) |
| **Decided by** | Claude Code proposal + owner approval |

**The question**
What stack do we build the player table prototype — and the real tool it grows into — on, given the product must run locally now and deploy to the web later without rework, and its centerpiece is one rich, interactive, editable, filterable table?

**What we decided**
Next.js (React) + TypeScript, with TanStack Table for the data grid and Tailwind for styling. Local-first (`npm run dev`), deployable to Vercel later with no rearchitecting. One app, one language.

**Why**
It matches the brief's own description of the product — "a single web application, run locally to start but built so it can be deployed to the web later without rework." One language across the whole app means no second system for a solo, non-technical owner to run and maintain. TanStack Table is best-in-class for exactly the sort/filter/tiers/editable-column behavior that *is* the product. The later data work (CBS + FantasyPros ingestion, valuation engine, backtest) fits inside the same app's server routes; the roadmap itself calls the engine "minimal," well within what TypeScript handles comfortably.

**What we gave up**
Python/FastAPI's native data-science ecosystem (pandas/numpy), which would be the more natural home for the valuation engine and backtest. We accept this because those pieces are scoped small, and because we can add a Python service *behind a clean API boundary* later if — and only if — the engine genuinely outgrows TypeScript, without disturbing the UI.

**What would make us reconsider**
The valuation engine or backtest proving substantially heavier than TypeScript handles well (e.g. real numerical/statistical modeling at data-science scale). At that point we introduce a Python service behind an API boundary rather than replacing the stack — the UI decision above stands regardless.

---

**Related docs:** [`architecture.md`](architecture.md) and [`data_model.md`](data_model.md) (the structures these decisions produced) · [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) (deviations that often force a decision here)
