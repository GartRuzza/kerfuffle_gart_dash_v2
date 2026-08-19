# Current State — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Claude Code (the implementing agent), verified by the product owner.
> **Update when:** At the end of **every** build cycle, before reporting the work complete. This is not optional — an out-of-date current_state is worse than no current_state, because it is trusted.
> **This doc contains:** Only what exists in the code **right now**.
> **This doc never contains:** Plans, intentions, or anything phrased as "will." If it is not built, it does not get described here as if it were. Plans live in [`roadmap.md`](roadmap.md).
>
> **Read this doc before any planning or building.** It is the grounding doc — it exists to stop us from assuming a feature is built when it is not.
>
> *Examples are in italics and refer to a fictional product, "Ledgerly." Delete them as you fill each section in.*

**Last updated:** [YYYY-MM-DD] · **Updated by:** [who] · **Reflects commit:** [short SHA]

---

## At a glance

*The whole point of this table is that an agent can read the first screen and know what is true. Use only these three statuses — no "mostly done," no "90%."*

- **Built** — works end to end, in the product, usable by a real user today.
- **Partial** — some of it exists, but a real user cannot rely on it yet. The gap must be named in the section below.
- **Not built** — no usable implementation exists, even if code has been started.

| Feature / capability | Status | Notes |
| --- | --- | --- |
| [Feature] | Built / Partial / Not built | [one line] |

> *| CSV bank import | Built | Handles the 3 bank formats we have seen. |*
> *| Matching engine | Partial | Exact-amount matches only; fuzzy matching is not implemented. |*
> *| Client statements | Not built | — |*
> *| Billing | Not built | — |*

## Partially built — what exactly is missing

*For every row marked **Partial** above, state precisely what a user cannot yet do. "Partial" with no explanation is the single most dangerous line in this file: the next agent will assume the missing half is the easy half.*

### [Feature name]

- **Works today:** [what a user can actually do]
- **Missing:** [what a user cannot do]
- **Consequence:** [what breaks, or what workaround the user needs]

> *### Matching engine*
> *- **Works today:** Matches a transaction to an invoice when the amount is identical and the date is within 3 days.*
> *- **Missing:** Fuzzy matching (partial payments, bundled payments, fees deducted at source).*
> *- **Consequence:** Roughly 40% of real transactions fall through to manual review, so the core promise of the product is not yet met.*

## Current limitations

*True constraints of the system as built — things that work as designed but will not survive contact with a bigger or messier user. Not bugs.*

- [Limitation] — [why it exists, and when it will start to hurt]

> *- Import is capped at 5,000 rows per file; larger files time out. Fine for our current users, will break at the first mid-size firm.*
> *- Everything runs single-tenant. Adding a second user to one account is not just a UI change, it is a data-model change.*

## Known bugs

| # | Bug | Impact | Severity | Status |
| --- | --- | --- | --- | --- |
| 1 | [What goes wrong] | [what the user experiences] | High / Medium / Low | Open / Fixed [YYYY-MM-DD] |

## Build and deploy status

| | |
| --- | --- |
| **Active branch** | [branch] |
| **Deployed to production** | [yes / no — what version, when] |
| **Environments live** | [local / staging / prod] |
| **Tests** | [what exists, and whether they pass] |

## Latest implementation summary

*What the most recent build cycle actually changed, in plain English. One short paragraph. The full history, including deviations from plan, lives in [`implementation_reality_log.md`](implementation_reality_log.md).*

**[YYYY-MM-DD] — [what shipped]**

> *2026-03-14 — Added CSV bank import and exact-amount matching. A bookkeeper can now import a statement and see which transactions matched. Fuzzy matching was scoped out mid-build; see the reality log entry for why, and what it means for the roadmap.*

---

**Related docs:** [`roadmap.md`](roadmap.md) is what we plan to build. [`implementation_reality_log.md`](implementation_reality_log.md) is why what we built differs from what we planned.
