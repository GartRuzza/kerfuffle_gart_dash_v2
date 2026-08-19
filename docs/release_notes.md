# Release Notes — [PRODUCT NAME]

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

### *[2026-03-14] — Bank import and matching (example entry — delete me)*

> ***New***
> *- You can import a bank statement as a CSV file. We recognize 3 bank formats today.*
> *- Ledgerly now matches transactions to invoices automatically when the amount is identical and the dates are close, and puts everything it is unsure about into an exception queue for you to review.*
>
> ***Known issues***
> *- Roughly 40% of real transactions still land in the exception queue, because we cannot yet match partial payments, bundled payments, or payments with bank fees deducted. This means closing a month still takes real manual work — the product does not yet deliver on its main promise. Fuzzy matching is next.*
> *- Files over 5,000 rows will time out.*
> *- If your bank's CSV format is not one of the 3 we know, the import will fail and there is currently no way to fix it yourself.*
>
> ***Requires action from you***
> *- Run the database migration before this version will start.*

---

**Related docs:** [`pm/current_state.md`](pm/current_state.md) (the snapshot this history rolls into — update it in the same breath) · [`pm/implementation_reality_log.md`](pm/implementation_reality_log.md) (the internal, honest account of the same release)
