# CBS API spike (GitHub issue #5)

> **OUTCOME (2026-08-20): success — the full write-up is [`../../docs/cbs_data_discovery.md`](../../docs/cbs_data_discovery.md).**
> Short version: the old CBS JSON API is dead; the working method is to fetch the
> league's clean URLs with your **session cookie** and parse the HTML tables.
> `pull.mjs` does that for the real data pages. Contract length is present in CBS.

A **throwaway, read-only** experiment to answer one question: *can we pull real
KERFUFFLE league data out of CBS, and what does it contain?* This folder is not
part of the Gart Dash app and is never deployed. The script here only **reads**
from CBS (HTTP GET) — it never bids, drops, sets a lineup, or writes anything.

> **Why this exists:** the CBS fantasy API is old and officially deprecated.
> Research got us this far; the last stretch can only be settled with *your*
> logged-in session, because CBS data is private to league members.

## What we already know (before you run anything)

- The API host **`fantasy-api.cbssports.com` is alive** (returns HTTP 200).
- Requests look like
  `https://fantasy-api.cbssports.com/fantasy/league/rosters/?version=3.0&response_format=json&access_token=…`
- **Without valid auth, every call bounces to the normal CBS website (HTML), not data.**
  So the whole game is getting the right auth from your browser into the `.env` file.

## How to run it

### Step 1 — get your auth out of the browser

1. In Chrome/Edge, log into CBS and open the **KERFUFFLE** league page.
2. Note the address bar — the part before `.cbssports.com` is your **league host**
   (e.g. `https://kerfuffle.cbssports.com/` → `kerfuffle.cbssports.com`).
3. Press **F12** to open Developer Tools, click the **Network** tab, then
   **refresh the page** (F5). You'll see a list of requests appear.
4. Click the top request (the page itself). In the panel that opens, find
   **Request Headers**, and look for the line that starts with **`cookie:`**.
   Right-click it → **Copy value** (or select the whole long line and copy).
   *That whole string is your session — treat it like a password.*

*(Optional, if you spot it:* while still in the Network tab, type `token` or
`access_token` into the filter box. If any request URL contains
`access_token=…`, copy that value too — it may be the simpler path.)*

### Step 2 — put it in a local, private file

1. In this folder, copy **`.env.example`** to a new file named **`.env`**.
2. Paste your values:
   - `CBS_COOKIE=` the long cookie string from step 1.4
   - `CBS_LEAGUE_HOST=` your league host from step 1.2 (e.g. `kerfuffle.cbssports.com`)
   - `CBS_ACCESS_TOKEN=` the token, *if* you found one (otherwise leave blank)
3. Save. `.env` is git-ignored — it will not be committed.

### Step 3 — run it (from the project root)

```
node spikes/cbs-api/pull.mjs
```

It tries ~14 read-only endpoints, saves each raw response into
`spikes/cbs-api/output/` (also git-ignored), and prints a summary showing which
ones returned real **JSON** data versus which **bounced to the website**.

## Reading the result

- **`JSON ✓` on the summary lines** → access works. The saved `.json` files are
  the real prize. The report then answers: what fields exist, **is contract
  _length_ there or only salary**, how far back does history go, and how are
  players identified.
- **All `HTML-BOUNCE`** → this auth method isn't the one the API accepts yet.
  Tokens/cookies expire quickly, so first just re-copy a fresh one and re-run.

## Capture a HAR (the reliable way to find the data)

We learned that `pull.mjs` gets only the empty page shell, because CBS loads the
real data with JavaScript after the page opens. A **HAR file** is a recording of
everything the page loaded — including those hidden data calls. You save one; the
analyzer script finds the data endpoint and reads it. **One action for you:**

1. Log in and open the **rosters** page (the one that shows players, salaries,
   and contracts) at `https://kerfuffle.football.cbssports.com/`.
2. Press **F12** → **Network** tab. Make sure the round **red "record"** dot is
   on (it usually is), and tick **"Preserve log"**.
3. Press **F5** to reload the page. Let it fully load.
4. **Right-click anywhere in the list of requests → "Save all as HAR with
   content"** (Chrome/Edge may call it "Save all as HAR"). Save it as
   **`capture.har`** inside the `spikes/cbs-api/` folder.
5. Tell me — I'll run `node spikes/cbs-api/analyze-har.mjs` and read out what the
   data contains (including whether contract length is in there).

*(A HAR contains your cookie, same as `.env`. It's git-ignored and stays local —
don't paste it into the chat; the file is the safe home for it.)*

### Alternate: copy one request as cURL

If the HAR is awkward: DevTools ▸ **Network** ▸ filter **Fetch/XHR** ▸ reload ▸
find a row whose response is JSON ▸ right-click ▸ **Copy ▸ Copy as cURL** ▸ save
it into a local file in this folder. It has the exact URL + headers CBS uses.

## Measuring how long the cookie lasts

`check-cookie.mjs` makes one read-only request and appends a yes/no line to
`output/cookie-expiry-log.tsv`. Run it once a day **without refreshing the cookie**
in between — when it flips from `yes` to `no`, the gap since you pasted the cookie
is its real lifetime.

- Run manually anytime: `node spikes/cbs-api/check-cookie.mjs`
- To run it daily automatically (Windows), paste this into PowerShell once:
  ```powershell
  $node="C:\Program Files\nodejs\node.exe"
  $script="$HOME\OneDrive\Projects\Kerfuffle Gart Dash\kerfuffle_gart_dash_v2\spikes\cbs-api\check-cookie.mjs"
  $a=New-ScheduledTaskAction -Execute $node -Argument "`"$script`""
  $t=New-ScheduledTaskTrigger -Daily -At 10am
  $s=New-ScheduledTaskSettingsSet -StartWhenAvailable
  Register-ScheduledTask -TaskName "GartDash-CBS-CookieCheck" -Action $a -Trigger $t -Settings $s -Force
  ```
  Remove it when done: `Unregister-ScheduledTask -TaskName "GartDash-CBS-CookieCheck" -Confirm:$false`

## Safety notes

- **Read-only.** Every request is a GET. There is no code here that can change
  your team, place a bid, or alter the league.
- **Your cookie/token is a secret.** It lives only in the local `.env` (git-ignored).
  Don't paste it into the repo, a commit, or a public place. It expires on its
  own fairly quickly anyway.
- The pulled data in `output/` is real league data and is **git-ignored** on
  purpose — we don't commit league data during a spike.
