# Source profiler (issue #11)

Walks the latest raw snapshot (from the archival tool, issue #10) and emits a
**committed field profile** — every page/endpoint, each field's inferred type, a
**shape-only** example, its blank rate and cardinality — plus the CBS `/rules`
**scoring config in full**. Re-run after each pull; the git diff is your
source-drift alarm (a new column, a changed type, a blank-rate jump).

This is **discovery/documentation tooling**, not part of the app and not ingestion.
It only **reads** the local raw archive; it never fetches CBS or FantasyPros.

## Run

```bash
npm run profile                       # profiles data/raw/<latest>/
node tools/profile/generate.mjs 2026-08-25T21-54-26Z   # a specific run
```

Prereq: at least one archive run exists under `data/raw/` (`npm run archive`).

## What it writes (committed, in `docs/profiles/`)

| File | Contents |
| --- | --- |
| `PROFILE.md` | Human-readable summary answering issue #11's six questions |
| `cbs_field_profile.json` | Per-page column profiles (rosters pooled across 12 teams + each league page) |
| `fantasypros_field_profile.json` | Per-endpoint envelope + field profiles |
| `cbs_scoring_rules.json` | The `/rules` scoring values (real, in full), roster limits, league settings |

## The safety rule (owner decision, public repo)

The profile shows field **shapes**, never real player/roster/market **values**.
Every value is masked (`Ja'Marr Chase` → `Aa'Aaaa Aaaaa`, `$102` → `$999`). Only
curated **non-private structural enums** (positions, roster statuses, contract-year
domain, bye weeks…) list their real distinct values — that's the enum evidence the
schema (#12) needs, and none of it is league-private. League **rules** (the scoring
config) are committed in full because they are rules, not player data.

A **leak self-check** runs before anything is written and **fails the run** if any
private field would publish a real value. The same invariant is unit-tested
(`sanitize.test.mjs`).

## Layout

| File | Role |
| --- | --- |
| `generate.mjs` | Orchestrator: resolve run → profile → leak-check → write 4 files |
| `parse-cbs.mjs` | CBS HTML → tables/rosters (column mapping by **header name**, never position) |
| `parse-scoring.mjs` | CBS `/rules` → structured scoring (flat / per-unit / tiered), limits, settings |
| `parse-fp.mjs` | FantasyPros JSON → envelope + field profiles |
| `profile-core.mjs` | Pure: type inference, blank rate, cardinality, column profiling |
| `sanitize.mjs` | Pure: masking + field classification (the safety rule) |
| `shared.mjs` | Run resolution + deterministic file I/O |
| `*.test.mjs` | Vitest unit tests (run with `npm test`) |
