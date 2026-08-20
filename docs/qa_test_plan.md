# QA & Test Plan — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code writes and maintains it; the product owner runs the manual checks.
> **Update when:** A feature ships (add its checks), or a bug is found (add the check that would have caught it).
> **This doc contains:** How to verify the product works, **written so it can be run without reading any code**.
> **This doc never contains:** Test code. This is the human-readable plan; the code lives in the test suite.
>
> **The rule that makes this doc real:** a feature is not "Built" in [`pm/current_state.md`](pm/current_state.md) until the checks below pass. When a check fails, that feature's status changes — to Partial, or to a known bug. Test results are the evidence behind every status in that doc, which is why this one keeps it honest.

**Last updated:** 2026-08-19 · **Last full pass:** 2026-08-19 (automated build + render verified by Claude Code; the manual interaction checks below are ready for the owner to run) · **Result:** Automated checks pass; manual interaction checks pending owner sign-off.

---

## Automated tests

| | |
| --- | --- |
| **How to run them** | `npm run build` (compiles, type-checks, and lints the whole app). |
| **What they cover** | The app compiles with no type or lint errors, and the page renders with all ~80 players, every column, the tier badges, the color-coded Edge values, and the 79 editable Ceiling inputs present in the server-rendered HTML. |
| **What they do not cover** | Click-level interactions — sorting on header click, the filter buttons/dropdown, and inline Ceiling edits updating state. These are standard library behavior and compile cleanly, but are verified by the manual checks below, not by an automated suite. |
| **Currently passing?** | Yes — `npm run build` passes clean as of 2026-08-19. |

There is no automated interaction/unit suite yet — deliberately out of scope for a mock-data UI prototype (see [`pm/roadmap.md`](pm/roadmap.md) #1). Add one when the table stabilizes on real data.

## Manual checks — the critical flows

*This prototype serves [`user_flows.md`](user_flows.md) flow 1 (Auction prep), seeded with mock data. Run these after `npm install`.*

### Auction-prep table (prototype)

**Setup:** In a terminal in the project folder, run `npm install` once, then `npm run dev`. Open http://localhost:3000.

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | Open the page | One screen: the player table. No login, no other pages. An amber **"MOCK DATA — not real league data"** bar across the top. | ☐ |
| 2 | Count the columns and read the header | Owner, Player, Pos, Team, Tier, then a blue **"Yours"** group (KERF Value, Ceiling), an **Edge** column, a gray **"The Market"** group (Market Price, ECR, Dynasty ECR), then Salary, Contract. "Showing 79 of 79 players." | ☐ |
| 3 | Scan the Edge column | A mix of green (+) and red (−) dollar values — your value vs. the market gap, readable at a glance. | ☐ |
| 4 | Click the **"KERF Value"** header | Rows re-sort by that column; clicking again reverses the order (arrow indicator flips). | ☐ |
| 5 | Click the **"Edge"** header | Rows re-sort by edge; the biggest green (best value vs. market) can be brought to the top. | ☐ |
| 6 | Click **"My roster"** | Only Rangoon Raccoons players remain; the "Showing X of 79" count drops. | ☐ |
| 7 | Click **"Free agents"** | Only players marked **FA** remain (no contract, "—" salary). | ☐ |
| 8 | Choose a rival from the **"A team"** dropdown | Only that team's players remain. | ☐ |
| 9 | With a roster filter active, click a position (e.g. **QB**) | The two filters combine — only that roster's QBs show. Click **All** on both to reset. | ☐ |
| 10 | Read the Tier column | Colored **T1–T6** badges, visually distinct — a close call looks close, not a decimal rank. | ☐ |
| 11 | Note a player's Ceiling box | It is pre-filled with that player's KERF Value and is an editable number box. | ☐ |
| 12 | Type a new number into a Ceiling box | That row updates immediately and the value stays as you sort/filter. | ☐ |
| 13 | Reload the page | Ceilings reset to KERF Value — expected and acceptable for this prototype. | ☐ |

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
| Click-level interactions (sort, filter, inline edit) | Untested by automation | No interaction/unit suite yet (out of scope for the prototype); covered by the manual checks above. |
| Everything downstream of mock data | Not built | No real data, engine, or persistence exists yet — see [`pm/current_state.md`](pm/current_state.md). |

---

**Related docs:** [`user_flows.md`](user_flows.md) (every critical flow needs a check here) · [`pm/current_state.md`](pm/current_state.md) (a failing check must be reflected there as a bug or a downgraded status)
