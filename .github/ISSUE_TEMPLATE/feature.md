---
name: Feature or change
about: A piece of work promoted from the roadmap
title: ''
labels: ''
assignees: ''
---

## What and why

<!-- What are we building, and why now? One paragraph, plain English. -->

**Roadmap item:** <!-- which entry in docs/pm/roadmap.md this comes from -->
**User flow it belongs to:** <!-- from docs/user_flows.md — a feature that isn't a step in a real journey is a screen nobody asked for -->

## Who it's for

<!-- Which user, and what they can do afterwards that they can't do today. -->

## Done means

<!-- Acceptance criteria, written as things an owner can observe — not implementation steps.
     If you can't check it by using the product, it isn't a criterion. -->

- [ ]
- [ ]

## Out of scope

<!-- What this ticket explicitly does NOT include. The strongest defense against scope creep
     is writing this down before the work starts. -->

## Dependencies

<!-- What must already exist for this to be possible?
     CHECK docs/pm/current_state.md — do not assume a dependency is built because
     the roadmap lists it. If a dependency is Partial or Not built, say so here. -->

## Expected doc impact

<!-- Declared BEFORE work starts, so the PR checklist holds no surprises.
     Tick what this work will probably touch. Being wrong is fine; being silent is not. -->

**Always, if this changes product code:**

- [x] `docs/pm/current_state.md`
- [x] `docs/pm/implementation_reality_log.md`

**Probably:**

- [ ] `docs/release_notes.md` — user-facing
- [ ] `docs/qa_test_plan.md` — new checks needed
- [ ] `docs/architecture.md` — structural change
- [ ] `docs/data_model.md` — schema change
- [ ] `docs/decision_log.md` — a hard-to-reverse choice is likely
- [ ] `docs/user_flows.md` — the journey changes shape

## Sensitive areas

- [ ] Touches **database schema, authentication, permissions, billing, production infrastructure, or a major dependency**

<!-- If ticked, the agent must explain the reasoning and implications to the owner and get
     approval BEFORE writing code. Not after, in the PR. -->

## Open questions for the owner

<!-- Product decisions that must be settled before this can be built.
     If any exist, this ticket is not ready to start. -->
