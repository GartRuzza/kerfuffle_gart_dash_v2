# FantasyPros Data Discovery — findings report

> **Owner:** Claude Code · **Status:** Spike complete (GitHub issue #7, roadmap #3) · **Date:** 2026-08-20
> **What this is:** the result of the timeboxed FantasyPros spike — whether we can pull expert-consensus rankings/tiers, how, at what cost, and — the headline — whether we can line those players up with our CBS data. This is a **reality** doc: it separates what was *proven* against the live API from what we *expect* (and still need to confirm) after the paid-tier upgrade.
> **Verdict up front: GO.** The official FantasyPros JSON API returns exactly the data the engine needs (ECR, positional rank, tiers, spread, redraft + dynasty, all scoring formats), and — critically — it publishes a **`cbs_player_id`** on every player, so the CBS↔FantasyPros join is a **direct id match**, not the fuzzy-matching problem the roadmap feared. The only cost is the **HOF tier (~$9/mo)** to lift the free tier's 10-player preview cap and unlock projections/metadata/ADP/news.

---

## 1. Headline answers

| Question the spike had to answer | Answer |
| --- | --- |
| Is there an official API, and can we access it? | **Yes.** FantasyPros has an official JSON REST API. A **free, self-serve API key** authenticates immediately (`x-api-key` header). Proven with 200s across all ranking endpoints. |
| Does it give ECR, positional rank, tiers, and spread-of-opinion? | **Yes, all of it.** Every ranking row carries `rank_ecr`, `pos_rank` ("WR1"), `tier`, and the spread (`rank_min/max/ave/std`), aggregated across **99 experts**. |
| Redraft **and** dynasty? Which scoring formats? | **Both**, plus rest-of-season and weekly; **PPR, half-PPR, and standard**; and by position including **superflex** (OP). Dynasty is **not** paywalled — the data is there on the free tier, just capped in volume. |
| **Can we match FantasyPros players to CBS? (the "ugliest part")** | **Solved — directly.** FantasyPros publishes a **`cbs_player_id`** on every player. It matches CBS's own player id exactly. → the join is an id equality, no name-guessing. |
| **What does it cost?** | The **free** tier is a **top-10-of-520 preview** (self-flagged `"public_api_limited": true`, `"tier": "free"`), and blocks projections/metadata/ADP/news (`403`). Real use needs the **HOF tier (~$9/mo, ~$108/yr)** — the tier that includes API keys (MVP does not). |

## 2. How access works

- **Base URL:** `https://api.fantasypros.com/public/v2/json` · **Auth:** an API key sent as the `x-api-key` header. No OAuth, no cookie, no login automation.
- **Get a key:** self-serve at `secure.fantasypros.com/api-keys/request/`. A **free** key works for prototyping; a **personal production** key comes with an active **HOF** subscription.
- **Rankings endpoint:** `GET /nfl/{season}/consensus-rankings` with query params `type` (`draft` / `dynasty` / `ros` / `weekly`), `scoring` (`STD` / `HALF` / `PPR`), `position` (`ALL` / `QB` / `RB` / `WR` / `TE` / `OP` superflex / `FLEX`), and `week` for weekly. Confirmed working.
- **Response is clean JSON:** a metadata envelope (`count`, `total_experts`, `last_updated`, `limit`, `public_api_limited`, `tier`) wrapping a `players[]` array.
- **License:** the free/personal key is a **personal, non-commercial** license. That fits Gart Dash exactly — single-user, local, not shared, not sold. (A commercial license would only be needed if the tool is ever shared or sold — a vision non-goal. **Scraping is prohibited by their terms and is not used.**)

## 3. What we can pull (data inventory)

**Per-player fields on each ranking row** (proven against live responses):

| Field | Example | Use in Gart Dash |
| --- | --- | --- |
| `rank_ecr` | `1` | Expert Consensus Rank — the "Ovr ECR" column and the baseline the engine must beat |
| `pos_rank` | `"WR1"` | Positional ECR — the "Pos ECR" column |
| `tier` | `1` | The **FantasyPros-style tier bands** the table already renders (currently mock) |
| `rank_min` / `rank_max` / `rank_ave` / `rank_std` | `1 / 6 / 1.51 / 0.98` | Spread-of-opinion — drillable "how sure are the experts" detail (vision principle 3) |
| `cbs_player_id` | `"2966320"` | **The join key to CBS.** Direct id match. |
| `player_name`, `player_team_id`, `player_position_id` | `"Ja'Marr Chase"`, `"CIN"`, `"WR"` | Display + a fallback/sanity check on the id join |
| `player_id`, `sportsdata_id`, `player_yahoo_id` | `19788`, `fa99e984…`, `"33393"` | FantasyPros' own id + other cross-refs (not needed given `cbs_player_id`) |
| `player_bye_week`, `player_owned_avg/espn/yahoo` | `6`, `99.6` | Bye week + rostered-% context |

**Ranking variants confirmed reachable** (each returns the same row shape): draft (PPR/half/std), dynasty (PPR), ROS (PPR), weekly (PPR), and positional cuts (QB/RB/superflex). **Full universe size:** `count: 520` players in the PPR draft ranking, from `total_experts: 99`.

**Endpoints beyond rankings** — probed, and gated behind the paid tier (returned `403` on the free key): `GET /nfl/{season}/projections`, `GET /nfl/players` (player metadata), `GET /nfl/{season}/adp` (ADP), `GET /nfl/news`. Expected to open on HOF (see §4).

## 4. Barriers, risks, and what's still unsolved

| Risk / gap | Impact | Mitigation / follow-up |
| --- | --- | --- |
| **Free tier is a 10-of-520 preview** (`public_api_limited: true`). | Unusable for production — we need the whole board. | Upgrade to **HOF (~$9/mo)**. Owner upgraded 2026-08-20. |
| **HOF unlock not yet empirically confirmed.** | We are *assuming* HOF lifts the cap to 520 and opens projections/metadata/ADP/news. At write-time the key still reported `"tier": "free"` (upgrade hadn't propagated, or the free "development" key needs regenerating as a **production** key). | **Confirm before the engine build (roadmap #4):** re-run `pull.mjs`; expect ~520 rows and `public_api_limited: false`, and the four `403` endpoints returning data. If still capped, regenerate the key from the api-keys page. Research strongly indicates HOF grants full read access. |
| **Rate limiting.** A burst of ~15 calls drew `429 Too Many Requests` on the free tier. | Naive ingestion could get throttled. | Ingestion must **pull-and-cache and refresh periodically**, not hammer per page view. `pull.mjs` now spaces requests. |
| **ADP endpoint path unconfirmed.** `/nfl/{season}/adp` returned `403` (gated) on free — path not yet validated on a paid key. | ADP (a "market" signal) not yet proven reachable. | Confirm the exact ADP endpoint/params on the HOF re-run; ADP is nice-to-have, not blocking. |
| **Weekly rankings carry no `tier`.** | Expected — weekly is a different product; tiers are a draft/dynasty concept. | No action; use draft/dynasty tiers. |
| **The API key is a credential.** | If leaked, someone could use the owner's quota / account. | Never committed — lives only in a local git-ignored `.env`; pulled data is git-ignored too. This spike wrote **zero** to FantasyPros. |

## 5. Recommendation (go / no-go)

**GO**, on the **official API via the HOF tier**. This resolves roadmap **open product decision #2** (FantasyPros access method) → **the sanctioned API**, not scraping and not manual export. Recommended shape for the real build (roadmap #4 engine, #6 table on real data):

1. A small **server-side fetch module** (Next.js server route, per `architecture.md`) that reads the HOF key from an env var/secret and pulls the ranking variants the engine needs (draft + dynasty, the league's scoring format, overall + positional).
2. **Cache the pulls** (they change roughly daily — `last_updated` is exposed) and refresh on a schedule; respect the rate limit.
3. **Join to CBS on `cbs_player_id`** — a direct map onto the CBS numeric id the CBS spike established. Keep `player_name`+position as a sanity check, not the primary key.
4. Feed `rank_ecr` / `pos_rank` into the ECR columns and `tier` into the real tier bands (replacing the current mock tier dimensions); keep the spread (`rank_min/max/ave/std`) for the drill-down.
5. Before building, **confirm the HOF unlock** (§4) so the engine plans on the full 520-player board.

## 6. How this was proven (reproducible)

Throwaway, read-only tooling lives in [`spikes/fantasypros-api/`](../spikes/fantasypros-api/) (not part of the app, not deployed):

- `pull.mjs` — GETs the ranking/projection/metadata endpoints with the `x-api-key` header and reports, per endpoint, row counts and which fields (tier/ECR/ADP/cross-ref ids) are present.
- `match.mjs` — reads the **real CBS players** already saved by the CBS spike (`spikes/cbs-api/output/*.html`, 141 players with real CBS ids) and the FantasyPros players, and measures the join. Result on the free-tier top-10: **10/10 FP players carry a `cbs_player_id`**, and all overlapping players matched CBS exactly — **Ja'Marr Chase `2966320`, Puka Nacua `3121687`, Christian McCaffrey `2136743`** (FP name = CBS name in each case).
- `README.md` — how to get a key and run it.

The API key (`.env`) and all pulled data (`output/`) are **git-ignored** — the credential and third-party data never enter the repo.

---

**Related docs:** [`pm/roadmap.md`](pm/roadmap.md) (open decision #2 now resolved), [`decision_log.md`](decision_log.md) (D-09: access method + the `cbs_player_id` join), [`data_model.md`](data_model.md) (the ECR/tier entities and the join key these findings inform), [`pm/current_state.md`](pm/current_state.md) (status), [`cbs_data_discovery.md`](cbs_data_discovery.md) (the CBS side of the join — the `cbs_player_id` this matches).
