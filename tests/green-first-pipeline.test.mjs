// Green first across the pipeline (18 Nov 2026):
//  * the NBA feed may send a 65%+ Best value pick as light GREEN + best_value true (ops/20261118_green_first_feed);
//    the site must show and count it exactly as it does the old feed form (light SUPER);
//  * the SQL cut-offs match lights.json;
//  * the members desk shows stored 65%+ Best value tips (SUPER) as Green + Best value tag, display only;
//  * the mini loader's Discord rule matches the site (checked in Python by tools/mini_lights/tests).
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { gamesOf, gameRow } from "../functions/_shared/site.js";
import { rowsFromFeed, lightTally } from "../functions/_shared/record-pages.js";
import * as S from "../functions/_shared/lights.js";
import CFG from "../lights.json" with { type: "json" };

const require = createRequire(import.meta.url);
const B = require("../lights.js");
const M = require("../members-tips-model.js");
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

// ---------------------------------------------------------------- feed: old form and new form give the same site
const base = { season: 2027, status: "post", first_posted: "2026-11-01T00:00:00Z" };
const games = [
  { ...base, game_id: "1", start_utc: "2026-11-10T00:00:00Z", home: "LAC", away: "SA", pick: "LAC", pick_p: 0.777, won: true, home_score: 1, away_score: 0 },
  { ...base, game_id: "2", start_utc: "2026-11-11T00:00:00Z", home: "MIA", away: "ORL", pick: "MIA", pick_p: 0.606, won: false, home_score: 0, away_score: 1 },
  { ...base, game_id: "3", start_utc: "2026-11-12T00:00:00Z", home: "BOS", away: "NY", pick: "BOS", pick_p: 0.70, won: true, home_score: 1, away_score: 0 },
];
const oldFeed = { season: 2027, games: games.map((g, i) => ({ ...g, light: ["SUPER", "SUPER", "GREEN"][i] })) };
// what public_feed() sends after apply.sql: SUPER at 65%+ becomes GREEN + best_value true
const newFeed = { season: 2027, games: games.map((g, i) => ({ ...g, light: ["GREEN", "SUPER", "GREEN"][i], best_value: [true, true, false][i] })) };
const view = (feed) => {
  const d = gamesOf("nba", JSON.parse(JSON.stringify(feed)));
  const rows = rowsFromFeed("nba", d);
  return { lights: d.games.map((g) => [g.game_id, g.light, g.best_value]), green: lightTally(rows, "GREEN"), bv: lightTally(rows, "SUPER"), row: gameRow(d.games[0]) };
};
const before = view(oldFeed), after = view(newFeed);
assert.deepEqual(after.lights, before.lights, "same lights and tags from either feed form");
assert.deepEqual(after.lights[0], ["1", "GREEN", true]);
assert.deepEqual(after.lights[1], ["2", "SUPER", true]);
assert.deepEqual(after.lights[2], ["3", "GREEN", false]);
assert.deepEqual(after.green, before.green);
assert.deepEqual(after.green, { n: 2, w: 2 }, "the 77% pick counts once, as green");
assert.deepEqual(after.bv, { n: 1, w: 0 }, "Best value record: below the green range only");
assert.equal(after.row, before.row);
assert.match(after.row, /chip GREEN">Green<\/span><span class="bv-tag"/);
// the flag alone never promotes: a below-60% or non-NBA game with best_value true gets no tag
for (const L of [S, B]) {
  assert.equal(L.bestValueTag("nba", "GREEN", 0.77, true), true);
  assert.equal(L.bestValueTag("nba", "ORANGE", 0.58, true), false, "needs 60% shown");
  assert.equal(L.bestValueTag("nfl", "GREEN", 0.77, true), false, "NBA only");
  assert.equal(L.bestValueTag("nba", "GREEN", 0.77, false), false);
}

// ---------------------------------------------------------------- the feed SQL uses lights.json's cut-offs
const sql = read("ops/20261118_green_first_feed/apply.sql");
const back = read("ops/20261118_green_first_feed/rollback.sql");
const pct = (x) => Math.round(x * 100);
assert.ok(sql.includes(`>= ${pct(CFG.games.nba.green_min)} then ''GREEN''`), "green cut-off = lights.json nba.green_min");
assert.ok(sql.includes(`>= ${pct(CFG.best_value.min_p)}) best_value`), "Best value minimum = lights.json best_value.min_p");
assert.ok(sql.includes("floor(round(") && sql.includes("* 100 + 0.0000001)"), "judged on the shown (rounded-down) chance, like the site");
const expr = (s, name) => s.match(new RegExp(`${name} constant text := '((?:[^']|'')*)';`))[1];
for (const k of ["old_expr", "new_expr"]) assert.equal(expr(back, k), expr(sql, k), `rollback ${k} mirrors apply`);
assert.match(sql, /raise exception/, "apply stops when the live function differs");
assert.match(sql, /already applied/, "apply is safe to re-run");
assert.doesNotMatch(sql + back, /\bupdate\s+(predictions|pretip_snapshots|model_prices)\b/i, "stored rows are never rewritten");

// ---------------------------------------------------------------- members desk: display rule only
const tip = JSON.parse(read("data/tipsters/probalab.json"));
const supers = [];
(function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o.light === "SUPER") supers.push(o); Object.values(o).forEach(walk); } })(tip);
const lal = supers.find((r) => /LAL/.test(r.game) && Math.abs(r.win_pct - 0.687) < 1e-9);
assert.ok(lal, "the LAL 68.7% tip (7 Nov) is still stored as SUPER: history is not rewritten");
assert.deepEqual(M.displayLight(lal), { light: "GREEN", bestValue: true }, "LAL 68.7% shows Green + Best value");
assert.equal(M.colour(lal), "GREEN", "and is under the Green filter");
assert.deepEqual(M.displayLight({ sport: "NBA", light: "SUPER", win_pct: 0.61 }), { light: "SUPER", bestValue: true });
assert.deepEqual(M.displayLight({ sport: "NBA", light: "GREEN", win_pct: 0.77, best_value: true }), { light: "GREEN", bestValue: true });
assert.deepEqual(M.displayLight({ sport: "NBA", light: "GREEN", win_pct: 0.70 }), { light: "GREEN", bestValue: false });
assert.deepEqual(M.displayLight({ sport: "NFL", light: "GREEN", win_pct: 0.80, best_value: true }), { light: "GREEN", bestValue: false });
assert.deepEqual(M.displayLight({ sport: "NBA", light: "SUPER" }), { light: "SUPER", bestValue: true }, "no chance on file: unchanged");
assert.equal(M.colours[0], "GREEN", "green first in the desk filters");
const app = read("members-tips-app.js");
assert.ok(app.includes("esc(lightName(c))") && !/\(c===.UNRATED.\?.Off-pick.:c\)/.test(app), "filter buttons use the light names, never SUPER");
assert.equal((app.match(/lightCell\((p|r)\)/g) || []).length, 3, "every tip row uses the green-first cell");
assert.ok(/const lightOk = p\.light === "GREEN";/.test(app), "the QUALIFIES rule still uses the stored light");
assert.ok(read("members-tips.css").includes(".bv-tag"));

