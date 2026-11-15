// NBA props page: line selection, sorting, free-view gating, and copy rules.
import assert from "node:assert/strict";
import fs from "node:fs";
import { nearestLines, preparePlayers, renderCards, lightOf, sortedGames, FREE_PER_GAME } from "../functions/_shared/nba-props.js";
import { onRequestGet as page } from "../functions/props/nba.js";
import { onRequestGet as api } from "../functions/api/props-nba.js";
import { onRequestGet as rawData } from "../functions/data/nba_points_props/[[path]].js";

const board = JSON.parse(fs.readFileSync(new URL("../data/nba_points_props/board.json", import.meta.url), "utf8"));
assert.equal(board.sample, true, "fixture is marked as sample");
assert.equal(board.games.length, 3);

// nearest lines: 3 lines closest to the projection, shown with the more likely side
const p = { proj_pts: 22.2, lines: [20.5, 21.5, 22.5, 23.5, 24.5].map((line) => ({ line, p_over: line < 22.2 ? 0.6 : 0.4, p_under: line < 22.2 ? 0.4 : 0.6 })) };
const nl = nearestLines(p);
assert.deepEqual(nl.map((l) => l.line), [21.5, 22.5, 23.5]);
assert.equal(nl[0].side, "Over");
assert.equal(nl[2].side, "Under");
assert.equal(lightOf(0.6), "GREEN");
assert.equal(lightOf(0.57), "ORANGE");
assert.equal(lightOf(0.52), "RED");

// sorting: highest chance first, unprojected (Out) last; games in tip-off order
const prepared = preparePlayers(board.games[0].players);
for (let i = 1; i < prepared.length; i++) assert.ok((prepared[i - 1].best ?? -1) >= (prepared[i].best ?? -1));
assert.equal(prepared[prepared.length - 1].status, "Out");
const order = sortedGames(board).map((g) => Date.parse(g.commence_syd));
assert.deepEqual(order, [...order].sort((a, b) => a - b));

// free view: only the top players' real names; locked rows are placeholders
const free = renderCards(board, { full: false });
for (const g of board.games) {
  const ranked = preparePlayers(g.players);
  ranked.slice(0, FREE_PER_GAME).forEach((x) => assert.ok(free.includes(x.player), "free shows " + x.player));
  ranked.slice(FREE_PER_GAME).forEach((x) => assert.ok(!free.includes(x.player), "free hides " + x.player));
}
assert.ok(free.includes("Members see every player"));
assert.ok(free.includes('href="/join"'));
const full = renderCards(board, { full: true });
board.games.flatMap((g) => g.players).forEach((x) => assert.ok(full.includes(x.player)));
assert.ok(!full.includes("Members see every player"));

// uncertain minutes warning for GTD / Questionable / Out
assert.ok(full.includes("⚠️ GTD") && full.includes("⚠️ Questionable") && full.includes("⚠️ Out"));
assert.ok(full.includes("Minutes are uncertain"));

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
assert.ok(ph.includes("model projections, not bets"));
assert.ok(!/1\.49/.test(ph));
assert.equal((await api(ctx("https://x.test/api/props-nba"))).status, 401, "API needs a member token");
assert.equal((await rawData(ctx("https://x.test/data/nba_points_props/board.json", {}, { path: ["board.json"] }))).status, 404, "raw board hidden from the public");
console.log("nba-props: ok");
