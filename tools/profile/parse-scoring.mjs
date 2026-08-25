// Parse CBS /rules into structured, committable form (issue #11, Q2).
//
// These are league RULES, not player data, so values are committed in full
// (owner decision). MUST be parsed from the page, never hardcoded — the league
// changed scoring as recently as 2024 (Turnover on Downs), and the live page can
// even diverge from the written constitution (observed: constitution says
// defensive Int = 3, CBS /rules says Int = 2). The page is authoritative.
//
// parseSetting handles the three formats CBS renders:
//   flat      "2 points" / "-2 points" / "1 point"
//   per_unit  "0+ PaYds = .04 points for every 1 PaYd"
//   tiered    "0 - 0 DSTPAs = 10 points 1 - 6 DSTPAs = 7 points 36+ ... = -4 points"

import { parse } from "node-html-parser";
import { clean } from "./shared.mjs";

export function parseSetting(raw) {
  const s = clean(raw);

  // per_unit: "= .04 points for every 1 PaYd"
  const per = s.match(/=?\s*(-?[\d.]+)\s*points?\s*for every\s*(\d+)\s*(\w+)/i);
  if (per) {
    return {
      kind: "per_unit",
      points_per_unit: Number(per[1]),
      per_units: Number(per[2]),
      unit: per[3],
    };
  }

  // tiered: repeated "<min> - <max|+> <unit>s = <points> point(s)"
  const bandRe = /(\d+)\s*(?:-\s*(\d+)|(\+))?\s*[A-Za-z]+s?\s*=\s*(-?\d+)\s*points?/g;
  const bands = [];
  let m;
  while ((m = bandRe.exec(s))) {
    bands.push({
      min: Number(m[1]),
      max: m[3] === "+" || m[2] == null ? null : Number(m[2]),
      points: Number(m[4]),
    });
  }
  if (bands.length > 1) return { kind: "tiered", bands };

  // flat: first "<n> point(s)"
  const flat = s.match(/(-?[\d.]+)\s*points?/i);
  if (flat) return { kind: "flat", points: Number(flat[1]) };

  return { kind: "unparsed" };
}

// Find the scoring table (label row has "Name" + "Settings"; section rows say
// Offensive / Defensive) and walk it into rows tagged by section.
export function parseScoring(html) {
  const root = parse(html);
  const tables = root.querySelectorAll("table");
  const rules = [];

  for (const t of tables) {
    const trs = t.querySelectorAll("tr");
    const looksScoring = trs.some((tr) => {
      const txt = tr.querySelectorAll("td,th").map((c) => clean(c.text));
      return txt.includes("Name") && txt.includes("Settings");
    });
    if (!looksScoring) continue;

    let section = null;
    for (const tr of trs) {
      const cls = tr.getAttribute("class") || "";
      const c = tr.querySelectorAll("td,th").map((x) => clean(x.text));
      if (/label/.test(cls)) {
        // A label row whose 2nd/3rd cols are the "Name"/"Settings" headers marks
        // the section (Offensive / Defensive) in its first cell.
        if (c[1] === "Name" && c[2] === "Settings" && c[0]) section = c[0];
        continue;
      }
      if (c.length >= 3 && c[0]) {
        rules.push({
          section,
          code: c[0],
          name: c[1],
          raw_setting: c[2],
          parsed: parseSetting(c[2]),
        });
      }
    }
  }
  return rules;
}

// Two-column "Description | Setting" tables = general league settings; and the
// "Status | Min | Max" table = roster position limits. Both are league config.
export function parseSettingsTables(html) {
  const root = parse(html);
  const settings = [];
  let rosterLimits = null;

  for (const t of root.querySelectorAll("table")) {
    const trs = t.querySelectorAll("tr");
    const header = (trs.find((tr) => /label/.test(tr.getAttribute("class") || "")) || trs[0]);
    if (!header) continue;
    const h = header.querySelectorAll("td,th").map((c) => clean(c.text));

    if (h[0] === "Status" && h[1] === "Min" && h[2] === "Max") {
      rosterLimits = trs
        .filter((tr) => /row1|row2/.test(tr.getAttribute("class") || ""))
        .map((tr) => {
          const c = tr.querySelectorAll("td,th").map((x) => clean(x.text));
          return { status: c[0], min: Number(c[1]), max: Number(c[2]) };
        })
        .filter((r) => r.status && Number.isFinite(r.min) && Number.isFinite(r.max));
      continue;
    }

    if (h[0] === "Description" && h[1] === "Setting") {
      for (const tr of trs.filter((r) => /row1|row2/.test(r.getAttribute("class") || ""))) {
        const c = tr.querySelectorAll("td,th").map((x) => clean(x.text));
        if (c[0]) settings.push({ description: c[0], setting: c[1] ?? "" });
      }
    }
  }
  return { settings, rosterLimits };
}
