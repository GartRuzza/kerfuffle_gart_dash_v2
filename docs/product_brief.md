# Product Brief — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Product owner, with PM Claude.
> **Update when:** The vision changes, or the MVP scope changes. Keep it in step with [`pm/product_vision.md`](pm/product_vision.md).
> **This doc contains:** The working, actionable definition of the product — what an agent needs to know in 60 seconds before touching anything.
> **This doc never contains:** Status, progress, or timelines. What exists is in [`pm/current_state.md`](pm/current_state.md); what comes next is in [`pm/roadmap.md`](pm/roadmap.md).
>
> **Vision vs. brief:** the vision is the north star and argues *why*. This brief is the short operational answer to *what are we building, for whom, and where does it stop*. If they ever disagree, the vision wins and this doc is wrong.
>
> *Examples are in italics and refer to a fictional product, "Ledgerly." Delete them as you fill each section in.*

**Last updated:** [YYYY-MM-DD]

---

## In one sentence

*If an agent reads only one line of this repo, make it this one. Name the user, the job, and the outcome.*

> *Ledgerly reconciles invoices against bank activity for freelance bookkeepers, so they review exceptions instead of hunting for matches.*

## What it is

*Two or three sentences. What kind of software this is — the shape of it, not the feature list. A web app? A background service with a dashboard? Something a user lives in daily, or opens once a month?*

> *A web app used at a desk, in focused monthly sessions. The bookkeeper imports a bank statement, Ledgerly matches transactions to invoices, and she works a queue of the ones it could not match confidently.*

## Who it serves

| | |
| --- | --- |
| **Primary user** | [who — the one we optimize for] |
| **Their job to be done** | [what they are trying to accomplish] |
| **What they use today** | [the incumbent — spreadsheets, a competitor, nothing] |
| **Why they would switch** | [the one reason] |

## MVP scope

*The smallest product that does the job in the sentence above. If a capability could be removed and a real user would still get real value, it is not MVP.*

**The MVP is not done without:**

- [Capability] — [the user can now do what?]

> *- CSV bank import — the bookkeeper can get a month of real transactions into the product.*
> *- Exception queue — she can see and clear what the system could not match on its own.*

**Deliberately out of the MVP:** *(see [`pm/roadmap.md`](pm/roadmap.md) for the full deferred list and reasoning)*

- [Feature] — [not now, because…]

## Non-goals

*What this product refuses to be. Copied from the vision, kept short, and stated so an agent can act on it — this is the section that lets an agent say "no, out of scope" without asking you.*

- **[We do not build X]** — [why]

> *- **We do not do tax filing.** Regulated, jurisdiction-specific, would swallow the roadmap.*
> *- **We are not a general accounting suite.** We do one job — reconciliation — and hand off cleanly to whatever the bookkeeper already uses.*

## How we win

*The one or two things that must be true for a user to choose this over the incumbent. Be honest and narrow.*

> *Trust. A bookkeeper will forgive us for being slow; she will never forgive a confidently wrong match. Accuracy and visible uncertainty are the product.*

---

**Related docs:** [`pm/product_vision.md`](pm/product_vision.md) (the north star this summarizes) · [`user_flows.md`](user_flows.md) (how a user actually moves through it) · [`architecture.md`](architecture.md) (how it is built)
