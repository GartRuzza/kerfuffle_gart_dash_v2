// CBS cookie-lifetime checker (GitHub issue #5, follow-up)
//
// Purpose: measure how long a CBS session cookie actually stays valid. It makes
// ONE read-only request with the cookie in .env and appends a timestamped line
// to output/cookie-expiry-log.tsv saying whether the cookie still authenticates.
// Run it daily (a Windows scheduled task does this automatically) WITHOUT
// refreshing the cookie in between — when it flips to invalid, that gap is the
// real lifetime.
//
// Read-only. One GET. Never writes to CBS.  Run: node spikes/cbs-api/check-cookie.mjs

import { readFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "output");
const LOG = join(OUT_DIR, "cookie-expiry-log.tsv");

function envVal(key) {
  for (const f of [".env", ".env.local"]) {
    const p = join(HERE, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      if (line.startsWith(key + "=")) return line.slice(key.length + 1).trim();
    }
  }
  return "";
}

const COOKIE = envVal("CBS_COOKIE");
const HOST = envVal("CBS_LEAGUE_HOST") || "kerfuffle.football.cbssports.com";
const stamp = new Date().toISOString(); // scheduled runs happen at real time; fine here

mkdirSync(OUT_DIR, { recursive: true });
if (!existsSync(LOG)) appendFileSync(LOG, "timestamp\tstatus\tvalid\tbytes\tnote\n");

async function main() {
  if (!COOKIE) {
    appendFileSync(LOG, `${stamp}\t-\tno\t0\tno cookie in .env\n`);
    console.log("No cookie in .env — logged.");
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
    if (/\/login/.test(loc)) { note = "redirect to login (expired)"; }
    else if (status === 200 && /playerRow|Total Salary/.test(body)) { valid = true; note = "authenticated"; }
    else { note = `status ${status}, no roster markers`; }
  } catch (e) {
    note = "request error: " + (e?.message || e);
  }
  appendFileSync(LOG, `${stamp}\t${status}\t${valid ? "yes" : "no"}\t${bytes}\t${note}\n`);
  console.log(`${stamp}  valid=${valid ? "YES" : "no"}  (status ${status}) — ${note}`);
  console.log(`Logged to ${LOG}`);
}
main();
