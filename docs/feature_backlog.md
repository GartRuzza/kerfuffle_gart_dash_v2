# Feature Backlog — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Shared. Anyone — you, PM Claude, Claude Code — may add to it.
> **Update when:** An idea appears. Capture it immediately, cheaply, without judging it.
> **This doc contains:** Every candidate feature, in one place, unsorted by importance.
> **This doc never contains:** Priorities or commitments. **The backlog is an inventory; [`pm/roadmap.md`](pm/roadmap.md) is the sequence.** An item sitting here is not scheduled, not agreed, and not a promise. Nothing gets built from this doc — it gets promoted to the roadmap first, then becomes a GitHub Issue.
>
> **The flow:** idea → backlog → (product owner prioritizes) → roadmap → GitHub Issue → build.
>
> *Examples are in italics and refer to a fictional product, "Ledgerly." Delete them as you fill each section in.*

**Last updated:** [YYYY-MM-DD]

---

## Inbox — unsorted, unjudged

*Drop new ideas here with a date and where they came from. Do not think hard, do not rank, do not design. A backlog is only useful if adding to it is nearly free.*

| Added | Idea | Where it came from |
| --- | --- | --- |
| [YYYY-MM-DD] | [one line] | [user, support ticket, our own head, a QA failure] |

> *| 2026-03-20 | Let the user map CSV columns herself when we don't recognize the bank format | Third support email this month — same problem every time |*

## Candidates — thought about, not scheduled

*Ideas that have survived a first look. Sized only roughly — "S / M / L" is enough, and a precise estimate for something that may never be built is waste.*

| Feature | What problem it solves | Who asked | Size | Notes / open questions |
| --- | --- | --- | --- | --- |
| [name] | [problem, not solution] | [source] | S / M / L | [what we would need to know first] |

> *| Column mapper for unknown bank formats | Users hit a dead end when we don't recognize their bank — our biggest drop-off | 3 users | M | Cheaper than us adding bank formats one at a time forever. Strong candidate for Next. |*

## Promoted

*Items that made it onto the roadmap. Keep the row, with a pointer — it is how you remember what you decided and stop the same idea being re-proposed forever.*

| Feature | Promoted on | Where it went |
| --- | --- | --- |
| [name] | [YYYY-MM-DD] | [roadmap: Now / Next] · [Issue #NN] |

## Declined

*Ideas we said no to, and why. This section is the one that saves you time — without it, the same suggestion returns every quarter and gets re-argued from scratch. If it conflicts with a **non-goal** in [`product_brief.md`](product_brief.md), say so; that is a settled argument, not a fresh one.*

| Feature | Declined on | Why | Would we reconsider if… |
| --- | --- | --- | --- |
| [name] | [YYYY-MM-DD] | [reason] | [what would have to change] |

> *| Mobile app | 2026-02-02 | Non-goal. Reconciliation is desk work. | Users start asking to *review* exceptions on a phone — reviewing is plausible on mobile, doing the work is not. |*

---

**Related docs:** [`pm/roadmap.md`](pm/roadmap.md) (where prioritized items go) · [`product_brief.md`](product_brief.md) (its non-goals are grounds to decline an item outright) · [`user_flows.md`](user_flows.md) (friction in a real flow is the best source of backlog items)
