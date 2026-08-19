# Data Model — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Claude Code. **Any change here needs the product owner's approval before it is made** — schema changes are among the hardest things to reverse once real user data exists.
> **Update when:** Entities, fields, relationships, or permission rules change. Update it **with** the migration, not after.
> **This doc contains:** The entities, how they relate, and the rules that protect the data.
> **This doc never contains:** Speculative tables. If it is not in a migration, it is not in this doc — mark planned entities **(planned)** explicitly.
>
> **Read this before building any feature that stores data.** It exists to stop each new feature from inventing its own slightly different shape of the same thing.
>
> *Examples are in italics and refer to a fictional product, "Ledgerly." Delete them as you fill each section in.*

**Last updated:** [YYYY-MM-DD] · **Latest migration:** [name / timestamp]

---

## The entities, in plain English

*Before the tables: what things exist in this product, and how do they relate? Written so a non-technical reader can check whether it matches how the business actually works — which is the cheapest place to catch a modelling mistake.*

> *A **user** is a bookkeeper. She has many **clients**. Each client has many **invoices** (what they are owed) and many **transactions** (what actually moved through the bank). A **match** links one transaction to one invoice — and a match is a record in its own right, not a column, because we need to know who made it, when, and how confident we were.*

## Diagram

```
[user] 1---* [client] 1---* [invoice]
                  |              |
                  1              1
                  *              *
            [transaction] *---1 [match]
```

*Keep it text-based so it survives in Git and an agent can read it.*

## Entities

### [entity_name]

*[One line: what this represents in the real world, and what it does not.]*

| Field | Type | Notes / constraints |
| --- | --- | --- |
| `id` | uuid | PK |
| `created_at` | timestamptz | |
| [field] | [type] | [required? unique? default? what it means] |

**Relationships:** [belongs to X; has many Y]
**Owned by:** [which user or account can see this row — the rule enforced in code]

> *### match*
> *Records that we believe a transaction pays an invoice. Not a column on `transaction`, because one payment can cover several invoices.*
>
> *| Field | Type | Notes |*
> *| `transaction_id` | uuid | FK → transaction |*
> *| `invoice_id` | uuid | FK → invoice |*
> *| `confidence` | numeric | 0–1. Below 0.9 the match goes to the exception queue rather than being applied. |*
> *| `confirmed_by` | uuid \| null | Null means the system matched it; set means a human accepted it. We must always be able to tell these apart. |*

## Rules that protect the data

*The invariants. Things that must never be true, no matter what a feature wants. An agent that breaks one of these has broken the product even if the tests pass.*

- [Rule] — [why]

> *- A transaction may never be matched to an invoice belonging to a different client. This is the error that destroys trust in the product.*
> *- Nothing is hard-deleted. Bookkeeping is an audit trail; use `deleted_at`.*
> *- Money is stored in integer minor units (cents), never as a float.*

## Access and permissions

*Who can read and write what, and where that is enforced. Say where in the code the rule lives — a permission rule that exists only in this doc is a permission rule that does not exist.*

| Entity | Who can read | Who can write | Enforced where |
| --- | --- | --- | --- |
| [entity] | [rule] | [rule] | [file / policy] |

## AI-generated data

*If any field is produced by a model rather than a human, it must be traceable and distinguishable. Delete this section if the product has no AI-generated content.*

- **Which fields:** [list]
- **How we know it was AI-generated:** [the column that records it]
- **What we store about the generation:** [model, prompt version, timestamp, confidence]
- **Can a human override it?** [yes/no, and how the override is recorded]

## Migrations

| | |
| --- | --- |
| **Where they live** | [path] |
| **How to run them** | [command] |
| **Rules** | Never hand-edit the database. Never edit a migration that has already run — write a new one. |

---

**Related docs:** [`architecture.md`](architecture.md) (where this data sits) · [`decision_log.md`](decision_log.md) (why it is shaped this way) · [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) (log it there when a data constraint forces a change to the product plan)
