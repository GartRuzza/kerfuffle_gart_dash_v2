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
