# User Flows — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Product owner, with PM Claude.
> **Update when:** A new flow is designed, or an existing one changes shape.
> **This doc contains:** How a real user moves through the product, start to finish, including where they get stuck.
> **This doc never contains:** Screen-by-screen UI specs, or implementation detail.
>
> **Why this doc exists:** features get built as isolated screens, and isolated screens do not add up to a product a person can actually use. A flow is the unit that matters — if the flow does not complete, the feature does not count, however finished it looks.
>
> *Examples are in italics and refer to a fictional product, "Ledgerly." Delete them as you fill each section in.*

**Last updated:** [YYYY-MM-DD]

---

## The critical flow

*The one journey the product exists to serve. If this flow is broken, nothing else matters.*

> *A bookkeeper closes a client's month: import the bank statement → review what did not match → clear the exceptions → mark the month closed.*

## Flows

### [Flow name]

**User:** [who] · **Trigger:** [what makes them start] · **Success:** [how they know they are done]

*Do not record build status here. [`pm/current_state.md`](pm/current_state.md) is the only doc that says what is Built, Partial, or Not built — a second copy of a status is a second copy that goes stale, and then nobody knows which one to believe. Describe the flow as it is designed to work; that doc says how much of it exists.*

**The happy path**

1. [What the user does] → [what the product does in response]
2. …

**Where it goes wrong**

*The failure cases and the dead ends. This half of the flow is the half that gets skipped, and it is where products actually fail — a flow with no error path is a flow that will strand someone.*

| What goes wrong | What the user sees | What they can do about it |
| --- | --- | --- |
| [failure] | [message / state] | [the way out] |

**Where they get stuck**

*Known friction, even when nothing is broken. Be honest here — this is the raw material for the next round of roadmap work.*

> *### Closing a month*
> ***User:** the bookkeeper · **Trigger:** it is the 1st and the bank statement has landed · **Success:** every transaction is matched or explicitly written off*
>
> ***Happy path:** 1. She uploads the bank CSV → we parse it and show a count. 2. We match what we can → she sees "388 of 400 matched." 3. She works the 12 exceptions → each is matched by hand or written off. 4. She marks the month closed → the client's books are done.*
>
> ***Where it goes wrong:** the bank's CSV format is one we have not seen → we show "unrecognized format" and she is stuck, because there is no way for her to map the columns herself. Today her only route out is to email us. This is the single biggest drop-off in the product.*
>
> ***Where they get stuck:** at step 3, roughly 40% of transactions land in the exception queue because fuzzy matching is not built. The queue is technically usable but it is not the product we promised — she is still doing the work by hand, just in a nicer window.*

---

**Related docs:** [`product_brief.md`](product_brief.md) (what the product is) · [`pm/roadmap.md`](pm/roadmap.md) (a broken or missing flow is the strongest argument for what to build next) · [`qa_test_plan.md`](qa_test_plan.md) (every critical flow needs a test that walks it end to end)
