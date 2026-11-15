// NBA props page: per-stat data, single-line rows, light marker, free-view gating, copy rules.
import assert from "node:assert/strict";
import fs from "node:fs";
import { statOf, preparePlayers, renderCards, renderPanels, lightOf, sortedGames, freePicks, hasStat, FREE_PER_GAME, STATS } from "../functions/_shared/nba-props.js";
import { chip } from "../functions/_shared/site.js";
import { onRequestGet as page } from "../functions/props/nba.js";
import { onRequestGet as api } from "../functions/api/props-nba.js";
import { onRequestGet as rawData } from "../functions/data/nba_points_props/[[path]].js";

const board = JSON.parse(fs.readFileSync(new URL("../data/nba_points_props/board.json", import.meta.url), "utf8"));
assert.equal(board.sample, true, "fixture is marked as sample");
assert.equal(board.games.length, 3);

// data shape: one block per stat; line = nearest half-point to the season average
assert.deepEqual(STATS.map(([id]) => id), ["points", "rebounds", "assists", "threes"]);
for (const p of board.games.flatMap((g) => g.players).filter((p) => p.status !== "Out")) {
  const s = p.stats.points;
  for (const k of ["season_avg", "line", "proj", "sigma", "p_over", "p_under"]) assert.ok(k in s, p.player + " has " + k);
  assert.equal(s.line % 1, 0.5, "half-point line");
  assert.ok(Math.abs(s.line - s.season_avg) <= 0.5, "line is the nearest half-point to the season average");
}
assert.ok(hasStat(board, "points"));
for (const st of ["rebounds", "assists", "threes"]) assert.ok(!hasStat(board, st));

// statOf: stronger side and legacy points shape
const s1 = statOf({ stats: { points: { season_avg: 20.2, line: 20.5, proj: 23, p_over: 0.64, p_under: 0.36 } } }, "points");
assert.equal(s1.side, "Over"); assert.equal(s1.p, 0.64);
const legacy = statOf({ proj_pts: 18, primary_line: { line: 18.5, p_over: 0.45, p_under: 0.55 } }, "points");
assert.equal(legacy.side, "Under"); assert.equal(legacy.line, 18.5);

// light: green 60%+, orange 55–59%, red under 55% (by the % shown)
assert.equal(lightOf(0.6), "GREEN");
assert.equal(lightOf(0.596), "GREEN");
assert.equal(lightOf(0.57), "ORANGE");
assert.equal(lightOf(0.548), "ORANGE");
assert.equal(lightOf(0.52), "RED");

// sort: strongest call first within each game; Out players without data are not listed
for (const g of board.games) {
  const a = preparePlayers(g.players);
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].s.p >= a[i].s.p);
  assert.ok(!a.some((p) => p.status === "Out"));
}
const order = sortedGames(board).map((g) => Date.parse(g.commence_syd));
assert.deepEqual(order, [...order].sort((a, b) => a - b));

// free view: top FREE_PER_GAME by projection, at least one per team; others are placeholders
const free = renderCards(board, { full: false });
for (const g of board.games) {
  const all = preparePlayers(g.players);
  const picks = [...freePicks(all, [g.away, g.home])];
  assert.equal(picks.length, FREE_PER_GAME);
  assert.ok(picks.some((p) => p.team === g.away) && picks.some((p) => p.team === g.home), "one from each team");
  const byProj = all.slice().sort((a, b) => b.s.proj - a.s.proj);
  assert.ok(picks.includes(byProj[0]), "top projection is free");
  all.forEach((x) => assert.equal(free.includes(x.player), picks.includes(x), (picks.includes(x) ? "free shows " : "free hides ") + x.player));
}
const lop = preparePlayers([["A1", "A", 30], ["A2", "A", 28], ["A3", "A", 26], ["B1", "B", 10]].map(([player, team, proj]) => ({ player, team, stats: { points: { season_avg: proj, line: proj + 0.5, proj, p_over: 0.48, p_under: 0.52 } } })));
assert.deepEqual([...freePicks(lop, ["A", "B"])].map((p) => p.player).sort(), ["A1", "A2", "B1"]);
assert.ok(free.includes("Members see every player") && free.includes('href="/join"'));
const full = renderCards(board, { full: true });
board.games.flatMap((g) => g.players).filter((p) => p.status !== "Out").forEach((x) => assert.ok(full.includes(x.player)));
assert.ok(!full.includes("Members see every player"));

