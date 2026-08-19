# Implementation Reality Log — [PRODUCT NAME]

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

### *[2026-03-14] — Bank import and matching (example entry — delete me)*

> ***Ticket:** #12 · **Branch:** feat/bank-import · **Deviated from plan:** Yes*
>
> ***Original intent:** Ship bank CSV import plus a matching engine that handles both exact and fuzzy matches, so a bookkeeper can reconcile a full month with minimal manual review.*
>
> ***What was actually built:** CSV import for 3 bank formats, and exact-amount matching only (identical amount, date within 3 days). Fuzzy matching was not built.*
>
> ***Deviations:** Fuzzy matching was cut entirely.*
>
> ***Why we deviated:** The plan treated fuzzy matching as one more matching rule. It is not — partial payments, bundled payments, and deducted fees each need their own logic and a confidence score, and there is no way to tell whether the results are good without labelled real-world data, which we do not have. Building it blind would have produced a system that is confidently wrong, which the "never guess silently" principle rules out.*
>
> ***Product implications:** About 40% of real transactions still fall through to manual review, so the core promise — reconcile a month in one sitting — is **not** met by this release. The MVP is not shippable to a real bookkeeper yet. Fuzzy matching should move to the top of Now, and it is bigger than one ticket.*
>
> ***Technical tradeoffs and debt:** Import is capped at 5,000 rows (no streaming) because a naive in-memory parse was faster to ship. It will break for the first mid-size firm; roughly a day to fix.*
>
> ***Follow-up decisions needed:** Do we buy or hand-label a set of real reconciled transactions to evaluate fuzzy matching against? Blocks all fuzzy-matching work.*

---

**Related docs:** [`current_state.md`](current_state.md) is the up-to-date snapshot this log rolls into. [`roadmap.md`](roadmap.md) is where follow-up decisions get promoted. [`product_vision.md`](product_vision.md) is what a repeated deviation should eventually make us question.
