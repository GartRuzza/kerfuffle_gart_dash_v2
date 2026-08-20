# QA & Test Plan — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code writes and maintains it; the product owner runs the manual checks.
> **Update when:** A feature ships (add its checks), or a bug is found (add the check that would have caught it).
> **This doc contains:** How to verify the product works, **written so it can be run without reading any code**.
> **This doc never contains:** Test code. This is the human-readable plan; the code lives in the test suite.
>
> **The rule that makes this doc real:** a feature is not "Built" in [`pm/current_state.md`](pm/current_state.md) until the checks below pass. When a check fails, that feature's status changes — to Partial, or to a known bug. Test results are the evidence behind every status in that doc, which is why this one keeps it honest.

**Last updated:** 2026-08-20 · **Last full pass:** 2026-08-20 (unit tests + build + rendered-DOM verified by Claude Code; the manual interaction checks below are ready for the owner to run) · **Result:** Automated checks pass (14 unit tests + clean build); manual interaction checks pending owner sign-off.

---

## Automated tests

| | |
| --- | --- |
| **How to run them** | `npm test` (Vitest unit tests) and `npm run build` (compile + type-check + lint). |
| **What they cover** | **Unit (14 tests):** mock-data derivation — 79 players, unique overall ranks, clean 1..N positional ranks, tier ranges; and the tier/sort/position **state machine** — which bands show for each sort×position, the auto-switch-to-QB effect, and the revert-to-no-tiers effect. **Build:** the whole app compiles clean and the page server-renders with every column, the tier bands, position badges, and the editable Ceiling inputs. |
| **What they do not cover** | Click-level interactions in a real browser (sorting on click, the dropdowns, inline Ceiling edits updating state). The *logic* behind them is unit-tested; the wiring is verified by the manual checks below. |
| **Currently passing?** | Yes — `npm test` (14/14) and `npm run build` pass clean as of 2026-08-20. |

## Manual checks — the critical flows

*This prototype serves [`user_flows.md`](user_flows.md) flow 1 (Auction prep), seeded with mock data. Run these after `npm install`.*

### The table (prototype, v2 dark redesign)

**Setup:** In a terminal in the project folder, run `npm install` once, then `npm run dev`. Open http://localhost:3000.

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Open the page | One **dark** screen: the player table, centered "Gart Dash" title, amber **"MOCK DATA"** bar on top. No login. | ☐ |
| 2 | Read the header | Owner, Player, Pos, Team, then GartStats (Kerf Ovr Rank, Kerf Pos Rank, Proj Points, Kerf Value, Ceiling), Edge, Market (Market Value, Ovr ECR, Pos ECR, Dyn Ovr ECR, Dyn Pos ECR), Contract Info (Salary, Contract). A **color key** shows the three group tints. "Showing 79 of 79 players." | ☐ |
| 3 | Look at the Pos column | Each is a **colored badge** — QB green, RB red, WR blue, TE tan. | ☐ |
| 4 | On first load | Rows are sorted by **Kerf Ovr Rank** and **"Tier 1 / Tier 2 / …" band rows** separate the tiers. | ☐ |
| 5 | Click the **Proj Points** header | Rows re-sort; the **tier bands disappear** (Proj Points isn't a rank column). Filled caret shows the sort direction. | ☐ |
| 6 | Click **Kerf Ovr Rank** again | Overall Kerf tier bands come back. | ☐ |
| 7 | Set Position = **QB**, then click **Kerf Pos Rank** | Only QBs show, banded by QB Kerf tiers (QB1 at top). | ☐ |
| 8 | With Position = **All**, click **Kerf Pos Rank** | The app **auto-switches Position to QB** (positional rank needs one position) and shows QB tiers. | ☐ |
| 9 | While positionally sorted, set Position back to **All** (or SuperFlex/Flex) | Sort falls back to Kerf Ovr Rank order with **no bands**, until you click a rank header again. | ☐ |
| 10 | Sort by **Ovr ECR**, then **Dyn Ovr ECR** | Bands change to ECR-overall, then Dynasty-overall tiers — the band set follows the sort field. | ☐ |
| 11 | Roster filter: **My roster** / **Free agents** / a rival via **"A team"** | Rows narrow accordingly; count updates. Combines with the Position dropdown. | ☐ |
| 12 | Edit a **Ceiling** box (pre-filled with Kerf Value) | The row updates immediately and the value stays as you sort/filter. | ☐ |
| 13 | Reload the page | Ceilings reset — expected for this prototype. | ☐ |

## Edge cases and things that should fail gracefully

| # | Try this | It should | Pass? |
| --- | --- | --- | --- |
| 1 | Filter to a rival team **and** a position with no players on it (e.g. a team with no TE) | Show "No players match these filters." — never a blank/broken table. | ☐ |
| 2 | Clear a Ceiling box (delete the number) | Treat it as 0 rather than breaking the row. | ☐ |
| 3 | Narrow the browser window | The table scrolls sideways inside its own box; the page itself does not break its layout. | ☐ |

## Security and permissions checks

Not applicable to this prototype. It has no login, no accounts, no permissions, no database, no network calls, and no user input beyond the in-memory Ceiling boxes. This is deliberate — Issue #1 is UI-only precisely so no sensitive surfaces exist yet. Add this section when real data ingestion or deployment lands.

## Known-failing / untested

| Area | State | Why |
| --- | --- | --- |
| Click-level interactions in a real browser (sort, filter, inline edit) | Untested by automation | The pure logic under them (tier rules, derivation) is unit-tested; the DOM wiring is not yet — covered by the manual checks above. Add component tests (Testing Library) when it stabilizes. |
| Everything downstream of mock data | Not built | No real data, engine, or persistence exists yet — see [`pm/current_state.md`](pm/current_state.md). |

---

**Related docs:** [`user_flows.md`](user_flows.md) (every critical flow needs a check here) · [`pm/current_state.md`](pm/current_state.md) (a failing check must be reflected there as a bug or a downgraded status)
