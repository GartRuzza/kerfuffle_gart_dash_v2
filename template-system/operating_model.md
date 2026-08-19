# Operating Model

How AI-assisted product development works in this system — the full manual.

> **This doc explains the system to a human.** It is not the rulebook the agents follow. That is [`CLAUDE.md`](../CLAUDE.md), and it is the only normative document — if this doc and `CLAUDE.md` ever disagree, `CLAUDE.md` wins and this one is out of date. Two rulebooks that quietly diverge is exactly the failure this whole system exists to prevent.
>
> **Delete the `template-system/` folder once your project is running.** Its job is done.

---

## Why this exists

AI agents make it cheap to write code and expensive to know what's true.

A single agent, in a single long conversation, can build a working feature in an hour. But it doesn't remember yesterday. It doesn't know that you already decided against the thing it's about to propose. It will read your roadmap, see a feature listed under "Now," and build on top of it as though it exists. It will tell you the work is done when what it means is that the code compiles.

None of that is fixed by a better prompt. It's fixed by **putting the truth outside the conversation**, in a place every agent must read before it acts and must update before it stops.

That place is this repository. Hence the core principle:

> **Chat is temporary. GitHub is memory.**

If a decision only exists in a chat window, it does not exist. If a piece of scope only exists in your head, it does not exist. If a feature is described in the roadmap but not in `current_state.md`, it is not built.

---

## The two kinds of document

Every doc in this system is either **intent** or **reality**, and the whole system depends on never confusing them.

**Intent** — the vision, the roadmap, the product brief, the user flows. These describe what we *want*. They're written by you and PM Claude, they're allowed to be ambitious, and they're allowed to be wrong.

**Reality** — `current_state.md`, the reality log, architecture, data model, QA plan, release notes. These describe what is *true*. They're written by Claude Code, and they are not allowed to be aspirational. Ever.

The failure this prevents is subtle and lethal: an agent reads an optimistic roadmap, assumes a dependency exists, builds on top of it, and reports success. Two weeks later you discover the foundation was a plan. Keeping intent and reality in physically separate documents, with different owners and different rules, is what makes that mistake hard to make.

**One doc arbitrates status: [`current_state.md`](../docs/pm/current_state.md).** Built, Partial, or Not built — those three words, nothing softer. No "mostly done." If any other doc implies a different status, it is wrong.

---

## Who does what

| | Role | Owns |
| --- | --- | --- |
| **You** | Product owner. The only one who makes product decisions. | The vision, the priorities, and every call an agent is told to escalate. |
| **Claude (web/app)** | Product manager. Strategy, prioritization, writing intent docs, drafting Issues. | `product_vision.md`, `roadmap.md`, `product_brief.md`, `user_flows.md` |
| **Claude Code** | Implementer. Reads the docs, writes the code, updates the reality docs, opens the PR. | Everything under "reality" above. |
| **Subagents** | Read-only reviewers (security, data model, QA, code review). They inspect and report; they don't edit. | Nothing. That's the point. |
| **GitHub** | The memory. | All of it. |

The line that matters most: **agents implement, you decide.** When a build raises a genuine product question — how should this behave, what do we charge, what happens in this edge case — the agent's job is to *stop and ask*, not to pick something reasonable and move on. A reasonable-sounding choice you never made is how a product drifts away from you.

`CLAUDE.md` names the specific areas where an agent must stop: database schema, authentication, permissions, billing, production infrastructure, and major dependencies. Those six are hard to reverse once real users exist.

---

## How work moves

```
idea → feature_backlog.md → roadmap.md → GitHub Issue → branch → PR → docs updated → merge
```

Each arrow is a deliberate gate.

**Idea → backlog.** Capture everything, judge nothing. A backlog is only useful if adding to it is nearly free. The backlog is an *inventory*, not a queue — an item sitting there is not a promise.

**Backlog → roadmap.** This is where you prioritize, and it is a decision only you make. The roadmap says what's next and *why*, with dependencies. An agent that wants to build something not on the roadmap should be told no.

**Roadmap → Issue.** One ticket, one piece of work. The Issue template forces the ticket to declare, before any code is written, which docs the work is expected to touch. This is what makes the PR checklist predictable instead of a surprise at the end.

**Issue → branch → PR.** Nothing meaningful goes straight to `main`. The PR is the accountability checkpoint — the one place where you can see the code, the docs, and the plain-English summary together, and say no.

**PR → merged, with docs.** Docs ship *in the same diff* as the code. Not "after." Not "next sprint." A doc update deferred is a doc update that never happens, and the moment `current_state.md` starts lying, every agent downstream of it starts building on a false premise.

---

## The build loop

The thing that makes this system more than a filing cabinet is that **implementation feeds back into strategy**.

