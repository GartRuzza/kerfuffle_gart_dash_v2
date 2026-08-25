// CBS cookie validity / lifetime checker (issue #10; promoted from the spike).
//
// Makes ONE read-only request with the CBS cookie and reports whether it still
// authenticates, appending a timestamped line to data/cookie-expiry-log.tsv.
// Use it before a weekly capture to confirm the cookie is good — or run it daily
// WITHOUT refreshing the cookie to measure its real lifetime (when it flips from
// "yes" to "no", the gap since you pasted it is the lifetime).
//
// Read-only. One GET. Never writes to CBS.
// RUN:  npm run archive:check-cookie   (or: node tools/archive/check-cookie.mjs)
// Reads the cookie from spikes/cbs-api/.env (owner's choice, issue #10).

import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DATA_ROOT, CBS_ENV_DIR, loadEnv, ensureDir } from "./shared.mjs";

const LOG = join(DATA_ROOT, "cookie-expiry-log.tsv");
const env = loadEnv(CBS_ENV_DIR);
const COOKIE = env.CBS_COOKIE || "";
const HOST = env.CBS_LEAGUE_HOST || "kerfuffle.football.cbssports.com";
const stamp = new Date().toISOString();

ensureDir(DATA_ROOT);
if (!existsSync(LOG)) appendFileSync(LOG, "timestamp\tstatus\tvalid\tbytes\tnote\n");

async function main() {
  if (!COOKIE) {
    appendFileSync(LOG, `${stamp}\t-\tno\t0\tno cookie in spikes/cbs-api/.env\n`);
    console.log("No cookie in spikes/cbs-api/.env — logged. Paste a fresh CBS cookie there.");
    return;
  }
  let status = 0, bytes = 0, valid = false, note = "";
  try {
    const res = await fetch(`https://${HOST}/teams`, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0", Cookie: COOKIE },
    });
    status = res.status;
    const loc = res.headers.get("location") || "";
    const body = await res.text();
    bytes = body.length;
    if (/\/login/.test(loc)) note = "redirect to login (expired)";
    else if (status === 200 && /playerRow|Total Salary/.test(body)) { valid = true; note = "authenticated"; }
    else note = `status ${status}, no roster markers`;
  } catch (e) {
    note = "request error: " + (e?.message || e);
  }
  appendFileSync(LOG, `${stamp}\t${status}\t${valid ? "yes" : "no"}\t${bytes}\t${note}\n`);
  console.log(`${stamp}  cookie valid = ${valid ? "YES" : "no"}  (status ${status}) — ${note}`);
  console.log("Logged to data/cookie-expiry-log.tsv");
}
main();
