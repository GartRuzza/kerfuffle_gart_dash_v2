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

## 2026-08-19 — Player table prototype (local, mock data)

**New**
- You can open Gart Dash locally and use the player table for the first time. Install once with `npm install`, then run `npm run dev` and open http://localhost:3000 — no login, one screen.
- The table shows ~80 players (real NFL names) across QB/RB/WR/TE, split across the free-agent pool, your Rangoon Raccoons roster, and three rival rosters.
- Your numbers and the market's numbers sit side by side: KERF Value and an editable Ceiling (tinted blue) next to Market Price, ECR, and Dynasty ECR (tinted gray), with an **Edge** column between them — your value minus market price, green when you're higher, red when lower — so the gap reads at a glance.
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
