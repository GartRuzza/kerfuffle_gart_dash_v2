# [PRODUCT NAME]

> **How to use this file:** this is the README for your *actual product*, not for the template system. When you start a new project, copy this file's contents over the repo's `README.md`, fill it in, and delete the `template-system/` folder.
>
> Keep it short. This is a front door, not a manual — every question it raises should be answerable by clicking a link. *Examples are in italics, from a fictional product called "Ledgerly." Delete them.*

**[One sentence: who it's for, what job it does, what changes for them.]**

> *Ledgerly reconciles invoices against bank activity for freelance bookkeepers, so they review exceptions instead of hunting for matches.*

**Status:** Concept / Prototype / MVP in progress / Beta / Production
**Live at:** [url, or "not deployed yet"]

---

## What it is

*One paragraph. What the product does and who it's for. If someone reads only this, what must they understand?*

**Who it's for:** [the primary user — the one person we optimize for]

For the full picture: [`docs/product_brief.md`](docs/product_brief.md) is the 60-second working definition; [`docs/pm/product_vision.md`](docs/pm/product_vision.md) is why the product exists at all.

## Where the truth lives

This project's source of truth is its docs, not any chat history. **Start here:**

| To know… | Read |
| --- | --- |
| **What actually exists right now** | [`docs/pm/current_state.md`](docs/pm/current_state.md) — always start here |
| What the product is | [`docs/product_brief.md`](docs/product_brief.md) |
| What's being built next | [`docs/pm/roadmap.md`](docs/pm/roadmap.md) |
| How the system is built | [`docs/architecture.md`](docs/architecture.md) |
| How the data is shaped | [`docs/data_model.md`](docs/data_model.md) |
| Why we chose what we chose | [`docs/decision_log.md`](docs/decision_log.md) |
| How to test it | [`docs/qa_test_plan.md`](docs/qa_test_plan.md) |
| What changed recently | [`docs/release_notes.md`](docs/release_notes.md) |

**Work pipeline:** [GitHub Issues](../../issues) · [Project board](../../projects)

> **A roadmap item is a plan, not a feature.** Only [`current_state.md`](docs/pm/current_state.md) says what is real.

## Tech stack

| Layer | What we use |
| --- | --- |
| Frontend | [ ] |
| Backend / API | [ ] |
| Database | [ ] |
| Auth | [ ] |
| Hosting | [ ] |
| Payments | [ ] |
| AI providers | [ ] |

Details and the boundaries to build within: [`docs/architecture.md`](docs/architecture.md).

## Running it locally

```bash
# 1. Install
[command]

# 2. Configure — copy .env.example to .env and fill it in.
#    Never commit .env. Never put a secret in the repo.
[command]

# 3. Set up the database
[command]

# 4. Run
[command]
```

Then open [http://localhost:PORT](http://localhost:PORT).

**Requirements:** [Node version, database, anything else you need installed first]

## How we work

```
idea → docs/feature_backlog.md → docs/pm/roadmap.md → GitHub Issue → branch → PR → docs updated → merge
```

Nothing meaningful goes straight to `main`. Every pull request must carry a plain-English summary, the manual QA steps to verify it, and any doc updates **in the same diff as the code**.

**For AI agents:** [`CLAUDE.md`](CLAUDE.md) is the rulebook — what to read before starting, what to update before reporting done. Read-only reviewer subagents live in [`.claude/agents/`](.claude/agents/).

## Testing and releasing

**To verify a change:** follow the relevant checks in [`docs/qa_test_plan.md`](docs/qa_test_plan.md). They're written to be run without reading any code.

**Automated tests:** `[command]`

A feature is not "Built" in [`current_state.md`](docs/pm/current_state.md) until its checks pass. Anything user-facing gets an entry in [`release_notes.md`](docs/release_notes.md).

## Known limitations

*The honest list. What doesn't work, what's half-built, what will break under load. Keep it current — the full detail lives in [`current_state.md`](docs/pm/current_state.md), and this is just the headline.*

- [Limitation — and what it means for a user]

> *- Roughly 40% of transactions still need manual review; fuzzy matching isn't built yet.*
> *- Bank statements over 5,000 rows will time out.*
