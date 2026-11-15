// NBA props page: line selection, sorting, free-view gating, and copy rules.
import assert from "node:assert/strict";
import fs from "node:fs";
import { nearestLines, preparePlayers, renderCards, lightOf, sortedGames, freePicks, FREE_PER_GAME } from "../functions/_shared/nba-props.js";
import { onRequestGet as page } from "../functions/props/nba.js";
import { onRequestGet as api } from "../functions/api/props-nba.js";
import { onRequestGet as rawData } from "../functions/data/nba_points_props/[[path]].js";

const board = JSON.parse(fs.readFileSync(new URL("../data/nba_points_props/board.json", import.meta.url), "utf8"));
assert.equal(board.sample, true, "fixture is marked as sample");
assert.equal(board.games.length, 3);

// key lines: the 3 lines closest to the projection, both sides kept, stronger side marked
const p = { proj_pts: 22.2, lines: [20.5, 21.5, 22.5, 23.5, 24.5].map((line) => ({ line, p_over: line < 22.2 ? 0.6 : 0.4, p_under: line < 22.2 ? 0.4 : 0.6 })) };
const nl = nearestLines(p);
assert.deepEqual(nl.map((l) => l.line), [21.5, 22.5, 23.5]);
assert.equal(nl[0].side, "Over");
assert.equal(nl[2].side, "Under");
assert.equal(nl[0].over, 0.6); assert.equal(nl[0].under, 0.4); // both sides kept
assert.equal(lightOf(0.6), "GREEN");
assert.equal(lightOf(0.57), "ORANGE");
assert.equal(lightOf(0.52), "RED");

// sorting: highest chance first, unprojected (Out) last; games in tip-off order
const prepared = preparePlayers(board.games[0].players);
for (let i = 1; i < prepared.length; i++) assert.ok((prepared[i - 1].best ?? -1) >= (prepared[i].best ?? -1));
assert.equal(prepared[prepared.length - 1].status, "Out");
const order = sortedGames(board).map((g) => Date.parse(g.commence_syd));
assert.deepEqual(order, [...order].sort((a, b) => a - b));

// free view: top FREE_PER_GAME by projected points, at least one per team; others are placeholders
const free = renderCards(board, { full: false });
for (const g of board.games) {
  const all = preparePlayers(g.players);
  const picks = [...freePicks(all, [g.away, g.home])];
  assert.equal(picks.length, FREE_PER_GAME);
  assert.ok(picks.some((p) => p.team === g.away) && picks.some((p) => p.team === g.home), "one from each team");
  const byPts = all.filter((p) => p.proj_pts != null && p.shown.length).sort((a, b) => b.proj_pts - a.proj_pts);
  assert.ok(picks.includes(byPts[0]), "top scorer is free");
  all.forEach((x) => assert.equal(free.includes(x.player), picks.includes(x), (picks.includes(x) ? "free shows " : "free hides ") + x.player));
}
// one team dominating the top scorers still yields one from the other team
const lop = preparePlayers([["A1", "A", 30], ["A2", "A", 28], ["A3", "A", 26], ["B1", "B", 10]].map(([player, team, proj_pts]) => ({ player, team, proj_pts, lines: [{ line: proj_pts - 0.5, p_over: 0.52, p_under: 0.48 }] })));
assert.deepEqual([...freePicks(lop, ["A", "B"])].map((p) => p.player).sort(), ["A1", "A2", "B1"]);
assert.ok(free.includes("Members see every player"));
assert.ok(free.includes('href="/join"'));
const full = renderCards(board, { full: true });
board.games.flatMap((g) => g.players).forEach((x) => assert.ok(full.includes(x.player)));
assert.ok(!full.includes("Members see every player"));

// uncertain minutes warning for GTD / Questionable / Out
assert.ok(full.includes("⚠️ GTD") && full.includes("⚠️ Questionable") && full.includes("⚠️ Out"));
assert.ok(full.includes("Minutes are uncertain"));

// cells show both sides, e.g. "22.5 O 58% / U 42%"; only the stronger side is coloured
const cellRe = /^<td class="ln"><span class="pp-line">[\d.]+<\/span> (<span class="pp-chance (GREEN|ORANGE|RED)">O <b>\d+%<\/b><\/span><span class="pp-sep">\/<\/span><span class="pp-side">U \d+%<\/span>|<span class="pp-side">O \d+%<\/span><span class="pp-sep">\/<\/span><span class="pp-chance (GREEN|ORANGE|RED)">U <b>\d+%<\/b><\/span>)<\/td>$/;
const realCells = full.match(/<td class="ln">[\s\S]*?<\/td>/g).filter((c) => !c.includes("ln-empty"));
assert.ok(realCells.length > 0);
realCells.forEach((c) => assert.match(c, cellRe, "two-sided cell: " + c));
assert.ok(!/>(Over|Under) \d/.test(full), "no Over-only / Under-only cells");

// copy rules
for (const h of [free, full]) {
  assert.ok(!/1\.49|best value|bet this|units?\b|\brecord\b/i.test(h.replace(/data-[a-z-]+="[^"]*"/g, "")), "no banned copy");
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
assert.ok(ph.includes("Every NBA game, every player"));
assert.ok(ph.includes("Projections only, not betting advice."));
const visible = ph.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ");
const pageCopy = visible.split("NBA player props: points projections")[1].split("Gamble responsibly")[0];
assert.ok(!/\bmodel\b|nearest|projecting|proj min|method|how we/i.test(pageCopy), "no method wording on the page");
assert.ok(!/\bmodel\b|nearest/i.test(free + full), "no method wording in the cards");
assert.ok(!/1\.49/.test(ph));
assert.equal((await api(ctx("https://x.test/api/props-nba"))).status, 401, "API needs a member token");
assert.equal((await rawData(ctx("https://x.test/data/nba_points_props/board.json", {}, { path: ["board.json"] }))).status, 404, "raw board hidden from the public");
console.log("nba-props: ok");
