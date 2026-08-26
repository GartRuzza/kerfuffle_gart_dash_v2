# Decision Log — Gart Dash

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

### D-19 · 2026-08-26 · QB replacement = last ROSTERED QB (superflex depth), not last starter (refines D-13)

| | |
| --- | --- |
| **Status** | Active (refines [D-13](#d-13--2026-08-26--valuation-method-vorp-last-starter-replacement); does not change the VORP framework) |
| **Type** | Product / modelling (where the QB replacement floor sits) |
| **Decided by** | Product owner, 2026-08-26, on reviewing the built #20 values before merge |

**The question**
On the first built board (#20), **Josh Allen — Kerf overall #1 — valued only $130, below five running backs** (Gibbs $201, Bijan $194…), and **no other QB cleared $100**. The owner flagged this as wrong for a superflex league where elite QBs are scarce and the market pays top dollar. Diagnosis confirmed the cause: VORP measures value above a replacement floor, and D-13 set the QB floor at the **last starter = QB24** (12 teams × [1 QB + 1 SFLEX]). But projected QB scoring **falls off a cliff after ~QB30** (QB24≈269 pts, QB30≈198, QB34≈85), **25 QBs are already rostered**, and superflex forces every team to field two QB-capable slots *plus* carry backups — so the QB you can actually get for $1 sits well below QB24. The floor was set above the cliff, compressing every QB's value.

**What we decided**
Set the QB replacement floor at the **last *rostered* QB ≈ 2.5/team → QB30** (constant `QB_REPLACEMENT_PER_TEAM = 2.5` in `tools/engine/valuation.mjs`). RB/WR/TE stay on the last-starter formula (their depth is already captured by the FLEX split, and they have a long, genuinely replaceable tail). Because prices sum to the cap, lifting QBs pulls the inflated RB values down — the intended rebalance. The knob is tunable: 2.0 reverts to the textbook last-starter (QB24); higher values price QBs even more aggressively.

**Result (live `npm run engine`):** Josh Allen $130→**$151** (now co-top with Gibbs $152); Daniels $118, Jackson $117, Hurts $114 all clear $100; **6 QBs ≥ $100** (was 1). RBs ease (Gibbs $201→$152). Prices still sum to the cap; QB1 still overall #1. This is a modelling choice grounded in roster depth + the scoring cliff, **not** a fit to market prices — so Edge stays a genuine independent signal.

**Why**
"Replacement" should be *what you can actually get for the minimum bid*. In superflex that QB is deep — past the last starter and past the cliff — so elite QBs carry large, real value-over-replacement. The owner chose the **Balanced (QB30)** option (QB1≈RB1) over both the status quo (RBs dominate) and a QB-forward QB33 (elite QBs clearly on top).

**What we gave up**
The clean "one formula for every position" story — QB now uses a rostered-depth rule while RB/WR/TE use last-starter. And the textbook single-season VORP result (kept available via the 2.0 knob).

**What would make us reconsider**
The owner wanting QBs clearly *above* RBs (raise the constant toward QB33), or back to pure last-starter (2.0); or real auction results showing the QB30 floor mis-prices the position.

**Note — roster value is unchanged and behaves correctly.** The owner also asked whether **Roster Value** reflects an elite QB's week-to-week boost. It does — as a *marginal* number: the Raccoons already start two solid QBs (Shough 301, Mayfield 289 in the SFLEX slot), so adding Allen only upgrades their weaker QB slot (289→403 ≈ $84 to them), versus his $151 league-generic value to a QB-needy team. That gap is the roster-aware column working as designed (replace-your-starter, [D-17](#d-17--2026-08-26--valuation-build-20--the-four-params-d-13-left-open) #2), not a defect.

---

### D-18 · 2026-08-26 · "Market (Now)" = a rostered player's actual salary (refines D-17 #3)

| | |
| --- | --- |
| **Status** | Active (refines [D-17](#d-17--2026-08-26--valuation-build-20--the-four-params-d-13-left-open) #3; does not reverse it) |
| **Type** | Product (what the market column means) |
| **Decided by** | Product owner, 2026-08-26, on reviewing the built board before merge |

**The question**
On the first built board (#20), **Market (Now)** was a *price curve read by Kerf positional rank* for **every** player — "what the Nth-best player at this position costs." The owner caught the consequence: **Lamar Jackson, rostered at $201, displayed Market (Now) = $77** — because the model ranks him QB3 and the 3rd-priciest QB salary is $77. His own $201 (the top QB knot) was effectively shown against Josh Allen (Kerf QB1) instead. Worse, **Edge went green (+$9)** for a player who is in fact badly *overpaid* relative to our value ($86). The curve, read by rank, mislabels — and mis-signals Edge for — exactly the mispriced rostered players the product exists to flag. Is that intended?

**What we decided**
**Market (Now) now shows a rostered player's OWN current KERFUFFLE salary.** Free agents — who have no salary — still fall back to the rank-based curve ("what a player of this Kerf rank would cost"). Market (Auction) is unchanged (the pre-auction curve for everyone). Edge (= Kerf Value − Market Now) auto-follows, so Lamar now reads Market $201 / Edge −$115 (red, correctly overpaid).

**Why**
"Market (Now)" should mean *what this player costs right now*. For a rostered player that is an observable fact — his salary — not a rank-inferred estimate, and a board that contradicts a number the owner can see reads as broken. The curve is still the right tool where there is no salary to show (free agents) and for the auction reference. This makes Edge a truthful overpay/underpay-on-contract signal for the whole rostered league.

**What we gave up**
A single, uniform definition of the column (it is now "salary if rostered, else curve"). The apples-to-apples "everyone priced by the same curve" view — which survives, unchanged, as Market (Auction).

**What would make us reconsider**
The owner wanting one uniform curve-based market number after all, or wanting a *separate* actual-salary column so the curve estimate stays visible for rostered players too (the "show both" option, declined here for a less-cluttered board).

---

### D-17 · 2026-08-26 · Valuation build (#20) — the four params D-13 left open

| | |
| --- | --- |
| **Status** | Active (implements [D-13](#); does not reverse it) |
| **Type** | Product (how the dollars appear + a modelling knob) |
| **Decided by** | Product owner, 2026-08-26, in the pre-build Q&A for issue #20 |

**The question**
D-13 locked the valuation *method* (VORP, last-starter replacement, two ceilings, single-season). But four choices were left to the build: (1) the **sign of Edge**, (2) **how roster-aware value appears**, (3) **which market snapshot** the table shows, (4) **how many roster spots** owe a $1 minimum in the dollar conversion. The issue text itself flagged 2–4 as "decide/parameterize."

**What we decided**
1. **Edge = Kerf Value − Market (Now)** (a bargain is positive/green), **not** the issue's literal "market − ceiling." The existing table already computed it this way and the owner kept the intuitive UX.
2. **Roster Value is its own column** (replace-your-starter, Raccoons-specific), sitting beside the league-generic **Kerf Value** — not folded into one number. The owner's **Ceiling** stays *his* editable value (seeded from Kerf Value), **session-only** — so no `owner_ceiling_override` table this issue (that's the auction-prep lens).
3. **Both market snapshots shown**, as two columns: **Market (Now)** from current roster salaries and **Market (Auction)** from the 2025 salaries.
4. **19 roster spots per team** owe a $1 minimum (10 starters + 9 bench; IR excluded — an in-season designation, not an auction buy). A tunable constant; the choice moves the dollar scale ~2%.

**Why**
Each is the owner's call on presentation or a low-stakes knob, not a change to the method. The Edge sign is the only genuine conflict with the written issue; green-means-bargain matches how the owner reads the board and the vision's "the gap is the game." Two ceiling columns keep both the auction-generic and roster-specific numbers visible (vision principle 2). Two market columns serve the now-in-season use *and* the auction reference. 19 spots is the natural active-roster size.

**What we gave up**
The literal issue wording for Edge (documented here so a future agent doesn't "correct" the sign back). A single, less-cluttered market column. A persisted ceiling (deferred to roadmap #10, deliberately).

**What would make us reconsider**
The owner wanting Edge flipped, one market column, or ceilings persisted before the auction-prep lens; or evidence that the roster-size assumption materially distorts prices (it shouldn't at ~2%).

---

### D-16 · 2026-08-26 · First-down estimation is player-specific for RECEIVING only; rushing uses the position average

| | |
| --- | --- |
| **Status** | Active (refines the player-specific-first-downs choice made mid-#18) |
| **Type** | Technical (model methodology), with product sign-off |
| **Decided by** | Product owner, 2026-08-26, on the #19 backtest evidence |

**The question**
The projection core (#18) estimated each player's first downs from his OWN shrunk conversion rate for **both** rushing and receiving. The backtest (#19) asked: is that per-player rate actually predictive? Should both components stay player-specific?

**What we decided**
Keep the **receiving** first-down rate player-specific (empirical-Bayes shrunk, `recK=40`); make the **rushing** first down estimate use the **position average** for everyone (no per-player rushing rate). Implemented as `FD_POLICY = { rushPlayerSpecific: false, recPlayerSpecific: true }` in `tools/engine/run.mjs`, shared with the backtest so both score the same model.

**Why**
The #19 out-of-sample probe (`tools/backtest/ppfd-probe.mjs`) measured whether a player's first-down conversion rate repeats year to year: **rushing FD/carry ρ(2024→2025) = 0.14** (near noise), **receiving FD/reception ρ = 0.52** (a real, repeatable skill). Estimating rushing first downs per-player therefore mostly added noise — in 2025 it nudged the wrong players (2024's high rush-FD backs regressed), slightly *increasing* error vs consensus. Falling back to the position rate for rushing removes that noise; keeping receiving player-specific preserves the one FD signal that persists. The re-gate confirmed **do-no-harm**: overall ρ unchanged (2025 Kerf 0.78 vs ECR 0.77; 2024 +0.02). First downs are still fully scored — this only changes whether the *rushing* rate is personalized. Supersedes the "both components per-player" implementation detail of [D-14](#).

**What we gave up**
Crediting a genuinely elite short-yardage back (e.g. a true goal-line hammer) for a rushing-FD rate above his position — the evidence says that rate doesn't carry to next season reliably enough to trust, so we accept treating rushing FD as a position-level constant. Reconsiderable per below.

**What would make us reconsider**
More seasons showing rushing FD/carry *does* persist (ρ rising well above ~0.3 on a larger sample); a better rushing-FD model (e.g. usage/role- or goal-line-adjusted) that beats the position constant in the backtest; or the league adding scoring that makes rushing first downs materially more valuable.

---

### D-15 · 2026-08-26 · TRUFFLE auction data retained as inert reference only (non-goal qualified)

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Product (qualifies a vision non-goal) |
| **Decided by** | Product owner, 2026-08-26 |

**The question**
The owner obtained TRUFFLE's completed 2026 auction (69 players, with full bid-by-bid histories and CBS ids) and floated using it as a secondary signal for the price curve. But [`pm/product_vision.md`](pm/product_vision.md) has an explicit non-goal: "We will not touch TRUFFLE. KERFUFFLE data only… extra sample size is not worth the data plumbing." Do we use it?

**What we decided**
**No active use — retain it as inert reference data only.** The owner's rule: use TRUFFLE only *if* it contained **all** rostered players; it is **auction-pool only (69)**, so it is stored (ingested into `auction_result` with `league='TRUFFLE'`, `is_reference=true`) and **read by no consumer** — not the price curve, not the engine. It exists solely for possible future bidding-dynamics work (parked in [`feature_backlog.md`](feature_backlog.md)). The vision non-goal therefore still holds in practice: **KERFUFFLE data only feeds any value**.

**Why**
The bid histories are genuinely valuable and the extraction is already done, so discarding the file outright would be wasteful; but blending a *different league's, partial* auction into KERFUFFLE prices is exactly the plumbing/quality risk the non-goal guards against. Store-but-don't-use keeps the option open without contaminating any number.

**What we gave up**
A secondary price signal (the once-floated 30% TRUFFLE / 70% KERFUFFLE blend). Recoverable later if TRUFFLE full-roster data is obtained and the owner explicitly reverses this.

**What would make us reconsider**
Obtaining TRUFFLE's *complete* rosters/contracts (not just the auction pool) **and** an explicit owner decision to use them; or a dedicated "bidding-dynamics" feature that deliberately opts in.

---

### D-14 · 2026-08-26 · First downs (and backtest truth) come from CBS league data, not nflfastR

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Both (data sourcing + engine input) |
| **Decided by** | Product owner + Claude Code, 2026-08-26 |

**The question**
KERFUFFLE scores 1 pt per rushing/receiving first down, but FantasyPros' projection feed has **no first-down field**. Where do the first-down estimates (and the backtest's actual-points ground truth) come from — our own league (CBS) or an external source (nflfastR/nflverse)?

**What we decided**
**From CBS — our own league's recorded stats.** CBS tracks `RuFD`/`ReFD` as scored categories, so per-player historical first downs exist. The owner exported **2024 & 2025 CBS stats** in two paired files per season — "Advanced Categories" (passing/rushing/receiving **first downs**, 2pt, FPTS total) and "Standard Categories" (att/cmp/yds/td, targets/rec/yds/td, fumbles) — which **join per player + season**. These give: (a) first-down **rates** to apply to FantasyPros projected volume, (b) a **scoring-engine cross-check** (recompute points from components, compare to CBS FPTS), and (c) the backtest's **actual KERFUFFLE points**. The prediction side of the backtest (historical FantasyPros ECR + projections for 2024/2025) was **confirmed accessible** via the API's season parameter. These historical files are ingested by issue **#17**. **nflfastR is not used** (kept only as a latent fallback).

**Why**
Least error and highest trust: the projection is measured against, and calibrated from, the exact scoring reality it's trying to predict — no external stat provider to reconcile, no join risk. It also satisfies the owner's stated preference for league data as source of truth, and it unblocked the backtest end to end.

**What we gave up**
nflfastR's per-play granularity and its ready-made league-wide first-down rates. Accepted: the CBS season totals are sufficient for position-level rates, and staying in-league avoids a second stat universe to match.

**What would make us reconsider**
CBS stat exports becoming unavailable or too coarse for stable rates (then nflfastR for the volume/first-down denominator), or a need for play-level features CBS totals can't provide.

---

### D-13 · 2026-08-26 · Valuation engine methodology: VORP, last-starter replacement, single-season, two ceilings

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Product (the core valuation method) |
| **Decided by** | Product owner (strategy) + Claude Code (research), 2026-08-26 |

**The question**
How does the engine turn projections into the "worth" number — and how is positional/superflex value handled — for a 12-team, superflex, $500-cap, PPFD dynasty auction?

**What we decided**
- **Framework: VORP** — value = projected KERFUFFLE points **above positional replacement**, converted to cap dollars against the $500 budget (not naive points-per-dollar). The worsening $/point at the top is the scarcity premium, not a red flag.
- **Replacement level: the "last-starter" method** — baseline = the number of players *actually started* league-wide at each position. For our lineup: **QB24, RB~34, WR~34, TE~17, DST12** (superflex → the SFLEX slot counts as a 2nd QB, which is what makes elite QBs correctly premium — the same error class as [D-12](#)). FLEX split proportionally (RB/WR/TE 40/40/20); baselines are documented, tunable constants.
- **Dollars: marginal $/point** — ($500 × 12 − $1 minimums) ÷ total points-above-replacement; price = $1 + PAR × $/point; prices sum to the cap.
- **Two ceilings, both built:** league-generic (auction default) and roster-aware/Raccoons-specific (trades + custom lens).
- **Value horizon = single season** (win-now). Dynasty ECR + contract length stay as separate context, **never blended** into the dollar value (reaffirms [`product_vision.md`](pm/product_vision.md) principle 5 now that real dollars are at stake).
- **Edge = market price − ceiling** (the whole game).
- **Build is staged in two** with the **backtest as the gate between** them (issues #18 → #19 → #20): prove the re-rank beats ECR before paying for the dollar machinery.

**Why**
VORP with a last-starter baseline is the transparent, deterministic standard for auction pricing and directly encodes our lineup rules; it's the method that reproduces "replacement QB ≈ QB24" in superflex, which is the single most consequential number for this league. A comprehensive research brief (recorded in [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md)) backed each choice and flagged the conventions vs. settled points. Single-season value keeps the number drillable and leaves the multi-year judgment human, per the vision.

**What we gave up**
A deeper "man-games" replacement baseline (more realistic, less transparent — deferred to a possible v2) and a contract/age-adjusted dollar value (rejected: it would blend dynasty into the primary number the vision deliberately keeps single-season). Both reconsiderable if the owner wants them.

**What would make us reconsider**
The backtest (#19) failing to show an edge (→ fix the projection core before pricing); the league changing its lineup away from superflex; or the owner deciding the auction wants a contract-aware value after using the single-season one.

---

### D-12 · 2026-08-26 · The table's market board is SUPERFLEX (draft, standard scoring)

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Product (which market signal the owner reads against) |
| **Decided by** | Product owner, 2026-08-26 — correcting the choice made 2026-08-25 |

**The question**
Which FantasyPros consensus board should the table's ranking columns (Ovr ECR, Pos ECR, Dyn Ovr, Dyn Pos) display? The initial build shipped **draft / standard / ALL**, a **1-QB** board. KERFUFFLE starts two quarterbacks.

**What we decided**
Display **`draft` + `STD` + `OP`** — standard scoring, **superflex** (FantasyPros exposes superflex as `position=OP`, "offensive player"), and **`dynasty` + `OP`** for the dynasty columns. **Team defenses**, absent from superflex boards, keep their **positional** rank and tier from the 1-QB board and get **no overall rank** (owner, same day).

**Why**
A 1-QB board misprices the single most expensive position in a superflex league. Measured on the live board: the first five QBs rank **23/27/35/43/50** on the 1-QB board versus **1/2/3/4/5** on superflex; the 1-QB top twelve contains **no quarterbacks at all**. Reading that next to a $500 cap would have systematically undervalued QBs going into the auction. Research also settled a worry: `draft/STD/OP` is a genuinely distinct board (475 of 521 shared players rank differently from the PPR superflex board), so the owner's preference for standard scoring *and* superflex is satisfiable at once — no trade-off was needed. Dynasty is scoring-agnostic on FantasyPros (one board per position scope), so "standard dynasty" isn't a thing to give up.

**What we gave up**
The superflex boards cover offensive players only, so **defenses lose their overall rank**. We rejected borrowing their overall rank from the 1-QB board: the two boards have different scales, and a defense ranked ~250th there would float into mid-pack among superflex players, making defenses look more valuable than they are. Positional rank (DST1, DST2…) is preserved, blank overall sorts them to the bottom, and rostered-player coverage is unchanged at 162/170. We also give up the 1-QB view of the board — recoverable at any time, since **every board is still ingested at full grain**; changing the display is a view migration, not a re-fetch.

**What would make us reconsider**
The league changing its starting lineup away from superflex; FantasyPros publishing a first-down-scored or defense-inclusive superflex board (either would be a closer fit); or the owner wanting both boards visible side by side rather than one.

---

### D-11 · 2026-08-25 · Dead cap is a team-level amount; Practice Squad is a status

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Both (schema + how the league's rules are modelled) |
| **Decided by** | Product owner, 2026-08-25, on issue #11's evidence — closing roadmap open decision #7 |

**The question**
How are **dead-cap pseudo-rows** (commissioner-added cap hits for previously dropped players) and **Practice-Squad players** represented in the storage schema? This was the one open decision blocking issue #12's schema (D-10 approved the storage *shape* but explicitly not this).

**What we decided**
- **Practice Squad = a `roster_status` value** (`Active` / `Reserves` / `Injured` / `Practice`) on an ordinary roster/contract row. PS players are normal players with normal salaries and contracts — they count against the $500 cap but not roster-size limits — so they get no special table, just their status.
- **Dead cap = a row in the same `contract` snapshot table with NO player attached** (`row_type = 'dead_cap'`, null `cbs_player_id`, the page's label text kept verbatim). The owner's framing: what matters is that **the amount exists for the team**, not which player it once was. Team cap sums are then a simple addition over one table.
- Ingestion **refuses to classify silently**: a roster row with no player id *and* no salary is a loud failure, not a guess.

**Why**
Issue #11's evidence: a PS player is an ordinary player row in a `Practice` section (10 exist), and a dead-cap row is detectable as "salary but no player link" (0 exist pre-auction — the detection rule is confirmed, no live example yet). Both facts point at the simplest modelling: one roster-observation table, a status column, and a nullable player id.

**What we gave up**
A separate dead-cap table (cleaner separation, but structure we have no live example to justify) and synthetic "pseudo-player" records (would pollute the real player identity table and the CBS↔FantasyPros join). Also the ability to trace a dead-cap hit back to the specific dropped player — deliberately declined by the owner as not needed.

**What would make us reconsider**
The first real dead-cap rows appearing after the auction and not fitting this shape (e.g. CBS renders them with a player link after all, or per-player dead-cap tracking becomes a real need for the drop/dead-cap tool in the backlog). The `label` text is preserved verbatim precisely so a richer model could be back-filled from it.

---

### D-10 · 2026-08-24 · Three-layer storage: raw file archive → SQLite (normalized + derived)

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Both |
| **Decided by** | Product owner, in PM conversation 2026-08-24 |

**The question:** Where does API/scraped data live locally — flat CSV/JSON files, or a real database — and how do we keep history without blocking the eventual web deploy?

**What we decided:** Three layers. (1) **Raw:** every fetched response saved verbatim (CBS HTML as HTML, FP JSON as JSON) in timestamped, dated folders — append-only, never edited, gitignored. (2) **Normalized** and (3) **derived** layers in **SQLite via `better-sqlite3`**, one DB file. All reads/writes go through a **single data-access module** that returns the flat `Player` shape the UI already consumes (the existing `lib/mockData.ts` boundary).

**Why:** The data is relational (player → contract → team, transactions across seasons) and the price curve + backtest need point-in-time history — CSV forces hand-joins in TypeScript and versioned-file sprawl. SQLite is one file, zero setup, real SQL. The raw layer exists because (a) a wrong parser is fixed by re-parsing the archive, never by re-fetching, and (b) two unsolved problems — historical CBS season retrieval and FAB bid amounts — mean today's data is tomorrow's only history. The single-module boundary preserves the `architecture.md` "keep it deployable" constraint: a writable SQLite file doesn't survive serverless, so a later swap to Turso/Postgres touches one module.

**What we gave up:** CSV's eyeball-it-in-Excel convenience (recoverable via an export command) and the absolute simplicity of flat JSON snapshots, which would genuinely suffice for a UI-only tool but can't serve historical queries.

**What would make us reconsider:** Deploying to Vercel (forces the store swap the module boundary anticipates), or the backtest/price-curve needs growing past single-file comfort.

---

### D-09 · 2026-08-20 · FantasyPros data via the official API (HOF tier); join to CBS on `cbs_player_id`

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical + Product (data sourcing + a recurring cost) |
| **Decided by** | Claude Code (spike #7) + owner (chose the API path, approved the HOF upgrade) |

**The question**
How do we get FantasyPros expert-consensus rankings/tiers — the roadmap listed three candidates: the API (thought to be approval-gated), scraping, or manual export (roadmap open decision #2) — and how do we match FantasyPros players to CBS players (the roadmap's "expected ugliest part")?

**What we decided**
Ingest FantasyPros data through its **official JSON REST API** (`https://api.fantasypros.com/public/v2/json`, `x-api-key` header), on the paid **HOF tier (~$9/mo)**, and **join to CBS on the `cbs_player_id`** that FantasyPros publishes on every player. Not scraping (prohibited by their terms), not manual export (unnecessary).

**Why**
Proven empirically in the spike: the API is now self-serve (not approval-gated as the roadmap assumed), authenticates with a simple key, and returns exactly what the engine needs — `rank_ecr`, `pos_rank`, `tier`, and the expert spread — across redraft/dynasty and all scoring formats. The feared player-matching problem evaporated: FantasyPros hands back a `cbs_player_id` that equals CBS's own id (confirmed against real CBS ids — Chase, Nacua, McCaffrey), so the join is a direct id map, not fuzzy name matching. The free tier is a top-10-of-520 preview (`public_api_limited: true`), so the full board requires HOF — a small, sanctioned, license-clean recurring cost that fits a single-user, non-commercial, local tool.

**What we gave up**
A zero-cost path. The free tier can't feed production (10 of 520 players), so the product now depends on a ~$108/yr subscription. We also accept a single-vendor dependency for ECR/tiers (mitigated: the `cbs_player_id` join and cached pulls make swapping providers a contained change if ever needed). And we took the HOF unlock partly on faith — at decision time the upgrade hadn't propagated to the key (still reported `tier: free`); the full-list + projections/metadata/ADP/news unlock must be confirmed on a re-run before the engine build.

**What would make us reconsider**
HOF failing to lift the cap or open the gated endpoints (regenerate the key, then escalate); FantasyPros changing its API terms to bar our personal-use case; the tool ever being shared/sold (would require a commercial license); or the subscription cost no longer being worth it versus a cheaper/free ECR source (e.g. Fantasy Nerds) — the `cbs_player_id`-keyed, cached ingestion is deliberately swappable. Full evidence: [`fantasypros_data_discovery.md`](fantasypros_data_discovery.md).

---

### D-08 · 2026-08-20 · CBS data via authenticated HTML scraping; contract length comes from CBS

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical + Product (data sourcing) |
| **Decided by** | Claude Code (spike #5) + owner (confirmed the data) |

**The question**
How do we get real KERFUFFLE data out of CBS, and — the open one (roadmap decision #1) — where does player **contract length** come from?

**What we decided**
Ingest CBS data by **authenticated HTML fetch + parse**: send the owner's browser **session cookie** to the league's clean URLs (`/teams/roster-report/{teamId}/1`, `/players`, `/transactions`, `/rules`, `/draft/results`) and parse the server-rendered tables. And take **contract length from CBS itself** (the per-player "Contract" column), not from the Commissioner's sheet.

**Why**
Proven empirically in the spike: CBS's old v3 JSON API is dead (it returns HTML even with `response_format=json`/`access_token`), but the modern site renders every record we need into page HTML, gated only by the session cookie. Contract length turned out to be a first-class column on the roster pages (confirmed against the owner's real roster), which removes the need for a second data source for it.

**What we gave up**
The robustness of a real API. HTML parsing is sensitive to CBS layout changes, and the session cookie expires (needs periodic re-extraction). We accept this because it's the only thing that works, it's one league's rarely-changing pages, and read-only scraping of one's own league is low-risk. We also did **not** solve two things here: fetching a specific **past season** (needed for the backtest) and reading **FAB bid amounts** (needed for the price curve) — both deferred to focused follow-ups.

**What would make us reconsider**
CBS shipping a usable API again (switch to it), CBS blocking or materially changing the pages (revisit the parser or the whole approach), or contract length disappearing from the roster view (fall back to the Commissioner's-sheet import from roadmap decision #1). Full evidence: [`cbs_data_discovery.md`](cbs_data_discovery.md).

---

### D-07 · 2026-08-20 · Roster filtering: 3-way status toggle + Manager dropdown

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Product (UX) |
| **Decided by** | Owner |

**The question**
How should the owner filter the table by who holds a player — and, crucially, how do you express "free agents only" (which the Auction and Waiver lenses need)?

**What we decided**
Two orthogonal controls: a **3-way roster-status toggle** — **All / Rostered / Free Agents** — beside a **Manager dropdown** (All / a specific team). The combined rule (in the `owner` column's `filterFn`, `components/columns.tsx`): if the toggle is **Free Agents**, show only FAs (Manager ignored, dropdown disabled); else if a **specific Manager** is chosen, show that team; else **Rostered** = all rostered minus FAs, **All** = everyone including FAs. This replaced an earlier "Free Agents in the dropdown + an include-FA checkbox" model.

**Why**
The dropdown-plus-checkbox model couldn't cleanly express "free agents only." Splitting *roster status* (the toggle) from *which manager* (the dropdown) makes every combination meaningful and reads at a glance. The default views rely on it (Auction/Waivers → Free Agents; Trades → Rostered; Start/Sit → a Manager).

**What we gave up**
A tiny redundancy: with a specific Manager selected, "All" vs "Rostered" makes no difference (a team has no FAs). Accepted — it keeps the two controls independent and predictable.

**What would make us reconsider**
A real need to view "a team plus the free-agent pool" together, or added positions (K/DST) that change what "rostered" means.

---

### D-06 · 2026-08-20 · Tier bands as a sort-driven, field-specific overlay

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Product (UX), load-bearing |
| **Decided by** | Owner |

**The question**
How do tiers appear in the table, and how do they interact with sorting and the position filter?

**What we decided**
Tiers are **not a column** — they render as **FantasyPros-style band rows** between tier groups, and the behavior is a small state machine centralized in **`lib/tierRules.ts`** (unit-tested):
- Bands show **only** when the active sort is one of six rank columns; the band set is **specific to the sort field** (Kerf / ECR / Dynasty × overall / positional).
- **Overall-rank** sort → overall tiers (position filter just narrows rows). **Positional-rank** sort needs a single position: triggering it on a multi-position (All/SuperFlex/Flex) **auto-switches the position to QB**; switching *to* a multi-position while positionally sorted **clears the sort** (back to the default overall order, no bands).
- Default/load: active Kerf-Ovr-Rank sort → overall Kerf tiers on.
- For contiguity, every rank column sorts by a **unique derived rank** (the two overall-ECR columns use `ovrEcrRank`/`dynOvrRank`, not the raw ECR which has ties).

**Why**
It matches the owner's mental model (a tiered board you re-tier by choosing a ranking) and vision principle 4 (tiers, not decimal ranks). Centralizing the rules keeps intricate, coupled behavior testable and in one place.

**What we gave up**
Simplicity: this is the most intricate UI logic in the app, and tiers are (for now) **mock** bucketings by rank — real tiers come from the engine (Kerf) and FantasyPros (ECR). "Ovr ECR" also now shows a contiguous overall rank rather than the raw consensus number (revisit at ingestion if the raw ECR is wanted).

**What would make us reconsider**
Real tier data arriving with its own grouping semantics, or the owner wanting tiers visible regardless of sort. Any change goes in `lib/tierRules.ts`, never scattered into components.

---

### D-05 · 2026-08-20 · Saved views persisted in localStorage; @dnd-kit for column reorder

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical (product-approved) |
| **Decided by** | Owner (persistence mechanism, drag approach) |

**The question**
How should the table remember user-created "views" (column choices, order, sort, filters) between sessions, and how should columns be reordered?

**What we decided**
Persist **custom views in the browser's localStorage** (`lib/views.ts`), keyed `gartdash.customViews.v1`; built-in default views stay in code. Reorder columns by **dragging headers**, using **@dnd-kit** bound to TanStack's `columnOrder`.

**Why**
localStorage fits the local-first, single-user, no-backend prototype: views survive reloads with zero infrastructure. @dnd-kit is the standard, well-maintained, accessible drag toolkit and integrates cleanly with TanStack column ordering; the owner explicitly chose real drag over a lighter reorder UI.

**What we gave up**
localStorage is **per-browser and not synced** across machines, and it's the first persisted client state (a small step up in complexity). @dnd-kit adds a dependency. Both accepted for the UX; real cross-device sync waits for a backend (deployment era).

**What would make us reconsider**
Web deployment with multiple devices, or a login — then views (and other state) move to a real per-user store behind the API, and localStorage becomes a cache at most.

---

### D-04 · 2026-08-20 · Vitest for unit testing

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Technical |
| **Decided by** | Claude Code + owner request for strong validations |

**The question**
How do we validate the app's growing pure logic (mock-data derivation, the tier/sort/position state machine) beyond build + eyeballing?

**What we decided**
Add **Vitest** as the test runner (`npm test`), with unit tests co-located in `lib/*.test.ts`. Tests cover the pure logic only; UI interaction checks stay manual for now.

**Why**
The owner asked for a strong validation gate at each component. The tier state machine and derived ranks/tiers are exactly the kind of tricky pure logic that benefits from fast unit tests. Vitest is TS-native, near-zero-config with our stack, and reusable as the app grows.

**What we gave up**
A new dev dependency and the small upkeep of tests. Accepted — it directly serves correctness and the owner's request.

**What would make us reconsider**
Nothing likely. If we later add component/E2E testing we'd extend (Testing Library / Playwright), not replace, Vitest.

---

### D-03 · 2026-08-20 · Dark theme (Gamecast-style), dark-only for now

| | |
| --- | --- |
| **Status** | Active |
| **Type** | Both (product look + technical) |
| **Decided by** | Owner |

**The question**
What visual direction should the table take — and light, dark, or both?

**What we decided**
A **dark, Gamecast-style** theme with a teal/cyan accent and compact rows, **dark-only** for now (no light/dark toggle yet). Expressed entirely through the design tokens (D-02).

**Why**
The owner's primary reference (Gamecast) is dark; dark-only avoids ~1.5–2× the styling/testing work of maintaining both themes for a single-user local prototype. The token layer keeps a future light theme cheap.

**What we gave up**
A light mode (and the FantasyPros-style light look). Recoverable later: because colors are tokens, adding a light theme is a config/variant change, not a rewrite.

**What would make us reconsider**
The owner wanting to present/use the tool somewhere a light theme reads better, or accessibility needs. Then we add a light token set + a toggle.

---

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
