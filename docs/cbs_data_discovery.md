# CBS Data Discovery — findings report

> **Owner:** Claude Code · **Status:** Spike complete (GitHub issue #5) · **Date:** 2026-08-20
> **What this is:** the result of the timeboxed CBS API spike — what we can actually pull from the real KERFUFFLE league, how, and what it contains. This is a **reality** doc: it records what was proven against the live league, not what we hope is possible.
> **Verdict up front: GO.** Real league data — including player **contract length** — is reachable read-only with the owner's login. The old JSON API is dead; the working path is authenticated HTML fetch + parse.

---

## 1. Headline answers

| Question the spike had to answer | Answer |
| --- | --- |
| Can we authenticate against the real league? | **Yes** — with the owner's browser **session cookie**. No password automation needed. |
| Does the old CBS v3 JSON API still work? | **No.** It's retired. `…/fantasy/<method>/?response_format=json` now returns the web page (HTML), not JSON, even when authenticated. |
| How do we actually get data, then? | The modern league site **renders data directly into the page HTML** (tables). Fetch the clean league URLs with the cookie, parse the tables. |
| **Does CBS hold contract _length_, or only salary?** | **CBS holds both.** Every roster page has a dedicated **Contract** column (years remaining, 1–4) beside **Salary**. Confirmed against the owner's real roster. → **resolves roadmap open decision #1.** |
| How are players identified? | A stable **CBS numeric player ID** (e.g. Baker Mayfield = `2080032`), in every `…/players/playerpage/<id>` link. This is our join key for FantasyPros later. |
| How far back does history go? | The UI exposes **2024, 2025, 2026** (transactions + history). Three seasons appear available; the *programmatic* way to fetch a past season is **not yet solved** (see risks). |

## 2. How access works

- **Host:** `kerfuffle.football.cbssports.com` (the league's own subdomain — note the `.football.`).
- **Auth:** the logged-in **session cookie**, sent as the `Cookie` header. Unauthenticated requests `302`-redirect to `…/login`; authenticated requests return `200` with the data page. Login itself is a plain cbssports.com username/password.
- **No `access_token` is involved** in the data requests. (An `access_token` seen in the browser was an ad/tracking parameter, not part of league-data calls.)
- **Cookie lifetime:** the session expires (the captured token carried a ~30-day `auth_state`, but the practical session is shorter). `user_flows.md` already anticipates periodic **re-extraction from the browser** (~weekly) — that assumption holds.

## 3. What we can pull (data inventory)

All are **read-only HTML pages** on the league host, proven to return `200` with the cookie. "Data" = the page embeds the real records in HTML tables.

| Page (URL path) | What it gives | Salary | Contract | Notes |
| --- | --- | :--: | :--: | --- |
| `/teams` | The owner's roster (Raccoons) | ✅ | ✅ | 15 players; also proj pts, matchup, roster%/start%; cap totals + $500 validation. |
| `/teams/roster-report/{teamId}/1` | **Any team's** full roster | ✅ | ✅ | `teamId` = 1–12 → every team in the league. This is the workhorse for all rosters. |
| `/teams/roster-grid` | All rosters at a glance | — | — | ~179 player links (≈12 teams). Names/positions; lighter than roster-report. |
| `/players` | Free-agent / available player pool | (blank) | — | FAs have no salary until won. Paginated — needs paging to get the full pool. |
| `/transactions` | League transaction log | — | — | Filterable by **Year (2024/25/26)**, team, and type (Add/Drops, Trades, Trade Offers, Lineup). Columns: Date · Team · Players · action. |
| `/rules` | League settings incl. **scoring** | — | — | Confirms PPFD scoring (first down, receiving/passing yards, etc.); 14 settings tables. Source of the KERFUFFLE scoring config. |
| `/draft/results` | Draft / auction results | ✅ | — | Carries salary/auction values — raw material for the historical price curve. |
| `/standings/overall` | Standings | — | — | Records/points. |
| `/history` | League history | — | — | Spans 2024–2026. |
| `/scoring/live` | Live/loaded scoring | — | — | Large; per-player scoring. |

**Data format:** server-rendered HTML `<table>` rows, *not* JSON. Each player cell carries the CBS player id, name, NFL team, and position; roster tables add Salary, Contract, projections, 3-yr average, and matchup columns.

**Proof it's real:** the parsed Raccoons roster (Baker Mayfield $9/1yr, McCaffrey $102/1yr, Zachariah Branch $5/3yr, … Total Salary 248 ≤ 500) was confirmed correct by the owner.

## 4. Barriers, risks, and what's still unsolved

| Risk / gap | Impact | Mitigation / follow-up |
| --- | --- | --- |
| **No official API — we parse HTML.** | Layout changes on CBS could break parsing. | Keep the parser thin and centralized; write it defensively; it's one league's pages, which change rarely. |
| **Auth is a session cookie that expires.** | Data goes stale until re-extracted (~weekly). | Build the re-extraction step into the refresh flow (already in `user_flows.md`); show a clear "cookie expired" state, never a silent stale table. |
| **The old JSON API is dead.** | Any plan built on `response_format=json` / `access_token` fails. | Don't use it. Confirmed dead in this spike. |
| **Historical season fetch not solved.** | The backtest (roadmap #5) needs past seasons. | The year filter is JS/POST-driven; `?season=YYYY` does **not** work. Needs a focused follow-up to capture the real year-switch request (likely a form POST or a session setting). Data clearly exists (2024–26 in the UI). |
| **FAB winning-bid amounts not in the default transaction view.** | The waiver price curve (Phase 2) needs historical FAB $ wins. | Find the transaction view/filter that exposes bid amounts (or read the salary the player landed at). Follow-up during the waiver-lens build. |
| **Free-agent list is paginated.** | `/players` shows a page, not the whole pool. | Page through it (or find the "all" param) during ingestion. |
| **The cookie is a full account credential.** | If leaked, someone could act as the owner in CBS. | Never commit it. It lives only in a local git-ignored file. All pulled data is git-ignored too. This spike wrote **zero** to CBS. |

## 5. Recommendation (go / no-go)

**GO.** CBS ingestion is viable and the scariest unknown (contract length) came back positive. Recommended shape for the real build (roadmap #6, "table on real data"):

1. A small **server-side fetch+parse module** (Next.js server route, per `architecture.md`) that takes the session cookie from an env var/secret and returns typed objects.
2. Pull order: **rosters** (loop `roster-report` for teams 1–12), **free agents** (`/players`, paged), **rules/scoring** (`/rules`), **transactions** (`/transactions`), **draft/auction values** (`/draft/results`).
3. Normalize to a `Player`-like shape keyed by **CBS player id** (the FantasyPros join key — see the parallel FantasyPros spike, roadmap #3).
4. Defer, as scoped follow-ups: **historical-season retrieval** (for the backtest) and **FAB bid-amount extraction** (for the price curve).

## 6. How this was proven (reproducible)

Throwaway, read-only tooling lives in [`spikes/cbs-api/`](../spikes/cbs-api/) (not part of the app, not deployed):

- `pull.mjs` — GETs the data pages above with the cookie and reports the data signals in each.
- `analyze-har.mjs` — reads a browser HAR recording and finds the data-bearing responses.
- `README.md` — how to extract the cookie and run it.

The cookie (`.env`), the pulled HTML (`output/`), and any HAR are **git-ignored** — real league data and credentials never enter the repo.

---

## 7. Update — 2026-08-24 (planning, ahead of issues #10 / #11 / #12)

This spike proved **reachability**, not a field-level inventory. Recorded here so the ingestion work doesn't over-trust it:

- **Discovery depth so far is page-level only.** The signals in `pull.mjs` are word-count heuristics (does the page contain "salary", "contract", player links), not a column-by-column inventory. **Field-level profiling** — every column, its inferred type, one sanitized example, null/blank rate, with **no real league values committed** — is planned as **issue #11** (source profiling spike), which reads from the raw archive built in **issue #10**.
- **`/rules` scoring values were never extracted.** The spike confirmed 14 settings tables exist and that scoring is PPFD, but the actual KERFUFFLE scoring **values** were never parsed into structured form. Issue #11 extracts them. They must be **parsed from the page, never hardcoded** — the league changed scoring as recently as 2024 (Turnover on Downs).
- **Only 2 of 12 rosters were pulled** (teams 1–2). Issue #10 archives **all 12** roster reports; issue #11 profiles all 12.
- **Expect non-player rows in roster tables.** Per the [constitution](kerfuffle-fantasy-constitution.md): **dead cap** shows up as **inactive pseudo-players the commissioner manually adds to rosters**, and one 3rd-round rookie may sit on a **Practice Squad** (counts against the $500 cap, not active-roster limits). Roster parsing must **classify** these rows, not assume every row is a real player — locate columns by **header text, never by position**. How pseudo-rows and Practice-Squad players are modelled in the schema is an **open decision** ([`pm/roadmap.md`](pm/roadmap.md)) that issue #11's evidence resolves.
- **Scoring authority: CBS actuals are authoritative and are never recomputed.** CBS already applied KERFUFFLE settings (including first downs) to every real game; the engine must **never re-score actuals** — recomputing risks disagreeing with the official record. The parsed scoring config's only job downstream is translating FantasyPros **projections** into KERFUFFLE points. (Whether CBS's own **displayed projections** are themselves KERFUFFLE-scored — which would give the backtest a second baseline to beat — is a question issue #11 confirms.)

---

**Related docs:** [`pm/roadmap.md`](pm/roadmap.md) (open decision #1 now resolved), [`decision_log.md`](decision_log.md) (D-08: access method + contract-length source), [`data_model.md`](data_model.md) (planned entities informed by these findings), [`pm/current_state.md`](pm/current_state.md) (status), [`user_flows.md`](user_flows.md) (the refresh/re-extract step this validates).
