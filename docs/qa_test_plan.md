# QA & Test Plan — [PRODUCT NAME]

> **How to use this doc**
> **Owner:** Claude Code writes and maintains it; the product owner runs the manual checks.
> **Update when:** A feature ships (add its checks), or a bug is found (add the check that would have caught it).
> **This doc contains:** How to verify the product works, **written so it can be run without reading any code**.
> **This doc never contains:** Test code. This is the human-readable plan; the code lives in the test suite.
>
> **The rule that makes this doc real:** a feature is not "Built" in [`pm/current_state.md`](pm/current_state.md) until the checks below pass. When a check fails, that feature's status changes — to Partial, or to a known bug. Test results are the evidence behind every status in that doc, which is why this one keeps it honest.
>
> *Examples are in italics and refer to a fictional product, "Ledgerly." Delete them as you fill each section in.*

**Last updated:** [YYYY-MM-DD] · **Last full pass:** [YYYY-MM-DD] · **Result:** [pass / fail — what failed]

---

## Automated tests

| | |
| --- | --- |
| **How to run them** | `[command]` |
| **What they cover** | [in plain English — which parts of the product] |
| **What they do not cover** | [be honest; this is the gap the manual checks must fill] |
| **Currently passing?** | [yes / no — which are failing] |

## Manual checks — the critical flows

*One block per critical flow in [`user_flows.md`](user_flows.md). Written as steps a non-technical person can follow without help. If a step needs the console, a database client, or a developer, rewrite it — a check only you can run is a check that will not get run.*

### [Flow name]

**Setup:** [what you need before you start — a test account, a sample file]

| # | Do this | You should see | Pass? |
| --- | --- | --- | --- |
| 1 | [action] | [expected result — precise enough to be wrong] | ☐ |
| 2 | [action] | [expected] | ☐ |

> *### Closing a month*
> ***Setup:** log in as the demo bookkeeper; use `samples/bank-march.csv` (400 rows, 12 deliberate mismatches).*
>
> *| 1 | Upload the CSV on the Import screen | "400 transactions imported" within ~10 seconds | ☐ |*
> *| 2 | Open the Matches screen | "388 of 400 matched", 12 in the exception queue | ☐ |*
> *| 3 | Match one exception by hand | It leaves the queue; the count drops to 11 | ☐ |*
> *| 4 | Reload the page | The count is still 11 — the match was actually saved, not just shown | ☐ |*

## Edge cases and things that should fail gracefully

*What happens at the boundaries, and when a user does something wrong. Products break here, not on the happy path.*

| # | Try this | It should | Pass? |
| --- | --- | --- | --- |
| 1 | [the bad input / the empty state / the huge file] | [fail clearly, with a way out — never crash, never silently do nothing] | ☐ |

> *| 1 | Upload a CSV from a bank format we do not recognize | Show "unrecognized format" with a support link — not a blank screen and not a half-imported month | ☐ |*
> *| 2 | Upload the same statement twice | Detect the duplicate and refuse — double-importing a month silently corrupts the books | ☐ |*

## Security and permissions checks

*Run these whenever anything touches login, permissions, or payments. The failure mode here is invisible, which is exactly why it needs a deliberate check.*

| # | Check | It should | Pass? |
| --- | --- | --- | --- |
| 1 | Log in as user A, try to open user B's data by URL | Refuse — not merely hide the link | ☐ |
| 2 | Log out and open a signed-in page directly | Redirect to login | ☐ |

## Known-failing / untested

*What we know is not verified. An untested area is not a passing area, and pretending otherwise is how a doc like this starts lying.*

| Area | State | Why |
| --- | --- | --- |
| [area] | Failing / Untested | [reason] |

---

**Related docs:** [`user_flows.md`](user_flows.md) (every critical flow needs a check here) · [`pm/current_state.md`](pm/current_state.md) (a failing check must be reflected there as a bug or a downgraded status)
