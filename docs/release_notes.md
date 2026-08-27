# Release Notes — Gart Dash

> **How to use this doc**
> **Owner:** Claude Code.
> **Update when:** Anything user-facing ships. One entry per release or merged PR.
> **This doc contains:** What changed, in plain English, **from the user's point of view**.
> **This doc never contains:** Refactors, dependency bumps, or internal work no user could notice — unless it changes something they can feel, like speed or reliability. Git already records those.
>
> **Append-only. Newest at the top.**
>
> **Write for the user, not the reviewer.** Not "added `POST /api/import` endpoint" — instead, "you can now import a bank statement." If you cannot write the line from the user's side, it probably does not belong in this doc.
>
> **Release notes vs. current state:** this is the *history* of changes; [`pm/current_state.md`](pm/current_state.md) is the *latest snapshot*. Update both — one tells you how you got here, the other tells you where you are.
>
> *The example entry is in italics and refers to a fictional product, "Ledgerly." Delete it once you have a real one.*

---

## Entry template — copy this block

## [YYYY-MM-DD] — [version or short title]

**New**
- [What a user can now do that they could not before.]

**Improved**
- [What got better, and what they will notice.]

**Fixed**
- [What was broken, described as the user experienced it.]

**Known issues**
- [What is still broken or missing, and the workaround if there is one. Say this out loud — a release note that hides a known problem costs more trust than the problem does.]

**Requires action from you**
- [Anything the owner must do: run a migration, set an environment variable, update a setting. Omit the section if there is nothing.]

---

## Releases

<!-- Newest entry goes directly below this line. -->

## 2026-08-27 — In-season rankings: the board is now your rest-of-season lens

**New**
- **The table is now a rest-of-season (ROS) ranking.** Now that the season is underway, every weekly data refresh re-scores the board on FantasyPros' *latest* full-season projection — which quietly bakes in injuries, role changes, and depth-chart moves. So the Kerf ranks, tiers, dollars, and Edge you already know now reflect **value from here on out**, and update each week. A player whose outlook has shifted moves on the board.
- **The market column now reflects rest-of-season, not the preseason draft board.** In-season, the "Ovr ECR / Pos ECR" columns show FantasyPros' **rest-of-season consensus** (it automatically falls back to the preseason draft board until the season's ROS board is published).
- **The banner tells you how fresh the rankings are.** It now reads, e.g., *"League data as of Aug 26 · **Rest-of-Season** ranks · updated Aug 26"* — so you can see both when the data was pulled and when the Kerf numbers were last computed.

**Known issues**
- **The dollar *amounts* run high as the season goes on.** Right now ROS value is based on the full-season projection, which still counts games already played — so the **ranking order is correct**, but the dollar figure overstates what's actually *left* to get from a player. Use the ranks/Edge for ordering now; a follow-up (true remaining value) will correct the magnitudes. Coming next.
- **The Rest-of-Season / Weekly toggle isn't visible yet.** In-season there's only the ROS lens to see today; the switch between rest-of-season and this-week (start/sit) rankings arrives with the weekly-rankings update.

**Requires action from you**
- To see updated rankings, run your weekly refresh: `npm run archive` → `npm run ingest` → `npm run engine`. (The engine step is what recomputes the Kerf/ROS numbers.)

## 2026-08-27 — Post-auction rosters now load

**Fixed**
- **Your finished auction now shows up in Gart Dash.** After the auction, refreshing the data (`npm run ingest`) was quietly throwing away the whole update, so none of the new manager assignments or salaries appeared. The cause: CBS lists a just-won player with a contract length of **"0"** (a real salary, but no contract term set yet), and the app had been built to accept only 1–4 years and to reject an entire snapshot on anything unexpected. Now a **"0" contract is accepted and shown as an unknown term ("—")** until you set it in CBS; everything else about that player — their manager and salary — loads normally. After the fix the app shows **all 241 rostered players** (up from 170), 40 of whom currently have an unassigned term.

**Known issues**
- Players you haven't yet given a contract length in CBS will show **"—"** in the Contract column. Assign the term in CBS and re-run `npm run archive` → `npm run ingest` and the real number appears. (Re-run `npm run engine` afterward to refresh the Kerf/dollar numbers off the new rosters.)

## 2026-08-26 — Valuation tune-up: real salaries in "Market (Now)", and elite QBs priced right

*(Refines the same-day dollars release below, after an owner review — before merge.)*

