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
