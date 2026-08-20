# Claude SaaS Project Template

A standard operating system for building SaaS products with AI agents.

**The core principle: chat is temporary, GitHub is memory.** A conversation with an AI is gone the moment the window closes, and no agent can be trusted to remember what was decided last month. So everything that matters — what we're building, why, what actually exists, what we already decided — lives in this repository as Markdown. The docs are the memory. The agents are just workers who read them.

---

## Start a new project from this template

1. **Click "Use this template"** on GitHub to create your new project repo.
2. **Read [`template-system/operating_model.md`](template-system/operating_model.md)** — the full manual for how this system works. Read it once, properly. It is the only long doc here.
3. **Fill in the docs before writing any code.** In this order:
   - [`docs/pm/product_vision.md`](docs/pm/product_vision.md) — why the product exists
   - [`docs/product_brief.md`](docs/product_brief.md) — the 60-second working definition
   - [`docs/user_flows.md`](docs/user_flows.md) — how a real person will use it
   - [`docs/pm/roadmap.md`](docs/pm/roadmap.md) — what gets built first, and why
   - [`docs/pm/current_state.md`](docs/pm/current_state.md) — "nothing is built yet." Say so explicitly.

   Claude (web or app) is good at this part. Talk it through, then have it write the docs.
4. **Replace this `README.md`** with the contents of [`template-system/PROJECT_README_TEMPLATE.md`](template-system/PROJECT_README_TEMPLATE.md), filled in for your product.
5. **Delete the `template-system/` folder.** It has done its job.
6. **Fill in the `[PROJECT NAME]` placeholders** in `CLAUDE.md` and the docs.
7. **Configure the docs check** — five minutes of GitHub settings, once per project: [`template-system/SETUP.md`](template-system/SETUP.md). It's what makes the doc rules enforceable rather than merely requested.
8. **Write your first GitHub Issues** from the roadmap's "Now" column, then start building.

> **Do not skip step 3.** `CLAUDE.md` tells every agent that these docs are the source of truth. If they are empty, an agent doesn't conclude "nothing is built" — it concludes nothing, and starts guessing. Empty docs are worse than no docs.

---

## What's in here

| Path | What it is |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | **The rulebook for AI agents.** What to read before working, what to update after. This is the file that makes the system enforce itself. |
| [`docs/`](docs/) | The twelve product docs. The source of truth for what you're building. |
| [`docs/pm/`](docs/pm/) | The four product-management docs — vision, roadmap, and the two "what's actually true" docs. |
| [`.github/`](.github/) | Issue and pull request templates, and the [docs check](.github/workflows/docs-check.yml) that fails a PR changing code without docs. |
| [`.claude/commands/`](.claude/commands/) | Slash commands for Claude Code. Includes [`/reconcile`](.claude/commands/reconcile.md) — see below. |
| [`template-system/`](template-system/) | Explains this system. **Delete it once your project is running.** See [`SETUP.md`](template-system/SETUP.md) for the one-time GitHub configuration. |

### `/reconcile` — the docs-vs-reality audit

Type `/reconcile` in Claude Code. An agent audits the docs against the code that actually exists and reports every place they disagree, with evidence. It reports rather than edits, because a disagreement can mean the doc is wrong *or* the code is broken — and only you can tell which.

**Run it every few weeks, and always before a planning session.** Everything else in this system fires when a change happens; nothing else catches the slow rot in between, and `current_state.md` is the doc every agent is told to trust.

Every doc is a fillable template with instructions and a worked example (from a fictional bookkeeping product called "Ledgerly"). Delete the examples as you go.

---

## The docs, and who owns each

The most important idea in this system is the split between **what we want** and **what is actually true**. Plans are optimistic; code is not. Keeping them in separate documents is what stops an agent from treating a roadmap item as a finished feature.

**Intent — you and PM Claude own these:**

| Doc | Answers |
| --- | --- |
| [`pm/product_vision.md`](docs/pm/product_vision.md) | Why this exists, who it's for, what we refuse to build |
| [`pm/roadmap.md`](docs/pm/roadmap.md) | What we build next, in what order, and why |
| [`product_brief.md`](docs/product_brief.md) | What the product is, in 60 seconds |
| [`user_flows.md`](docs/user_flows.md) | How a real user moves through it, and where they get stuck |

**Reality — Claude Code owns these, and must update them before any work counts as done:**

| Doc | Answers |
| --- | --- |
| [`pm/current_state.md`](docs/pm/current_state.md) | What actually exists in the code **right now** |
| [`pm/implementation_reality_log.md`](docs/pm/implementation_reality_log.md) | Where the build diverged from the plan, and what that means |
| [`architecture.md`](docs/architecture.md) | How the system is structured; the boundaries to build within |
| [`data_model.md`](docs/data_model.md) | The entities, relationships, and rules protecting the data |
| [`decision_log.md`](docs/decision_log.md) | Why we chose what we chose — don't reverse one without reading it |
| [`qa_test_plan.md`](docs/qa_test_plan.md) | How to verify it works, without reading code |
| [`release_notes.md`](docs/release_notes.md) | What changed for the user, each release |

**Shared:** [`feature_backlog.md`](docs/feature_backlog.md) — every candidate feature. An inventory, **not** a commitment.

If two docs ever disagree about whether something is built, [`pm/current_state.md`](docs/pm/current_state.md) wins. It is the only doc that states status.

---

## How work flows

```
idea → feature_backlog.md → roadmap.md → GitHub Issue → branch → PR → docs updated → merge
```

Nothing gets built straight from the backlog, and nothing meaningful goes straight to `main`. Every step exists to make a change visible before it becomes permanent.

**What you should expect from every pull request:** a plain-English summary of what changed, the manual QA steps so you can verify it yourself, and updated docs in the same diff as the code. If a PR changes product code but touches no docs, something has been skipped.

Full detail — the roles, the agents, how to keep chats from getting bloated, and how implementation reality feeds back into strategy — is in [`template-system/operating_model.md`](template-system/operating_model.md).

---

## The tools

| Tool | Role |
| --- | --- |
| **Claude (web/app)** | Product manager. Strategy, roadmap, writing the intent docs. |
| **Claude Code** | The implementer. Reads the docs, writes the code, updates the reality docs. |
| **VS Code** | Where the work happens. |
| **GitHub** | The memory. Repo, Issues, Projects, pull requests. |

Start with exactly this. Add tools only when a real problem demands one — every tool added is a thing to maintain, and complexity is the main way a solo project dies.