// ---------------------------------------------------------------- the mini loader agrees with the site (Python)
try {
  const out = execFileSync("python", ["-I", "-c", [
    "import sys, json; sys.path.insert(0, 'tools/mini_lights')",
    "from probalab_lights import Lights; L = Lights.load('lights.json')",
    "print(json.dumps([L.shown_light('nba', 'GREEN', 0.777), L.best_value_tag('nba', 'GREEN', 0.777, True), L.discord_marker('nba', 'GREEN', 0.777, True).encode('unicode_escape').decode()]))",
  ].join("\n")], { encoding: "utf8", cwd: new URL("..", import.meta.url) });
  assert.deepEqual(JSON.parse(out), ["GREEN", true, "\\U0001f7e2 (Best value)"]);
} catch (e) {
  if (e.code === "ENOENT") console.log("python not available: skipped the loader check");
  else throw e;
}
console.log("green-first pipeline tests passed");

// ---------------------------------------------------------------- decision 18 Nov: 65%+ Best value counts toward John's NBA rule
// (no "not best_value" exclusion anywhere: the export patch only adds the flag; the desk's rule reads the stored light)
const patch = read("tools/mini_lights/apply_lights_patch.py");
assert.doesNotMatch(patch, /not\s+(row\.get\("best_value"\)|best_value)|best_value\s*(is\s+not|!=|==)\s*True/, "no Best value exclusion from the NBA rule");
assert.match(read("ops/20261118_green_first_feed/README.md"), /Decided 18 Nov 2026: yes, 65%\+ Best value games count toward John's NBA rule/);
assert.equal(M.colour({ sport: "NBA", light: "GREEN", win_pct: 0.77, best_value: true }), "GREEN");
console.log("NBA rule decision recorded");
