# Raw snapshot archival tool (issue #10)

**One line:** run `npm run archive` to save a fresh, dated, verbatim snapshot of the
KERFUFFLE league (CBS) and expert rankings (FantasyPros) under `data/raw/` — nothing
is ever overwritten.

This is the durable, repeatable version of the throwaway spike pulls
(`spikes/cbs-api/pull.mjs`, `spikes/fantasypros-api/pull.mjs`). It **only reads**
(HTTP GET) — it never bids, drops, sets a lineup, or writes anything to CBS or
FantasyPros.

## What it does

Each run creates one new folder `data/raw/{timestamp}/` containing:

```
data/raw/2026-08-25T14-30-00Z/
  cbs/                     ← every CBS page, saved as raw .html
    roster-report-t1.html … roster-report-t12.html   (all 12 team rosters)
    teams-myteam.html, players-available.html, transactions.html,
    rules.html, draft-results.html, … (the full league page set)
  fantasypros/             ← every FantasyPros response, saved as raw .json
    ecr-draft-ppr-all.json, ecr-dynasty-ppr-all.json, projections-all.json, …
  manifest.json            ← index of every response: source, URL, fetched_at, HTTP status
```

**Append-only:** a new timestamped folder each run, so a wrong parser later is fixed
by re-parsing the archive — never by re-fetching. `data/` is git-ignored; real league
data and credentials never enter the repo.

## Before you run — credentials

Credentials are read from the existing spike `.env` files (no re-pasting):

- **CBS cookie** → `spikes/cbs-api/.env` as `CBS_COOKIE` (expires ~weekly; re-paste it
  from your browser when it does — see `spikes/cbs-api/README.md` for how to copy it).
- **FantasyPros HOF key** → `spikes/fantasypros-api/.env` as `FP_API_KEY` (stable).

## Run it

```bash
# 1. (optional but recommended) confirm your CBS cookie still works:
npm run archive:check-cookie

# 2. capture a snapshot:
npm run archive
```

Or without npm: `node tools/archive/check-cookie.mjs` and `node tools/archive/capture.mjs`.

If a batch of CBS pages come back as **LOGIN REDIRECT**, your cookie expired — refresh
it in `spikes/cbs-api/.env` and run again. If FantasyPros rows come back at ~520 with
`public_api_limited: false` in the manifest, the HOF key is unlocking the full board.

## Deliberately out of scope

Parsing / normalization, any database, and scheduling / automation — those are later
roadmap work (issues #11 and #12). **Historical CBS seasons are not captured:** the
CBS year switch isn't a URL parameter (see `docs/cbs_data_discovery.md`), so this
archives the **current** season only. FAB winning-bid amounts remain unsolved upstream.