Every build teaches you something the plan didn't know. The code turns out to be shaped differently than you assumed. A feature is three times bigger than it looked. A shortcut gets taken under time pressure. That knowledge is usually lost — it stays in the agent's head, and the head evaporates when the chat closes.

[`implementation_reality_log.md`](../docs/pm/implementation_reality_log.md) is where it goes instead. One entry per build cycle, append-only, capturing what was *supposed* to happen, what *actually* happened, and — the part you'll actually read — what that means for the product.

Then the loop closes:

1. Claude Code builds, and logs the divergence.
2. You (with PM Claude) read the reality log at the start of the next planning conversation.
3. The roadmap gets adjusted to reflect what the build taught you.
4. The next Issue is written from a plan that knows what the last one learned.

Without step 2 this is just a diary. **Read the reality log before every planning session.** It is the highest-value fifteen minutes in the whole system.

---

## Managing chats

Long AI conversations degrade. The agent starts forgetting the early context, contradicting itself, and confidently rebuilding things it already built. The instinct is to keep one giant chat going so it "remembers everything." That instinct is exactly backwards.

**Keep chats short and disposable. Put the memory in the repo.**

- **One chat per Issue.** When the ticket is done and the PR is merged, close the chat. Start a fresh one for the next ticket.
- **Separate the strategy chat from the building chat.** PM Claude in one window, Claude Code in another. They communicate through the docs, not through you copy-pasting.
- **If a chat is going sideways, don't fight it — restart it.** A fresh agent that reads `current_state.md` is smarter than a tired agent that has been arguing with itself for two hours.
- **Never let a decision live only in a chat.** If it matters, it goes in `decision_log.md` before the window closes.

The measure of whether this system is working: you can close every chat window, open a fresh agent tomorrow, point it at the repo, and it knows what's going on.

---

## Quality gates

Five things stand between a change and `main`:

1. **The Issue** — declares the expected doc impact before work starts.
2. **The PR template** — a checklist of what was actually updated, plus manual QA steps written for you.
3. **The [docs check](../.github/workflows/docs-check.yml)** — the only *hard* gate. Everything else on this list is a request an agent can quietly decline; this one fails the build. If a PR changes product code but doesn't update `current_state.md` and the reality log, it cannot merge. The `no-docs-needed` label overrides it — so skipping the docs is still possible, but only as a deliberate act by you, never as a silent omission by an agent. (One-time setup: [`SETUP.md`](SETUP.md).)
4. **The diff** — the code and the docs, side by side. Read the doc changes, not just the code. A ticked checkbox is a claim; the diff is evidence.
5. **[`qa_test_plan.md`](../docs/qa_test_plan.md)** — the rule that gives status meaning: *a feature is not "Built" in `current_state.md` until its checks pass.* When a check fails, the status drops to Partial or the bug gets logged. Test results are the evidence behind every claim in the status doc.

Read-only subagents (security, data model, QA, code review) can be pointed at a diff before you merge. They report; they don't edit. Use them when a change touches something you can't personally evaluate — auth, permissions, payments, schema.

### The one gate that isn't triggered by a change

Every gate above fires when something happens. But `current_state.md` doesn't go wrong at PR time — it rots slowly *between* PRs. A feature marked Built quietly breaks. A Partial feature gets finished and nobody moves it. Three PRs each update the doc 90% correctly, and the missing tenth compounds. Six months later the document every agent trusts as ground truth is confidently wrong, and **nothing in the system will ever tell you.**

So there's one gate that runs on a clock instead of an event:

> **`/reconcile`** — run it in Claude Code. An agent audits the docs against the code that actually exists and reports every place they disagree, with evidence. It reports; it doesn't edit, because a disagreement can mean the doc is wrong *or* the code is broken, and only you can tell which.

**Run it every few weeks, and always before a planning conversation with PM Claude.** That's when a false snapshot does the most damage — a plan built on a wrong `current_state.md` wastes weeks, not minutes.

It's a habit, not an automation, which means it can be forgotten. If you find you never run it, that's real information: the fix is to schedule it, not to hope harder.

---

## Keep it simple

Every tool you add is a thing you maintain forever, and complexity is the most common way a solo project quietly dies.

**Start with exactly this:** Claude (web) for product, Claude Code for building, VS Code, GitHub. That's it. It's enough to ship a real product.

**Add a tool only when a specific, felt problem demands it** — not because it's impressive, and not because an agent suggested it. Automated browser testing, MCP servers, additional agents, extra infrastructure: each is a reasonable answer to a problem you may never have. Wait until you have the problem.

The same applies to the docs. Twelve documents is a lot of surface to maintain. If one of them isn't earning its keep in your project, delete it — a doc nobody updates is worse than no doc at all, because agents trust it.
