---
description: Audit the docs against the actual code and report where they disagree
---

# /reconcile — audit the docs against reality

Audit this project's documentation against the code that actually exists, and report every place they disagree.

## Why you are doing this

Every other mechanism in this project fires when a change happens — the Issue, the PR checklist, the docs check. But `docs/pm/current_state.md` does not usually go wrong at that moment. It rots slowly, in between: a feature marked **Built** quietly breaks, a **Partial** feature gets finished and nobody moves it, a limitation gets fixed but its note stays, three PRs each update the doc 90% correctly and the missing 10% compounds.

Nothing else in this system will ever catch that. Every agent is instructed to trust `current_state.md` as ground truth, so when it drifts, everything downstream of it drifts too — silently, and with confidence.

You are the only check on whether the docs are actually **true**. Take it seriously.

## The rules

1. **Report. Do not edit.** Do not fix a single doc, however obvious the fix looks. A disagreement between a doc and the code has two possible causes — *the doc is wrong*, or *the code is broken* — and telling those apart is a product judgment the owner makes, not you. Silently "fixing" a doc to match broken code would erase the only evidence that something is broken.
2. **Evidence, not impressions.** Every finding cites a specific file and line. "The matching engine looks incomplete" is worthless. "`current_state.md` says fuzzy matching is Built, but `src/matching/fuzzy.ts:12` throws `NotImplementedError`" is a finding.
3. **Verify, do not assume.** Do not conclude a feature exists because a file is named after it, a route is registered, or a test file exists. Read the code and confirm it does the thing. A stub with the right name is the single most common cause of a false "Built."
4. **Say what you could not check.** If you could not verify a claim — it needs a running app, real data, a deploy — say so explicitly and mark it **Unverified**. An unverified claim silently reported as fine is exactly the failure mode you exist to prevent.
5. **Be blunt.** Do not soften findings. The owner is non-technical and is relying on this report to know what is real.

## What to check

Read [`docs/pm/current_state.md`](../../docs/pm/current_state.md) first — it is the doc under audit, and every claim in it is a claim to be tested.

**1. The status table — check every row.**

| It claims | You verify |
| --- | --- |
| **Built** | The code fully supports this, end to end. A user could do it today. Stubs, `TODO`s, hardcoded values, and unhandled failure paths mean it is **not** Built. |
| **Partial** | The "what's missing" description is still accurate. Has the gap widened, closed, or moved since it was written? |
| **Not built** | It really is absent. Someone may have built it and not updated the doc — that happens more often than you would expect. |

**2. Undocumented features.** Sweep the code for capabilities no doc mentions at all. Work that arrived without a doc update is precisely the kind of drift this audit exists to find.

**3. Known bugs.** For each entry in the bugs table: is it still broken? Has it been fixed without being closed out?

**4. Limitations.** Are the listed constraints still true? Has one been quietly lifted, or newly introduced?

**5. The other reality docs.**

- [`architecture.md`](../../docs/architecture.md) — does it describe the system that exists now, or one from three months ago? Check the stack, the boundaries, and anything marked *(planned)* that may since have been built.
- [`data_model.md`](../../docs/data_model.md) — do the entities and fields match the actual migrations? An undocumented column is a real finding.
- [`qa_test_plan.md`](../../docs/qa_test_plan.md) — does every feature marked **Built** have checks? A feature with no checks cannot honestly be called Built, per this project's own rule.
- [`release_notes.md`](../../docs/release_notes.md) — has anything user-facing shipped without a note?

**6. Contradictions between docs.** Any doc other than `current_state.md` that asserts a build status is wrong by construction — status lives in exactly one place. Flag it.

**7. Staleness.** Compare each doc's "last updated" date against recent commit history. A doc that has not moved while the code has is a doc to be suspicious of, not proof that nothing changed.

## The report

Output this, and nothing else. No preamble.

---

### Reconciliation report — [today's date]

**Verdict:** [One sentence. Can the owner trust `current_state.md` right now — yes, mostly, or no?]

**Findings:** [N] · **Unverified:** [N]

### Findings

Ordered by how much damage the discrepancy would cause if acted on. For each:

**[1] [Severity: High / Medium / Low] — [one-line summary]**

- **The doc says:** [quote it, with the file]
- **The code says:** [what is actually true, with `file:line`]
- **Why it matters:** [what an agent or the owner would get wrong by trusting the doc — in plain English]
- **Two readings:** [Is the doc wrong, or is the code broken? Say which you think it is and why. If it is genuinely ambiguous, say that.]
- **Suggested correction:** [what you would change, and in which doc — as a proposal, not an action]

### Could not verify

- [Claim] — [why you could not check it, and what it would take]

### Undocumented

- [What exists in the code that no doc mentions]

### Nothing wrong here

[Briefly: what you checked and found accurate. The owner needs to know how much of the doc survived the audit, not just what failed.]

---

## After the report

Stop. Ask the owner which corrections they want applied.

If they approve, apply **only** what they approved, then add a line to the latest entry in [`implementation_reality_log.md`](../../docs/pm/implementation_reality_log.md) recording that a reconciliation happened and what it changed — the drift itself is a fact about the project worth keeping.

If the audit found that **code is broken** (as opposed to docs being wrong), that is not a doc fix. Say so plainly and recommend a bug Issue.