**Improved**
- **Elite quarterbacks are now valued as the premium assets they are in superflex.** Previously the model priced Josh Allen (our #1 overall player) at only $130 — below five running backs — because it compared every QB to the "last starter" (QB24). But you're forced to start two QBs and carry backups, and QB scoring falls off a cliff after about the 30th-best QB. So we now measure QBs against the **last rostered QB (~QB30)**. The result: **Josh Allen ~$151 (right alongside the top RBs), and six QBs now clear $100.** Running backs eased down accordingly; the prices still add up to the cap. (You can tune how aggressive this is if you ever want QBs clearly above RBs.)

**Fixed**
- **"Market (Now)" showed the wrong number for players you can see on a roster.** It was estimating a price from a curve, so Lamar Jackson — actually signed for $201 — displayed as **$77**, and his Edge even showed **green (a "bargain")** when he's in fact one of the most overpaid players in the league. Now **Market (Now) shows a rostered player's real salary** ($201 for Lamar), so **Edge correctly reads red −$84** for him and green for genuine bargains (e.g. Jayden Daniels, held at $40 but worth far more). Free agents — who have no salary — still show a curve-based estimate, and **Market (Auction)** is unchanged.

---

## 2026-08-26 — The dollars are here: what a player's worth, what he costs, and the gap

**New**
- **Kerf Value ($) — what a player is worth to a typical team.** The board now turns each player's projected KERFUFFLE points into a real auction dollar figure. It's a VORP model: your points *above the last starter your league actually fields* (QB24, RB34, WR34, TE17 — the "24" because superflex means ~24 QBs start), converted to dollars against the $500 cap so **all the prices add up to the cap**. The top running backs price around $200; the best players at each position command the most, replacement-level players about $1.
- **Roster Value ($) — what he's worth to *the Raccoons specifically*.** A second dollar column that values a player above *your own* worst startable player at his spot, not the league's. So a position you're thin at values a target **up**, and one you're stacked at (you roster two strong QBs) values him **down** — the number that actually matters for a trade or a roster-specific bid.
- **Two market prices.** **Market (Now)** is what a player of this position and rank costs on today's rosters; **Market (Auction)** is what he went for at the 2025 auction. Both are built from real KERFUFFLE salaries.
- **Edge.** Kerf Value minus Market (Now), in green (**+**, a bargain — we value him above what the market pays) or red (**−**). This is the gap the whole tool exists to find. Heads-up: elite QBs often show a **red** Edge — our model says the market *overpays* for top quarterbacks relative to their points-above-replacement. That's a real, defensible signal, and you can drill into exactly why.
- **The Ceiling box now starts filled** with the Kerf Value (rounded to a whole dollar). It's still yours to edit and override freely — the engine never overwrites your number.
- **Every dollar is explained.** The Data Dictionary (button at the bottom) now describes each money column in plain English — no more "Placeholder" tags.

**Improved**
- The **Auction Prep** and **Trades** views now include the new value and market columns by default.

**Known issues**
- **Team defenses show "—" for all the dollar columns.** We can't project a defense's scoring from the offensive data, so they aren't priced.
- **Ceilings still reset when you reload.** Saving them for auction day is the next piece of work (the auction-prep lens).
- **The valuation is single-season and prices running backs above quarterbacks.** That's how last-starter VORP works in a superflex league — treat it as a transparent starting point to sanity-check against your own read, not gospel. Dynasty value and contract length stay as separate context, never blended in.
- **The market price curve is coarse at the extremes** (it's built from ~12 salaries per position); a very deep player flattens to the cheapest observed salary.

**Requires action from you**
- After refreshing data, run **`npm run engine`** once (it now computes the dollars as well as the ranks) and reload the app. It prints the replacement baselines, the dollars-per-point, and a "prices sum to the cap ✔" check.

## 2026-08-26 — The table now has KERFUFFLE-adjusted ranks, tiers, and projections

**New**
- **Kerf Overall & Positional Ranks are real.** For the first time the board is ranked by *KERFUFFLE* value, not the standard market. It takes FantasyPros' projections, adds an estimate of each player's rushing and receiving **first downs** (the league's scoring edge, which no public projection includes) built from your own league's 2024+2025 history, and scores the whole thing with your league's settings. Because everyone lands in one pool, **quarterbacks correctly sit at the top** — Josh Allen ranks #1 overall.
- **First downs are estimated from each player's OWN history, not just his position.** A back who genuinely converts more first downs than a typical RB is now credited for it and ranks higher — that's the competitive edge. Players with little or no history (rookies) sensibly lean on the position average until they've built a track record. (Example: Kyren Williams, whose real first-down rate is ~21% above the RB average across 575 carries, gets his deserved bump.)
- **Kerf tiers.** Sorting by a Kerf rank now bands the board into tiers grouped at the natural drop-offs in projected points, tuned to look like the number of tiers you're used to on FantasyPros.
- **Free agents finally have a projection.** The Proj Points column is now filled for every projected offensive player — including free agents, which used to be blank.

**Improved**
- **Proj Points is now *our* number.** That column previously showed CBS's own projection for rostered players; it now shows our KERFUFFLE-scored projection for all offensive players, so it lines up with the Kerf ranks. (CBS's figure is still kept behind the scenes.)

**Known issues**
- **Dollar columns are still blank ("—").** Kerf Value, Market Value, and Edge — and the Ceiling seed — are the *next* step (turning these ranks into auction dollars), which we've deliberately held until a backtest confirms the ranking beats the market.
- **Team defenses show "—" for Kerf.** Their scoring can't be projected from the offensive data we have, so they keep only their market positional rank for now.

**Requires action from you**
- After refreshing data (`npm run ingest` then `npm run ingest:historical`), run **`npm run engine`** once to compute the Kerf numbers, then reload the app. The engine prints a quick sanity summary (top-10 overall + best-QB rank).

## 2026-08-26 — Rankings now reflect that KERFUFFLE is a superflex league

**Fixed**
- **The expert rankings were from a 1-quarterback board — the wrong one for your league.** Because KERFUFFLE starts two QBs, quarterbacks are worth far more than a standard board says. The table now uses FantasyPros' **superflex** rankings (still standard scoring, as you wanted — you get both). The difference is not subtle: your top five quarterbacks were shown at overall **23rd, 27th, 35th, 43rd and 50th**. They are now **1st through 5th**, which is what a two-QB league actually looks like. Going into the auction with the old numbers would have meant badly underbidding on QBs.
- Dynasty rankings switched to the superflex dynasty board too, for the same reason.

**Known issues / not yet done**
- **Team defenses show "—" for overall rank.** FantasyPros' superflex board covers offensive players only. Defenses keep their positional rank (DST1, DST2…) and tier from the standard board, and sort to the bottom of overall-rank sorts — which is where defenses belong in a superflex league. Your rostered defenses still show their real salary and contract.
- Everything else is unchanged: the engine columns (Kerf Value, Edge, Market Value) still show "—" until the valuation engine is built.

**Requires action from you**
- Nothing beyond the usual: `npm run archive` then `npm run ingest`. (Already done for you on this build — the new rankings are loaded.)

## 2026-08-25 — The table is real: your actual league, in the app

**New**
- **The mock data is gone.** The player table now shows your **real KERFUFFLE league**: all 12 rosters with each player's **actual salary, contract length, and roster status**, the **real free-agent pool**, and **FantasyPros' real expert rankings and tiers** (overall + dynasty). Every number traces back to a dated snapshot you captured with `npm run archive`.
- A new command, **`npm run ingest`**, turns your saved snapshots into a small local **database** (one file, `data/gart-dash.sqlite`, kept on your machine). It checks the league's rules as it loads — exactly 12 teams, every roster row is a real player or a recognized dead-cap amount, **no team over the $500 cap**, contract years 1–4 — and if anything looks wrong it **stops loudly and keeps your last good data untouched**. Re-running never duplicates anything.
- The amber MOCK-DATA banner is replaced by a quiet one-liner: **"League data as of \<date\>"** — so you always know how fresh what you're looking at is.
- **Tier bands are now FantasyPros' real tiers** (they appear when you sort by an ECR column, which is also the new default sort). **DST** is now a real position in the table and filters.
- The archiver now captures the **entire transaction log** (all pages, ~60 entries), not just the first page.

**Known issues / not yet done**
- **Kerf Value, Kerf ranks/tiers, Market Value, and Edge show "—"** — those come from the valuation engine, which is the next build. The **Ceiling** box is editable but starts blank for the same reason (it pre-fills from Kerf Value once the engine exists).
- **Proj Points** shows CBS's own projection for rostered players; free agents show "—" for now (their CBS projections live on a page that needs extra handling).
- Three players on one rival roster currently have **blank salaries on CBS itself** — they show "—" and count $0 toward that team's cap until CBS fills them in.
- Ceilings still reset on reload; the app is still local-only.

**Requires action from you**
- **One-time:** run `npm run ingest` once (it builds the database from the snapshots you already have). After that, your routine is: `npm run archive` (fresh snapshot) → `npm run ingest` (load it) → refresh the page.

## 2026-08-25 — Source profiler (a readable map of what's in the data)

**New**
- A new command, **`npm run profile`**, reads your latest saved snapshot and writes a plain-English **field guide** to `docs/profiles/` — for every page and ranking, what columns exist, what type each is, and how often they're blank. It also pulls your **league's scoring rules out of CBS into a clean, structured file** you can read. This is what lets the real database (coming next) be built around what the data *actually* looks like, instead of guesses.
- It's safe to keep in the project: it writes **shapes, not your real data**. Player names, salaries, and rankings are masked (e.g. a name becomes `Aa'Aaaa Aaaaa`); only harmless list-values like positions and roster statuses are shown as-is; your scoring *rules* are shown in full because they're rules, not private data. A built-in safety check refuses to write anything if a real value would slip through.
- The summary answers six questions we needed settled — and turned up useful surprises: your CBS scoring shows **defensive interceptions at 2 points, not the 3 written in the constitution** (CBS is what actually counts); FantasyPros' paid tier is fully working; and a few CBS pages (free agents, transactions, draft results) load their data with JavaScript, so those need extra handling later.

**Requires action from you**
- Nothing new — it reads the snapshots you already captured with `npm run archive`. Just run `npm run profile` after a fresh snapshot to refresh the guide.

**Known issues / not yet done**
- This only **describes** the data — it doesn't load it into the app. The player table is still 100% mock data. And because you have no cut players sitting as "dead cap" right now, the guide couldn't show a real example of those (it confirmed how we'll spot them when they appear).

## 2026-08-25 — Raw snapshot archiver (save the league's history)

**New**
- A new command, **`npm run archive`**, saves a complete, dated snapshot of your league to your computer: **every CBS page** (all 12 team rosters plus free agents, transactions, rules, draft results, and more) and **every FantasyPros ranking** — stored exactly as received. Each run drops a new time-stamped folder under `data/raw/`, so **nothing is ever overwritten** and you build up a history week by week. This matters because some data (past seasons, winning FAB bids) can't be recovered later — so any week you don't snapshot is gone.
- A helper command, **`npm run archive:check-cookie`**, tells you whether your CBS login is still good **before** you capture — so you don't run a snapshot with an expired cookie and collect nothing.

**Requires action from you**
- This reads **real** league data, so it needs your credentials in place (the same ones the discovery spikes used): your **CBS cookie** in `spikes/cbs-api/.env` and your **FantasyPros key** in `spikes/fantasypros-api/.env`. Your CBS cookie expires about weekly — when a capture shows "LOGIN REDIRECT," paste a fresh one and run again.
- Run it yourself whenever you want a snapshot (there's no automatic schedule yet — on purpose, because an automatic run with an expired cookie would silently save nothing).

**Known issues / not yet done**
- This tool only **saves** the raw data — it does **not** yet read it into the app. The player table is still 100% mock data. Turning these snapshots into the real table comes later (the parsing/ingestion and engine work).
- **Past seasons aren't captured yet** — only the current one — and one ranking page and the FantasyPros "ADP" feed don't come back cleanly; those are known gaps for later.
- Everything it saves stays **only on your machine** (it's git-ignored and never uploaded).

**New**
- A **📖 Data Dictionary** button at the bottom opens a pop-up that explains **every column** — a one-line definition, plus a **"Details"** you can expand for more on how it's built and where it comes from.

**Known issues / not yet done**
- Most entries are **placeholders** (marked as such) — the real "where it comes from / how it's calculated" text gets written after we do the data discovery and build the valuation engine. The structure is ready; only the words are pending.

This completes the three-part redesign. Next up is the real work: verifying the CBS and FantasyPros data sources.

## 2026-08-20 — Filter tweaks + two fixes

**Improved**
- The roster control is now a **three-way toggle** — **All / Rostered / Free Agents** — sitting next to a **Manager** dropdown (All, or a specific team). Cleaner than the old dropdown-plus-checkbox.
- The table now has a **sticky header** and its own scroll area, so you can reach the **side-to-side scrollbar without scrolling to the bottom** of the list.

**Fixed**
- **Tier bands** no longer break (duplicate or show out of order) when you sort by **Ovr ECR** or **Dyn Ovr ECR**. Those columns now show a clean overall rank.
- Removed a **console error** on load related to column dragging (drag now starts up after the page loads).

## 2026-08-20 — Table redesign, part 2 (filters, columns you control, and saved views)

**New**
- **Roster dropdown** — one menu to pick All Players, Free Agents, or a specific team, plus a separate **"Include free agents"** checkbox to fold free agents into the All-Players or a team view.
- **Choose your columns** — a **Columns** button lets you show or hide any column (Player always stays).
- **Reorder columns** — **drag a column header** left or right to rearrange the table.
- **Saved views** — five ready-made views mirroring how you actually use the tool: **Full, Auction Prep, Waivers, Trades, Start/Sit**. Pick one from the **View** menu and the columns, sort, and filters all snap into place. **Save your own** arrangements as named views with "Save as new" — they're remembered on this computer between sessions.

**Known issues / not yet done**
- Everything is still **mock data** (amber banner).
- Saved views are remembered **per browser** (not synced across devices).
- Ceilings still reset on reload (you chose to keep it that way for now).
- Next up (**part 3**): the **data dictionary** — a pop-up explaining what each column means and where it comes from.

## 2026-08-20 — Table redesign, part 1 (new dark look + more columns)

**New / Improved**
- The whole table has a new **dark dashboard look** with a teal accent, tighter rows, and a centered "Gart Dash" title.
- **Position is now a colored badge** — QB green, RB red, WR blue, TE tan (DST purple is ready for later).
- **Tiers now show as banded separators** (like FantasyPros) instead of a colored column. They appear when you sort by a ranking column, and the bands match whatever ranking you sorted by — Kerf or ECR or Dynasty, overall or by-position. Sort by something that isn't a ranking (e.g. Proj Points) and the bands step aside.
- **More ranking columns:** Kerf Overall Rank and Kerf Position Rank; ECR split into Overall and Position; Dynasty split into Overall and Position.
- Columns are now grouped by tint into **GartStats / Market / Contract Info**, with a small color key. "Ceiling" and "Edge" are unchanged in meaning; "Market Price" now reads "Market Value."
- A **Position dropdown** (All, SuperFlex, Flex, or a single position) replaces the position buttons. Picking a single position while sorted by a position-rank shows that position's tiers; the app handles the awkward combinations for you.

**Known issues / not yet done**
- Everything is still **mock data** (the amber banner says so); the six tier sets are placeholder groupings until the real engine and rankings exist.
- The filter-bar overhaul (one team dropdown + a free-agent toggle + choosing/reordering columns + saving custom views) is **coming in part 2**. The data dictionary is **part 3**.
- Ceilings still reset on reload; still local-only.

## 2026-08-19 — Player table prototype (local, mock data)

**New**
- You can open Gart Dash locally and use the player table for the first time. Install once with `npm install`, then run `npm run dev` and open http://localhost:3000 — no login, one screen.
- The table shows ~80 players (real NFL names) across QB/RB/WR/TE, split across the free-agent pool, your Rangoon Raccoons roster, and three rival rosters.
- Your numbers and the market's numbers sit side by side: KERF Rank, Proj Pts, KERF Value, and an editable Ceiling (tinted blue) next to Market Price, ECR, and Dynasty ECR (tinted gray), with an **Edge** column between them — your value minus market price, green when you're higher, red when lower — so the gap reads at a glance.
- The table already carries **KERF Rank** (our positional rank, e.g. RB1) and **Proj Pts** (projected KERFUFFLE points) — the shared fields the waiver, trade, and start/sit views will reuse, not just the auction ones.
- Sort by any sortable column. Filter by roster (all players / your roster / free agents / a specific rival team) and by position; the two filters combine.
- Tiers show as colored badges, so a close call looks close instead of a decimal pecking order.
- Type your own number in any **Ceiling** box; it updates that row immediately and holds for the session.

**Known issues**
- Every number is invented mock data — a permanent amber banner says so. Nothing here reflects real CBS or FantasyPros data yet.
- Ceilings reset when you reload the page (expected for this prototype).
- Not deployed anywhere; local only.

**Requires action from you**
- Have Node.js installed. Run `npm install` once, then `npm run dev` whenever you want to open the table.

---

**Related docs:** [`pm/current_state.md`](pm/current_state.md) (the snapshot this history rolls into — update it in the same breath) · [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) (the internal, honest account of the same release)