// rows: Player | Avg | Line | Our projection | Call | light chip (the Today page component) at the row edge
assert.match(full, /<th[^>]*>Player<\/th><th[^>]*>Avg<\/th><th[^>]*>Line<\/th><th[^>]*>Our projection<\/th><th[^>]*>Call<\/th>/);
assert.ok(!/>Minutes<|Proj min|O \d+% \/|pp-line|pp-side/.test(full), "no minutes column, no O/U pair cells");
const rows = full.match(/<tr data-team[\s\S]*?<\/tr>/g);
assert.equal(rows.length, board.games.flatMap((g) => g.players).filter((p) => p.status !== "Out").length);
for (const r of rows) {
  const call = r.match(/<td class="call">(Over|Under) (\d+)%<\/td>/);
  assert.ok(call, "call cell: " + r);
  const light = lightOf(Number(call[2]) / 100);
  assert.ok(r.trimEnd().endsWith(`<td class="lt">${chip(light)}</td>\n    </tr>`), "light chip is the last cell");
  assert.equal(r.includes('data-green="1"'), light === "GREEN");
}

// tabs: Points has data; the other stats say Coming soon
const panels = renderPanels(board, { full: false });
for (const [id] of STATS) assert.ok(panels.includes(`id="pp-panel-${id}"`));
assert.equal((panels.match(/Coming soon\./g) || []).length, 3);

// injury watch for GTD / Questionable
assert.ok(full.includes("⚠️ GTD") && full.includes("⚠️ Questionable") && full.includes("Minutes uncertain"));

// copy rules
for (const h of [free, full]) {
  assert.ok(!/1\.49|best value|bet this|units?\b|\brecord\b|bookie/i.test(h.replace(/data-[a-z-]+="[^"]*"/g, "")), "no banned copy");
  assert.ok(!/\bmodel\b|nearest|method/i.test(h), "no method wording in the cards");
}

// routes with a fake ASSETS binding
const ctx = (url, headers = {}, params = {}) => ({
  request: new Request(url, { headers }),
  params,
  env: { ASSETS: { fetch: async () => new Response(fs.readFileSync(new URL("../data/nba_points_props/board.json", import.meta.url)), { headers: { "content-type": "application/json" } }) } },
});
const pr = await page(ctx("https://x.test/props/nba"));
const ph = await pr.text();
assert.equal(pr.status, 200);
assert.ok(ph.includes("Sample data"));
assert.ok(ph.includes('name="robots" content="noindex"'), "sample board is noindex");
for (const [, label] of STATS) assert.ok(ph.includes(`data-stat="${label.toLowerCase()}">${label}</button>`), "tab " + label);
assert.ok(ph.includes("Projections only, not betting advice."));
const visible = ph.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ");
const pageCopy = visible.split("NBA player props")[2].split("Gamble responsibly")[0];
assert.ok(!/\bmodel\b|nearest|projecting|minutes column|method|how we|bookie/i.test(pageCopy), "no method wording on the page");
assert.ok(!/1\.49/.test(ph));
assert.equal((await api(ctx("https://x.test/api/props-nba"))).status, 401, "API needs a member token");
assert.equal((await rawData(ctx("https://x.test/data/nba_points_props/board.json", {}, { path: ["board.json"] }))).status, 404, "raw board hidden from the public");
console.log("nba-props: ok");
