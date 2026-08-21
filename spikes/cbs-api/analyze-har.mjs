// CBS API spike — HAR analyzer (GitHub issue #5)
//
// The CBS fantasy site loads its data with JavaScript at runtime, so a plain
// fetch only gets the empty page shell. A HAR file is a recording of EVERY
// request a real browser made while you used the page — including the hidden
// data calls that return JSON. This script reads that recording, finds the
// data endpoints, and reports what they contain (especially: salary + contract
// length). It only READS the file you saved. It makes no network calls at all.
//
// HOW TO USE:
//   1. Save a HAR from the CBS rosters page (see README.md "Capture a HAR").
//   2. Put it at spikes/cbs-api/capture.har  (or pass a path as an argument).
//   3. Run:  node spikes/cbs-api/analyze-har.mjs
//
// Requires Node 18+. No npm install.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "output");
const harPath = process.argv[2] || join(HERE, "capture.har");

if (!existsSync(harPath)) {
  console.error(
    `\n✗ No HAR file found at:\n    ${harPath}\n\n` +
      "Save one from the rosters page (README.md ▸ 'Capture a HAR') and put it\n" +
      "at spikes/cbs-api/capture.har, then run this again.\n"
  );
  process.exit(1);
}

let har;
try {
  har = JSON.parse(readFileSync(harPath, "utf8"));
} catch (e) {
  console.error(`\n✗ Couldn't parse that HAR as JSON: ${e.message}\n`);
  process.exit(1);
}

const entries = har?.log?.entries || [];
if (!entries.length) {
  console.error("\n✗ The HAR has no requests in it. Re-record with the page reloading.\n");
  process.exit(1);
}

// Keywords that would mark a response as the league data we care about.
const DATA_HINTS = [
  "salary",
  "contract",
  "roster",
  "fantasyPoints",
  "fantasy_points",
  "player",
  "franchise",
  "auction",
  "waiver",
  "transaction",
  "owner",
];

function bodyOf(entry) {
  const c = entry.response?.content;
  if (!c || !c.text) return "";
  if (c.encoding === "base64") {
    try {
      return Buffer.from(c.text, "base64").toString("utf8");
    } catch {
      return "";
    }
  }
  return c.text;
}

function looksJson(entry, body) {
  const mime = (entry.response?.content?.mimeType || "").toLowerCase();
  if (mime.includes("json")) return true;
  const head = body.slice(0, 200).trim();
  return head.startsWith("{") || head.startsWith("[");
}

mkdirSync(OUT_DIR, { recursive: true });

const jsonCalls = [];
for (const e of entries) {
  const body = bodyOf(e);
  if (!body) continue;
  if (!looksJson(e, body)) continue;
  const url = e.request?.url || "";
  // Skip obvious third-party noise (ads, analytics, consent).
  if (/doubleclick|googlesyndication|taboola|chartbeat|adobe|optanon|ketch|scorecardresearch|amazon-adsystem|neuron\.cbssports\.cloud/i.test(url))
    continue;
  const lower = body.toLowerCase();
  const hits = DATA_HINTS.filter((k) => lower.includes(k.toLowerCase()));
  jsonCalls.push({
    method: e.request?.method || "GET",
    url,
    status: e.response?.status,
    bytes: body.length,
    hits,
    score: hits.length,
    body,
  });
}

jsonCalls.sort((a, b) => b.score - a.score || b.bytes - a.bytes);

console.log(`\nHAR analysis — ${entries.length} requests, ${jsonCalls.length} JSON responses\n`);
console.log("Top JSON responses (by how much they look like league data):\n");

const top = jsonCalls.slice(0, 20);
top.forEach((c, i) => {
  // Only the URL path is printed (query string trimmed) to avoid leaking tokens.
  let shownUrl = c.url;
  try {
    const u = new URL(c.url);
    shownUrl = u.host + u.pathname + (u.search ? "?…" : "");
  } catch {}
  console.log(
    `${String(i + 1).padStart(2)}. [${String(c.status).padEnd(3)}] ${String(c.bytes).padStart(8)}b  ` +
      `hits:${String(c.score).padStart(2)}  ${shownUrl}`
  );
  if (c.hits.length) console.log(`      matched: ${c.hits.join(", ")}`);
});

// Save the full bodies + a manifest of the most promising calls for inspection.
const promising = jsonCalls.filter((c) => c.score > 0).slice(0, 12);
promising.forEach((c, i) => {
  writeFileSync(join(OUT_DIR, `har-data-${String(i + 1).padStart(2, "0")}.json`), c.body);
});
writeFileSync(
  join(OUT_DIR, "_har_manifest.json"),
  JSON.stringify(
    jsonCalls.map((c) => ({ method: c.method, url: c.url, status: c.status, bytes: c.bytes, hits: c.hits })),
    null,
    2
  )
);

console.log("\n---------------------------------------------------------------");
if (promising.length) {
  console.log(`✓ Saved the ${promising.length} most data-like JSON responses to spikes/cbs-api/output/`);
  console.log("  (har-data-01.json is the strongest match). Next: inspect them for the");
  console.log("  fields we need — is player CONTRACT LENGTH present, not just salary?");
} else if (jsonCalls.length) {
  console.log("△ Found JSON responses, but none obviously contain roster/salary/contract data.");
  console.log("  The data call may have happened before recording started — re-capture with the");
  console.log("  Network tab open FIRST, then navigate to the rosters page.");
} else {
  console.log("✗ No usable JSON responses in this HAR. Make sure you saved 'with content'.");
}
console.log("Full request list saved to output/_har_manifest.json (URLs only).\n");
