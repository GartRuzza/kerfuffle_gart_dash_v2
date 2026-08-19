# Product Vision — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Product owner, with PM Claude.
> **Update when:** The direction of the product genuinely changes. Expect this to be rare — quarterly at most.
> **This doc contains:** Why the product exists and who it is for.
> **This doc never contains:** Timelines, sequencing, or the status of any feature. Those belong in [`roadmap.md`](roadmap.md) and [`current_state.md`](current_state.md).
>
> *Every example below is in italics and refers to a fictional product, "Ledgerly." Delete the examples as you fill each section in.*

**Last reviewed:** [YYYY-MM-DD]

---

## Mission

*One paragraph. What the product does, for whom, and the change it creates in their working life. If you cannot say it in a paragraph, the product is not yet clear enough to build.*

> *Ledgerly gives freelance bookkeepers back the first week of every month. It reconciles client invoices against bank activity automatically, so the bookkeeper reviews exceptions instead of hunting for matches line by line.*

## Target users

*List the user types, then name the single primary user you optimize for. When two users' needs conflict, the primary user wins. Naming one is the whole point of this section — a product that serves everyone equally serves no one.*

**Primary user:** [WHO]

- **[User type]** — [their situation, and what they need from this product]

> *Primary: the solo freelance bookkeeper managing 10–40 small business clients. Secondary: the small accounting firm with 2–5 staff. When their needs conflict the solo bookkeeper wins, because a firm can absorb friction that would sink a solo operator.*

## Core problem

*What is broken today, and why has nobody fixed it? The second half matters more than the first — if the problem were both real and easy, it would already be solved, so name the reason it persists.*

**The problem:** [WHAT IS BROKEN]

**Why it is still unsolved:** [WHAT MAKES IT HARD, OR WHO HAS BEEN IGNORING IT]

## Desired future state

*Describe the world once this product has succeeded. Write it in the present tense, from the user's point of view — not as a feature list.*

> *A bookkeeper opens Ledgerly on the 1st, sees 12 exceptions out of 400 transactions, clears them in under an hour, and sends every client statement the same morning. She no longer works weekends in the first week of the month.*

## Product principles

*The tie-breaker rules for hard calls. These are what let an agent — or you, at 11pm — choose between two reasonable options without a meeting. A good principle has a real cost; if it costs nothing to follow, it is a slogan, not a principle.*

1. **[Principle]** — [what it means in practice, and what it costs us]

> *1. **Exceptions over dashboards.** We show the user what needs their judgment, not a summary of everything. This makes us look thin next to competitors in a feature comparison, and we accept that.*
>
> *2. **Never guess silently.** When confidence in a match is low we ask rather than assume. This makes us slower than a fully automatic competitor, and it is why bookkeepers will trust us.*

## Non-goals

*What we explicitly refuse to build, and why. This section does more work than any other in the file: it is what lets an agent decline a request instead of stopping to ask you. Be specific — "we won't build enterprise features" is too vague to act on.*

- **[We will not build X]** — [why not]

> *- **We will not do tax filing.** It is a regulated, jurisdiction-specific problem that would swallow the entire roadmap.*
>
> *- **We will not build a mobile app.** Reconciliation is desk work. A phone app would be used by nobody and maintained forever.*

## Success definition

*How we would know we have won. Include at least one number, even if today it is a guess — a guessed number can be corrected, a vague ambition cannot.*

| Horizon | What success looks like | Measure |
| --- | --- | --- |
| [6 months] | [outcome] | [metric + target] |
| [18 months] | [outcome] | [metric + target] |

> *| 6 months | Bookkeepers close a month of books in one sitting | Median time-to-close under 2 hours for a 400-transaction client |*

---

**Related docs:** [`roadmap.md`](roadmap.md) sequences this vision into a build plan. [`current_state.md`](current_state.md) records how far along we actually are.
