# Roadmap — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Product owner, with PM Claude.
> **Update when:** A phase completes, priorities change, or a decision unblocks future work.
> **This doc contains:** What we are building next, in what order, and why that order.
> **This doc never contains:** Claims about what is already built. An item sitting in "Now" may not exist yet — [`current_state.md`](current_state.md) is the only doc that says what is real.
>
> *Examples are in italics and refer to a fictional product, "Ledgerly." Delete them as you fill each section in.*

**Last updated:** [YYYY-MM-DD]

---

## Current phase

> ### ▶ [PHASE NAME] — [one-line goal]
> **We are here.** Everything under **Now** belongs to this phase.
> **We do not start the next phase until:** [exit condition]

*Make the exit condition observable, not a feeling.*

> *We move to Phase 2 when a real bookkeeper closes a real client's books in Ledgerly without emailing us for help.*

## MVP scope

*The smallest thing that delivers the core value described in the vision. The deferred list is not a wish list — it is a commitment not to build these yet, and it is what stops the MVP from creeping.*

**In scope — the MVP is not done without these:**

- [Capability] — [why it is indispensable]

**Explicitly deferred — good ideas we are consciously not building yet:**

| Deferred | Why it can wait |
| --- | --- |
| [Feature] | [reason] |

> *| Multi-currency | Our first 20 users are all single-currency. Building it now costs weeks and serves nobody yet. |*
> *| Team accounts | The solo bookkeeper is our primary user. Firms can share a login until we have proof they will pay. |*

## Now / Next / Later

*Every item carries a rationale and its dependencies. An item with no rationale is an item nobody can defend when the schedule gets tight.*

### Now — actively being built

| # | Item | Why now | Depends on |
| --- | --- | --- | --- |
| 1 | [Item] | [rationale] | [dependency, or "nothing"] |

> *| 1 | Bank feed import (CSV) | Nothing else in the product can be tested until real transactions are in it. | nothing |*

### Next — the queue, in order

| # | Item | Why this order | Depends on |
| --- | --- | --- | --- |
| 1 | [Item] | [rationale] | [dependency] |

### Later — real, but not yet scheduled

| Item | Why it is not "Next" | Revisit when |
| --- | --- | --- |
| [Item] | [reason] | [trigger] |

> *| Automated client statements | Pointless until reconciliation is trusted — a statement built on bad matches is worse than no statement at all. | Match accuracy is above 95% on real data |*

## Sequencing constraints

*Things that must happen in a fixed order, technically or commercially, regardless of what we would prefer. This is where an agent learns why it cannot simply pick up the most interesting ticket.*

- **[X] must precede [Y]** — [reason]

> *- **Bank feed import must precede the matching engine** — matching cannot be evaluated without real transaction data.*
> *- **Billing must precede public launch** — we cannot take money without it, and free users will not tell us the truth about price.*

## Open product decisions

*Unresolved questions that block future work. These belong to the product owner. An agent must **not** silently decide one of these — it must stop and ask. When a decision is made, record it here with its date, then move the unblocked work into Next.*

| # | Decision needed | What it blocks | Options under consideration | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | [Question] | [blocked work] | [A vs B] | [who] | Open / Decided [YYYY-MM-DD] |

> *| 1 | Do we price per client or per transaction? | All of billing, and the pricing page | Per client (simple, predictable) vs per transaction (fairer to small users, harder to forecast) | Owner | Open |*

---

**Related docs:** [`product_vision.md`](product_vision.md) is the north star this plan serves. [`current_state.md`](current_state.md) is what exists today. Decisions raised mid-build are logged in [`implementation_reality_log.md`](implementation_reality_log.md) and promoted into the table above.
