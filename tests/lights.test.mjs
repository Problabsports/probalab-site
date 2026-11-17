// lights.json is the single source of truth for lights: cut-offs, Best value, props scale, colours, labels, emoji.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import CFG from "../lights.json" with { type: "json" };
import * as S from "../functions/_shared/lights.js";
import M from "../lights.mjs";
import { outputs } from "../tools/build_lights.mjs";
import { renderLightsPage, LIGHT_COPY } from "../functions/_shared/record-pages.js";
import { renderHowItWorksPage } from "../functions/_shared/method-pages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const B = require("../lights.js");
const P = require("../phone-core.js");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---------------------------------------------------------------- the agreed values
const g = CFG.games;
for (const s of ["nba", "nfl", "nhl"]) assert.deepEqual([g[s].green_min, g[s].orange_min], [0.65, 0.55], s);
for (const s of ["epl", "championship"]) assert.equal(g[s].green_min, 0.55, s);
assert.equal(g.tennis.green_min, 0.70);
assert.deepEqual(CFG.best_value.sports, ["nba"]);
assert.equal(CFG.best_value.light, "SUPER");
assert.deepEqual([CFG.props.green_min, CFG.props.orange_min], [0.60, 0.55]);
assert.deepEqual(Object.fromEntries(CFG.order.map((l) => [l, CFG.lights[l].emoji])), { SUPER: "🟣", GREEN: "🟢", ORANGE: "🟠", RED: "🔴" });
assert.equal(CFG.lights.SUPER.label, "Best value");
assert.equal(CFG.lights.SUPER.colour, "#b56cff", "Best value is purple");

// ---------------------------------------------------------------- rules (server = browser copies)
assert.deepEqual(S.scaleText("nba"), { GREEN: "65%+", ORANGE: "55–64%", RED: "under 55%" });
assert.deepEqual(S.scaleText("epl"), { GREEN: "55%+", ORANGE: "45–54%", RED: "under 45%" });
assert.deepEqual(S.scaleText("tennis"), { GREEN: "70%+", ORANGE: "60–69%", RED: "under 60%" });
assert.deepEqual(S.propsText(), { GREEN: "60%+", ORANGE: "55–59%", RED: "under 55%" });
assert.equal(S.greenSummary(), "65%+ in the NBA, NFL and NHL; 55%+ in the Premier League and Championship; 70%+ in tennis");
const cases = [
  ["nba", 0.65, null, "GREEN"], ["nba", 0.6499, null, "ORANGE"], ["nba", 0.55, null, "ORANGE"], ["nba", 0.5499, null, "RED"],
  ["nba", 0.64, "GREEN", "ORANGE"], ["nba", 0.66, "GREEN", "GREEN"], ["nba", 0.59, "SUPER", "ORANGE"], ["nba", 0.61, "SUPER", "SUPER"],
  ["nba", 0.61, "super-green", "SUPER"], ["nfl", 0.70, "SUPER", "GREEN"], ["nfl", 0.60, "GREEN", "GREEN"], ["nhl", 0.60, null, "ORANGE"],
  ["epl", 0.55, null, "GREEN"], ["epl", 0.45, null, "ORANGE"], ["epl", 0.44, null, "RED"], ["championship", 0.5, null, "ORANGE"],
  ["tennis", 0.70, null, "GREEN"], ["tennis", 0.69, null, "ORANGE"], ["tennis", 0.59, null, "RED"],
];
for (const [sp, p, feed, want] of cases) {
  for (const [name, L] of [["server", S], ["lights.js", B], ["lights.mjs", M]]) assert.equal(L.shownLight(sp, feed, p), want, `${name} ${sp} ${p} ${feed}`);
}
for (const [p, want] of [[0.595, "GREEN"], [0.6, "GREEN"], [0.594, "ORANGE"], [0.545, "ORANGE"], [0.544, "RED"]]) {
  for (const L of [S, B, M]) assert.equal(L.propsLight(p), want, `props ${p}`);
}

// ---------------------------------------------------------------- generated copies are current (lights.js, lights.mjs, CSS colours)
for (const [f, body] of Object.entries(outputs())) assert.equal(read(f).replace(/\r\n/g, "\n"), body.replace(/\r\n/g, "\n"), `${f} out of date: run node tools/build_lights.mjs`);
for (const l of CFG.order) {
  const c = CFG.lights[l];
  for (const f of ["page.css", "index.html"]) assert.ok(read(f).includes(`--${c.css_var}: ${c.colour}; --${c.css_var}-soft: ${c.soft};`), `${f} ${l} colour`);
}

