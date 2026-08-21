# FantasyPros API spike (GitHub issue #7, roadmap #3)

> **STATUS: built, awaiting a run.** The scripts are ready; they need a free
> FantasyPros API key (one step for you, below). The full write-up will land at
> [`../../docs/fantasypros_data_discovery.md`](../../docs/fantasypros_data_discovery.md) after we run it.

A **throwaway, read-only** experiment to answer two questions:

1. **Access + cost:** Can we pull FantasyPros rankings/tiers with a *free* API key, and
   what does the free tier give us versus what needs a paid HOF plan (~$9/mo) —
   especially **dynasty ECR** and **tiers**?
2. **The join (the ugly part):** Can we reliably match a FantasyPros player to the
   **CBS player id** the CBS spike found (our join key)?

This folder is **not** part of the Gart Dash app and is never deployed. The scripts
here only **read** (HTTP GET) — they never write anything to FantasyPros.

## What we already know (from research)

- FantasyPros has an **official JSON REST API**. Base URL `https://api.fantasypros.com/public/v2/json`; auth is an `x-api-key` header.
- There's a **free, self-serve tier** meant for "build, test, prototype" — exactly this spike. (Paid **HOF** = a personal production key; **Commercial** = negotiated, only needed for shared/sold products. Our tool is single-user and local, so the free/personal path fits.)
- **Scraping is against their terms** — we do not do it. This spike uses the sanctioned API only.

## How to run it

### Step 1 — get a free API key (one step for you)

1. Go to **https://secure.fantasypros.com/api-keys/request/** and sign in with your
   FantasyPros account (a free account is fine).
2. Request an API key. Choose the **free / development** option — no payment needed.
3. Copy the key. *Treat it like a password.*

### Step 2 — put it in a local, private file

1. In this folder, copy **`.env.example`** to a new file named **`.env`**.
2. Paste your key: `FP_API_KEY=` the key from Step 1.
3. Save. `.env` is git-ignored — it will not be committed.

### Step 3 — probe the API (from the project root)

```
node spikes/fantasypros-api/pull.mjs
```

It tries ~15 read-only endpoints (rankings across scoring formats and positions,
redraft + **dynasty**, projections, player metadata, news), saves each raw JSON
into `spikes/fantasypros-api/output/` (git-ignored), and prints a table showing —
per endpoint — the row count and whether **tier / ecr / adp / proj** fields and any
**cross-reference IDs** are present. A `401/403` or an error message on the dynasty
rows tells us that data is **gated behind a paid tier**.

### Step 4 — test the CBS ↔ FantasyPros join

```
node spikes/fantasypros-api/match.mjs
```

This reads the **real CBS players** already saved by the CBS spike
(`spikes/cbs-api/output/*.html` — 141 players with real CBS ids) and the FantasyPros
players from Step 3, then reports a **match rate**: how many CBS players we can line
up with a FantasyPros ranking, by shared id if one exists, otherwise by normalized
name (+ position/team). It lists the players that don't match and why. The full
report is written to `output/_match_report.json`.

*(If you see "No CBS players found," the CBS spike output isn't on disk — re-run the
CBS pull first, or ask and I'll wire in a small fixture.)*

## Reading the result

- **`pull.mjs`** — non-zero `rows` with `ecr ✓` on the draft-rankings lines means
  access works. The key questions its output answers: is **dynasty** among them or
  gated? Are **tiers** present? Which **id fields** does each player carry (that's
  the join material)?
- **`match.mjs`** — a high match rate (say 90%+ of fantasy-relevant CBS players)
  means the join is tractable; the unmatched list is usually deep-bench players with
  no FantasyPros ranking, which is fine. A messy list (nicknames, suffixes, team
  mismatches) tells us exactly what the real ingestion matcher must handle.

## Safety notes

- **Read-only.** Every request is a GET. Nothing here can change any FantasyPros or
  CBS data.
- **Your API key is a secret.** It lives only in the local `.env` (git-ignored).
  Don't paste it into the repo, a commit, or a public place.
- The pulled data in `output/` is **git-ignored** — we don't commit third-party data
  during a spike.
- **License note:** the free/personal key is for personal, non-commercial use. That
  fits this single-user, local, not-shared tool. If Gart Dash is ever shared or sold,
  FantasyPros access must be re-examined (a commercial license) — see the findings doc.
