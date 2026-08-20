# Decision Log — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Claude Code records the decision; the product owner makes any decision that is a product decision.
> **Update when:** A choice is made that would be expensive to reverse, or that a future agent might quietly undo without knowing it was a choice at all.
> **This doc contains:** What we decided, why, what we gave up, and what would make us change our mind.
> **This doc never contains:** Everyday implementation choices. If reversing it would take an afternoon, it does not belong here.
>
> **Append-only. Newest at the top. Never edit or delete a past decision** — if it turns out to be wrong, write a new entry that supersedes it and link the two. The history of a wrong turn is often more useful than the correction.
>
> **Decision log vs. reality log:** this doc says *why we chose what we chose*. [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) says *how the build diverged from the plan*. A deviation in the reality log often produces a decision here.
>
> **Before reversing anything in this log, read the entry.** It exists so you do not re-litigate a settled question, or undo a choice whose reasons are invisible in the code.
>
> *The example entry is in italics and refers to a fictional product, "Ledgerly." Delete it once you have a real one.*

---

## Entry template — copy this block

### D-[NN] · [YYYY-MM-DD] · [Short title]

| | |
| --- | --- |
| **Status** | Active / Superseded by [D-NN] / Reversed [YYYY-MM-DD] |
| **Type** | Product / Technical / Both |
| **Decided by** | [product owner / Claude Code + owner approval] |

**The question**
*What was actually being decided. State it as a question — it forces honesty about what was open.*

**What we decided**
*The choice, in one sentence.*

**Why**
*The reasoning as it stood at the time. Do not clean it up with hindsight — a future agent needs to know what we actually knew.*

**What we gave up**
*The alternative and what was genuinely good about it. If the rejected option had no merit, this was not a decision worth logging.*

**What would make us reconsider**
*The trigger. A decision with no reversal condition is a decision nobody can ever revisit safely.*

---

## Decisions

<!-- Newest entry goes directly below this line. -->

### D-02 · 2026-08-19 · Semantic design-token layer for styling

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical |
| **Decided by** | Claude Code proposal + owner approval |

**The question**
How do we keep colors and styling consistent across the app as more components are built, instead of hardcoding the palette into every file?

**What we decided**
Define a **semantic design-token layer** once in [`../tailwind.config.ts`](../tailwind.config.ts) — roles like `yours`, `market`, `edge`, `tier`, `warning`, plus a neutral base (`surface`, `ink`, `line`, `brand`) — and require components to style with those token names, never raw Tailwind color classes (`bg-sky-50`). Applied to the player-table prototype as the first consumer; the token values map to the exact shades already in use (no visual change).

**Why**
The prototype is the foundation of the real tool, and more components are coming. A single source of truth for the palette gives consistency by default, one-place restyling/rebranding, and a clear path to dark mode. The owner asked for this structure *before* giving visual feedback, so that feedback lands as a one-file change rather than an edit spread across many components.

**What we gave up**
A little indirection — `bg-yours-surface` requires knowing it maps to sky-50 — versus the immediacy of raw Tailwind classes. Accepted: the names are self-documenting by role, and the config is short and centralized.

**What would make us reconsider**
Adopting a full component/design-system library with its own theming — we'd align the tokens to that instead. (If the app somehow stayed a single component forever, the layer would be mild overhead; that is not the trajectory.)

---

### D-01 · 2026-08-19 · Tech stack: Next.js + TypeScript

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical (product-approved) |
| **Decided by** | Claude Code proposal + owner approval |

**The question**
What stack do we build the player table prototype — and the real tool it grows into — on, given the product must run locally now and deploy to the web later without rework, and its centerpiece is one rich, interactive, editable, filterable table?

**What we decided**
Next.js (React) + TypeScript, with TanStack Table for the data grid and Tailwind for styling. Local-first (`npm run dev`), deployable to Vercel later with no rearchitecting. One app, one language.

**Why**
It matches the brief's own description of the product — "a single web application, run locally to start but built so it can be deployed to the web later without rework." One language across the whole app means no second system for a solo, non-technical owner to run and maintain. TanStack Table is best-in-class for exactly the sort/filter/tiers/editable-column behavior that *is* the product. The later data work (CBS + FantasyPros ingestion, valuation engine, backtest) fits inside the same app's server routes; the roadmap itself calls the engine "minimal," well within what TypeScript handles comfortably.

**What we gave up**
Python/FastAPI's native data-science ecosystem (pandas/numpy), which would be the more natural home for the valuation engine and backtest. We accept this because those pieces are scoped small, and because we can add a Python service *behind a clean API boundary* later if — and only if — the engine genuinely outgrows TypeScript, without disturbing the UI.

**What would make us reconsider**
The valuation engine or backtest proving substantially heavier than TypeScript handles well (e.g. real numerical/statistical modeling at data-science scale). At that point we introduce a Python service behind an API boundary rather than replacing the stack — the UI decision above stands regardless.

---

**Related docs:** [`architecture.md`](architecture.md) and [`data_model.md`](data_model.md) (the structures these decisions produced) · [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) (deviations that often force a decision here)