// ---------------------------------------------------------------- no cut-off or light name hard-coded outside lights.json
const SRC = [];
const walk = (d) => {
  for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const rel = path.join(d, e.name);
    if (e.isDirectory()) { if (!/^(node_modules|\.wrangler|\.git|tests|data|tools)$/.test(e.name)) walk(rel); }
    else if (/\.(m?js|html)$/.test(e.name) && !/^lights(-core)?\.m?js$/.test(e.name) && !/\.min\.js$/.test(e.name)) SRC.push(rel);
  }
};
walk(".");
const CUT = /[<>]=?\s*0?\.\d+\s*\?\s*"(GREEN|ORANGE|RED)"|"(GREEN|SUPER)"\s*&&\s*\w+\s*<\s*0?\.\d/;
const bad = [];
for (const f of SRC) read(f).split("\n").forEach((line, i) => { if (CUT.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`); });
assert.deepEqual(bad, [], "cut-offs must come from lights.json:\n" + bad.join("\n"));
for (const f of ["functions/_shared/site.js", "functions/today.js", "functions/_shared/teams.js", "functions/_shared/record-pages.js", "phone-core.js", "functions/_shared/game-filters.js", "functions/api/green-record.js"]) {
  const s = read(f);
  assert.ok(!/"Super — best value"/.test(s), `${f}: Best value label comes from lights.json`);
  assert.ok(!/55–65%|55 to 65%|45–55%|60–70%/.test(s.replace(/BANDS_\w+ = .*$/gm, "")), `${f}: orange range comes from lights.json`);
}

// ---------------------------------------------------------------- pages show the config's text
const lp = renderLightsPage();
for (const s of ["nba", "epl", "tennis"]) for (const t of Object.values(S.scaleText(s))) assert.ok(lp.includes(t[0].toUpperCase() + t.slice(1)) || lp.includes(t), `/lights shows ${s} ${t}`);
assert.ok(lp.includes("at least 60% on the side"), "Best value minimum from lights.json");
assert.ok(renderHowItWorksPage().includes(S.orangeSummary()));
assert.deepEqual(LIGHT_COPY.nba, { scale: "two-way", green: "65%+", orange: "55–64%", red: "under 55%", super: true, note: LIGHT_COPY.nba.note });
assert.equal(LIGHT_COPY.nfl.super, false);
assert.deepEqual(P.GAME_SCALE.epl, { GREEN: "55%+", ORANGE: "Lean · 45–54%", RED: "Open match · under 45%" });
assert.equal(P.LIGHT_LABEL.SUPER, "Best value");
// home page static key: the written fallback equals what the config fills in
const idx = read("index.html");
const spans = [...idx.matchAll(/<span data-lt="([^"]+)">([^<]*)<\/span>/g)];
assert.ok(spans.length >= 4);
for (const [, key, text] of spans) {
  const [kind, a, b] = key.split(":");
  assert.equal(text, kind === "label-long" ? S.labelLong(a) : kind === "label" ? S.label(a) : S.rangeText(a, b), key);
}
assert.ok(idx.indexOf('src="/lights.js"') < idx.indexOf("const LT = window.PLLights"), "index.html loads lights.js before the app script");

// ---------------------------------------------------------------- the mini loader (Python) gives the same answers
const py = path.join(ROOT, "tools", "mini_lights", "probalab_lights", "__init__.py");
if (fs.existsSync(py)) {
  const grid = [];
  for (const sp of Object.keys(CFG.games)) for (const feed of [null, "GREEN", "SUPER", "ORANGE"]) for (let p = 0.4; p < 0.8; p += 0.0125) grid.push([sp, feed, +p.toFixed(4)]);
  const want = grid.map(([sp, feed, p]) => S.shownLight(sp, feed, p));
  let out;
  try {
    out = execFileSync("python", ["-I", path.join(ROOT, "tools", "mini_lights", "parity.py"), path.join(ROOT, "lights.json")], { input: JSON.stringify(grid), encoding: "utf8" });
  } catch (e) { out = null; console.log("python not available: skipped the Python parity check"); }
  if (out != null) assert.deepEqual(JSON.parse(out), want, "Python loader matches the site rules");
}
// the check script's team names match the site's (it maps feed abbreviations to the names Discord posts use)
const chk = read("tools/mini_lights/check_discord_lights.py");
const pyMap = (name) => JSON.parse(chk.match(new RegExp("^" + name + " = (\\{.*\\})$", "m"))[1]);
const jsMap = (file, name) => JSON.parse(read(file).match(new RegExp("const " + name + " = (\\{[^\\n]*?\\});"))[1].replace(/([A-Z]+):/g, '"$1":'));
assert.deepEqual(pyMap("NBA"), jsMap("functions/_shared/site.js", "NBA_TEAMS"), "check script NBA names = site.js NBA_TEAMS");
assert.deepEqual(pyMap("NHL"), jsMap("functions/today.js", "NHLN"), "check script NHL names = today.js NHLN");
console.log("lights tests passed");
