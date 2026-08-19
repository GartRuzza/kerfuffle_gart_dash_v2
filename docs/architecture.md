# Architecture — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Claude Code, with the product owner's approval for anything structural.
> **Update when:** The structure of the system changes — a new service, a new boundary, a swapped dependency, a changed deployment target. Not for ordinary feature work.
> **This doc contains:** How the system is put together, and the rules an agent must build within.
> **This doc never contains:** Feature status. Whether a component is actually built is answered by [`pm/current_state.md`](pm/current_state.md).
>
> **Describe what is real.** If a component is planned but not built, mark it **(planned)** explicitly. An architecture doc that quietly describes a system nobody has built yet is how agents end up importing modules that do not exist.
>
> *Examples are in italics and refer to a fictional product, "Ledgerly." Delete them as you fill each section in.*

**Last updated:** [YYYY-MM-DD] · **Reflects commit:** [short SHA]

---

## The shape of it

*Two or three sentences a non-technical reader can follow. What are the moving parts, and how does a request travel through them?*

> *A single Next.js app on Vercel. The browser talks to server routes in the same app; those routes talk to a Postgres database on Supabase, which also handles login. Bank files are parsed in a background job because a large statement takes longer than a web request is allowed to.*

## The stack

*What we chose and — for anything a future agent might question — why. Link to the decision if there is one.*

| Layer | Choice | Why | Decision |
| --- | --- | --- | --- |
| Frontend | [what] | [why] | [D-NN, or —] |
| Backend / API | [what] | [why] | |
| Database | [what] | [why] | |
| Auth | [what] | [why] | |
| Background jobs | [what] | [why] | |
| Hosting / deploy | [what] | [why] | |
| Payments | [what] | [why] | |

## System boundaries

*Where one part ends and another begins, and what is allowed to cross. This section is what stops a codebase from turning to mud — most architectural decay is a boundary an agent did not know existed.*

- **[Boundary]** — [what may cross it, and what may not]

> *- **The browser never talks to the database.** All data access goes through server routes, which is where authorization lives. A client-side query would bypass every permission check we have.*
> *- **The matching engine is a pure module.** It takes transactions and invoices, returns matches. It does not read the database, call the network, or know about users — so we can test it against real data without spinning up an app.*

## Key flows

*How the two or three most important operations actually execute. Enough that an agent can find its way in without reading everything.*

### [Flow name]

1. [step] → 2. [step] → 3. [step]

> *### Importing a bank statement*
> *1. Browser uploads the CSV to `/api/import`. 2. The route stores the raw file and enqueues a job. 3. The worker parses, normalizes, and writes transactions. 4. The browser polls for status. Nothing is parsed in the request itself — a 5,000-row file exceeds the request timeout.*

## Environments

| | Local | Staging | Production |
| --- | --- | --- | --- |
| **URL** | | | |
| **Database** | | | |
| **How to run** | | | |

## Constraints an agent must respect

*The rules of this codebase. Anything an agent could plausibly get wrong, and where getting it wrong is expensive.*

- [Constraint] — [why it exists]

> *- Secrets live in environment variables only, never in code and never in the repo.*
> *- Every server route checks the session before touching data. There is no "internal" route that skips this.*
> *- Schema changes go through a migration file. Never hand-edit the database.*

## Known architectural limits

*Where this design will stop working, and roughly when. Naming this early is what turns a future emergency into a scheduled piece of work.*

| Limit | Bites when | What it would take to fix |
| --- | --- | --- |
| [limit] | [trigger] | [rough effort] |

> *| Single-tenant data model — one user per account | The first customer asks to add a colleague | A real schema change: accounts, memberships, and a permission check on every query. Not a UI tweak. |*

---

**Related docs:** [`data_model.md`](data_model.md) (the entities behind this) · [`decision_log.md`](decision_log.md) (why these choices were made) · [`pm/current_state.md`](pm/current_state.md) (what of this is actually built)
