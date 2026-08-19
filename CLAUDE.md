# CLAUDE.md — [PROJECT NAME]

Instructions for Claude Code and any agent working in this repository.

## The source of truth

The documents in [`docs/`](docs/) define this product. They are the source of truth — above your assumptions, above the chat history, and above anything you infer from the code.

### Product docs — `docs/pm/`

| Doc | Answers | Maintained by |
| --- | --- | --- |
| [`product_vision.md`](docs/pm/product_vision.md) | Why this product exists, who it is for, what we refuse to build | Owner + PM Claude |
| [`roadmap.md`](docs/pm/roadmap.md) | What we build next, in what order, and why | Owner + PM Claude |
| [`current_state.md`](docs/pm/current_state.md) | What actually exists in the code right now | **Claude Code** |
| [`implementation_reality_log.md`](docs/pm/implementation_reality_log.md) | Where the build diverged from the plan, and what that means | **Claude Code** |

The first two are **intent**. The last two are **reality**. Never let one masquerade as the other: an item in the roadmap's "Now" column is a plan, not a feature that exists.

### Working docs — `docs/`

| Doc | Answers | Maintained by |
| --- | --- | --- |
| [`product_brief.md`](docs/product_brief.md) | What the product is, in 60 seconds — the working definition | Owner + PM Claude |
| [`user_flows.md`](docs/user_flows.md) | How a real user moves through the product, and where they get stuck | Owner + PM Claude |
| [`architecture.md`](docs/architecture.md) | How the system is structured, and the boundaries you must build within | **Claude Code** |
| [`data_model.md`](docs/data_model.md) | The entities, relationships, and the rules that protect the data | **Claude Code** |
| [`decision_log.md`](docs/decision_log.md) | Why we chose what we chose — do not reverse a decision without reading it | **Claude Code** |
| [`qa_test_plan.md`](docs/qa_test_plan.md) | How to verify the product works, without reading code | **Claude Code** |
| [`release_notes.md`](docs/release_notes.md) | What changed for the user, each release | **Claude Code** |
| [`feature_backlog.md`](docs/feature_backlog.md) | Every candidate feature — an inventory, **not** a commitment | Shared |

Nothing gets built straight from the backlog. The path is: **idea → backlog → roadmap → GitHub Issue → build.**

## If these docs are still empty, stop

This repository is generated from a template. If the docs are unfilled placeholders — `[PROJECT NAME]`, sections still containing their instructions — then **stop and tell the owner before writing any code.** The docs must be filled in first.

An agent that reads an empty `current_state.md` does not conclude "nothing is built." It concludes nothing, and then guesses. Empty docs are worse than no docs, because they will be trusted. Filling them in is the first task of the project, not a chore to be done later.

## Before you start any substantial work

1. **Read [`pm/current_state.md`](docs/pm/current_state.md) first.** Never assume a feature exists because the roadmap lists it, the vision implies it, or the architecture describes it.
2. Read [`pm/roadmap.md`](docs/pm/roadmap.md) to confirm the work is actually next, and to check its dependencies and sequencing constraints.
3. Read [`product_brief.md`](docs/product_brief.md) for grounding, and [`user_flows.md`](docs/user_flows.md) so you build a step in a real journey rather than an isolated screen.
4. Before writing code, read [`architecture.md`](docs/architecture.md) for the boundaries you must respect, and [`data_model.md`](docs/data_model.md) if the work stores anything.
5. Check [`decision_log.md`](docs/decision_log.md) before contradicting an existing choice. If the reason for something is invisible in the code, it is probably written there.
6. When the work involves a judgment call, [`pm/product_vision.md`](docs/pm/product_vision.md) is the tie-breaker: its **principles** decide close calls, its **non-goals** are grounds to decline.

Work on **one ticket at a time**. Before editing, state the goal, the plan, and the main risks in plain English.

## Before you report work complete

Work is not done until these are done. The triggers below are **binary** — they are not a judgment call about whether the work was "major" or "meaningful" enough. If the trigger fires, the doc gets updated.

**If this change touches any product source file, both of these are required. No exceptions:**

1. **Update [`pm/current_state.md`](docs/pm/current_state.md)** — feature statuses, anything now Partial and exactly what is missing from it, new limitations, new bugs, the latest implementation summary, and the date.
2. **Add an entry to [`pm/implementation_reality_log.md`](docs/pm/implementation_reality_log.md)** — newest at the top, never editing an old entry. If the build went to plan, three lines is enough. If it did not, the **product implications** section is the one the owner will actually read, so write it in plain English.

*(A change that touches only docs, config, or tooling is the sole exception — say so explicitly in the PR.)*

**Then, each of these when its trigger fires:**

| If… | Then update |
| --- | --- |
| A user can see or do anything differently | [`release_notes.md`](docs/release_notes.md) — written from the user's point of view |
| A feature shipped | [`qa_test_plan.md`](docs/qa_test_plan.md) — add its checks. **A feature is not "Built" in `current_state.md` until its checks pass.** |
| A bug was fixed | [`qa_test_plan.md`](docs/qa_test_plan.md) — add the check that would have caught it |
| A file was added, a module boundary moved, or a dependency changed | [`architecture.md`](docs/architecture.md) |
| A migration was written | [`data_model.md`](docs/data_model.md) — *with* the change, not after it |
| You chose between two real options and reversing it would cost more than a day | [`decision_log.md`](docs/decision_log.md) — including what you gave up and what would make us reconsider |
| A user's journey changed shape | [`user_flows.md`](docs/user_flows.md) |

**Status lives in one place.** [`pm/current_state.md`](docs/pm/current_state.md) is the only doc that says whether something is Built, Partial, or Not built. Never record a status anywhere else — a second copy is a copy that goes stale, and then nobody knows which to believe.

Finally: review the full diff, including the doc changes, before you report done.

## Escalate, do not decide

Some questions are the product owner's, not yours. If a build raises one:

- **Stop.** Do not silently pick a product behavior.
- Record it under **Follow-up decisions** in the reality log and surface it to the owner.
- Once decided, it goes into the **Open product decisions** table in [`pm/roadmap.md`](docs/pm/roadmap.md) with the date, and — if it is a lasting choice — into the [`decision_log.md`](docs/decision_log.md).

Anything touching **database schema, authentication, permissions, billing, production infrastructure, or major dependencies** needs its reasoning and implications explained to the owner **before** you change it.

## House rules

- The product owner is **non-technical**. Explain plans, risks, and results in plain English; briefly define any unavoidable technical term.
- Stay in scope. Small, reversible changes.
- Never commit credentials, secrets, tokens, or personal data.
- Run the relevant checks and review the final diff before reporting completion.

---

*These docs are templates. Fill them in for the real product before the first line of code — an empty `current_state.md` is an agent flying blind.*
