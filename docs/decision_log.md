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

### *D-01 · [2026-02-10] · Hold matches at low confidence instead of auto-applying (example — delete me)*

> *| **Status** | Active | **Type** | Both | **Decided by** | Product owner |*
>
> ***The question:** when the matching engine is unsure, do we apply the match anyway and let the user correct it, or hold it back for review?*
>
> ***What we decided:** anything below 0.9 confidence goes to the exception queue. We never apply a match we are not confident in.*
>
> ***Why:** a wrong match is not a small error — it silently corrupts a client's books, and the bookkeeper may not find it for months. The damage is not the mistake, it is the loss of trust in every match we ever make. This follows directly from the "never guess silently" product principle.*
>
> ***What we gave up:** a much better demo. Auto-applying would let us claim "98% automatic," and our exception queue will look like work our competitors do not make you do. That is a real commercial cost and we are choosing to pay it.*
>
> ***What would make us reconsider:** if we ever have enough labelled real-world data to show that matches above some threshold are wrong less than, say, 1 in 10,000 times, the calculus changes. We do not have that data and cannot get it yet.*

---

**Related docs:** [`architecture.md`](architecture.md) and [`data_model.md`](data_model.md) (the structures these decisions produced) · [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) (deviations that often force a decision here)
