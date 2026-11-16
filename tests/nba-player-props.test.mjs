// NBA props data pieces: hit-rate heatmap, player pages, name links, members gating, copy rules.
// Game logs here are test-only fixtures; the live snapshot has none yet, so those pieces must hide.
import assert from "node:assert/strict";
import fs from "node:fs";
import { _resetBoardCache, renderCards } from "../functions/_shared/nba-props.js";
import { hitRate, heatBand, gameLog, renderHeatmap, renderHeatmapSection, renderPlayerBody, findPlayer, publicIds, playerId, playerPath, boardHasLogs, teamAbbr } from "../functions/_shared/nba-player-props.js";
import { onRequestGet as page } from "../functions/props/nba.js";
import { onRequestGet as playerPage } from "../functions/props/nba/player/[id].js";
import { onRequestGet as playerApi } from "../functions/api/props-nba-player.js";
import { onRequestGet as boardApi } from "../functions/api/props-nba.js";

// ---------------------------------------------------------------- pure helpers
const blk = (avg, line) => ({ season_avg: avg, line, proj: avg + 1, sigma: 4, p_over: 0.6, p_under: 0.4 });
const log12 = Array.from({ length: 12 }, (_, i) => ({
  date: `2026-11-${String(14 - i).padStart(2, "0")}`, opp: "DEN", home: i % 2 === 0,
  points: i < 5 ? 30 : 20, rebounds: 8, assists: i < 10 ? 7 : null, threes: 2,
}));
const P = (player, team, extra = {}) => ({ player, team, status: "Active", notes: "", stats: { points: blk(26, 25.5), rebounds: blk(7, 7.5), assists: blk(6, 5.5), threes: blk(2.4, 2.5) }, ...extra });

const alpha = P("Ålpha Jones", "Oklahoma City Thunder", { game_log: log12.slice().reverse() }); // unsorted on purpose
assert.equal(playerId(alpha), "alpha-jones", "slug ids, accents folded");
assert.equal(playerPath(alpha), "/props/nba/player/alpha-jones");
assert.equal(playerId({ player: "X", player_id: 1628983 }), "1628983", "player_id wins when present");
assert.equal(gameLog(alpha)[0].date, "2026-11-14", "newest first");
assert.equal(teamAbbr("Oklahoma City Thunder"), "OKC");

// points: last 5 all 30 (> 25.5), older 20
assert.deepEqual(hitRate(alpha, "points", 5), { over: 5, n: 5, rate: 1 });
assert.deepEqual(hitRate(alpha, "points", 10), { over: 5, n: 10, rate: 0.5 });
assert.deepEqual(hitRate(alpha, "points", null), { over: 5, n: 12, rate: 5 / 12 });
assert.equal(hitRate(alpha, "rebounds", 5).rate, 1, "8 > 7.5");
assert.equal(hitRate(alpha, "threes", 5).rate, 0, "2 is under 2.5");
assert.equal(hitRate(alpha, "assists", null).n, 10, "games missing the stat are skipped");
assert.equal(hitRate(P("No Log", "X"), "points", 5), null, "no log, no rate");
assert.equal(hitRate({ ...alpha, stats: {} }, "points", 5), null, "no line, no rate");
assert.deepEqual([1, 0.8, 0.79, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1].map((r) => heatBand({ rate: r })), [4, 4, 3, 3, 2, 2, 1, 1, 0]);
assert.equal(heatBand(null), "na");

// ---------------------------------------------------------------- boards
const GEN = "2026-11-15T07:31:00+11:00";
const NOW = Date.parse("2026-11-15T09:00:00+11:00");
const game = (id, away, home, players, hour = 11) => ({ event_id: id, game: `${away} @ ${home}`, away, home, commence_syd: `2026-11-15T${hour}:00:00+11:00`, commence_utc: new Date(Date.parse(`2026-11-15T${hour}:00:00+11:00`)).toISOString(), players });
const noLogBoard = {
  sport: "nba", sample: false, tips: false, data_only: true, generated_at: GEN, stats_available: ["points", "rebounds", "assists", "threes"],
  games: [game("e1", "Oklahoma City Thunder", "Denver Nuggets", [
    P("Realname Alpha", "Oklahoma City Thunder"), P("Realname Bravo", "Oklahoma City Thunder"), P("Realname Charlie", "Oklahoma City Thunder"),
    P("Realname Delta", "Denver Nuggets"), P("Realname Echo", "Denver Nuggets"), P("Realname Foxtrot", "Denver Nuggets"),
    P("Realname Golf", "Denver Nuggets", { status: "Out", stats: {} }),
  ])],
};
// same board with logs on two players; the second has a log missing threes
const logBoard = structuredClone(noLogBoard);
logBoard.games[0].players[0].game_log = log12;
logBoard.games[0].players[3].game_log = log12.map(({ threes, ...r }) => r);

// no logs: every log-based piece is hidden
assert.equal(boardHasLogs(noLogBoard), false);
assert.equal(renderHeatmap(noLogBoard), "");
assert.equal(renderHeatmapSection(noLogBoard), "");
const bodyNoLog = renderPlayerBody({ ...findPlayer(noLogBoard, "realname-alpha") });
assert.ok(bodyNoLog.includes("Season averages") && bodyNoLog.includes("Today's line 25.5"));
assert.ok(!/Last \d+ games|Game by game|Hit rates|<svg/.test(bodyNoLog), "no form, chart or hit rates without a log");

// logs: heatmap rows, cells, grey for missing data
assert.equal(boardHasLogs(logBoard), true);
const hm = renderHeatmapSection(logBoard);
for (const id of ["hmGame", "hmTeam", "hmMarket", "hmSort"]) assert.ok(hm.includes(`id="${id}"`), "filter " + id);
const rows = hm.match(/<tr data-game[\s\S]*?<\/tr>/g);
assert.equal(rows.length, 6, "every listed player gets a row; Out players left off");
assert.equal((rows[0].match(/<td class="hm-c/g) || []).length, 8, "4 markets × L5/L10");
assert.ok(rows[0].includes('href="/props/nba/player/realname-alpha"'), "name links to the player page");
assert.ok(rows[0].includes('class="hm-c hm-4" data-m="points" data-w="5" data-v="1.000"'));
assert.ok(rows[0].includes('class="hm-c hm-2" data-m="points" data-w="10" data-v="0.500"'));
assert.ok(rows[1].includes('class="hm-c hm-na"'), "player with no log: grey cells");
assert.ok(/data-m="threes" data-w="5" data-v="" title="no data">—/.test(rows[3]), "log without threes: grey threes cell");
// free view: only public ids get a row
const ids = publicIds(logBoard);
assert.equal(ids.size, 3, "3 free players in the one game");
const freeHm = renderHeatmapSection(logBoard, { ids });
assert.equal(freeHm.match(/<tr data-game/g).length, 3);

// player body with a log
const body = renderPlayerBody(findPlayer(logBoard, "realname-alpha"), { teamHref: "/nba/team/oklahoma-city-thunder" });
assert.ok(body.includes('href="/nba/team/oklahoma-city-thunder"'), "team links to its team page");
assert.ok(body.includes("Last 10 games") && (body.match(/<tr><td class="mono">/g) || []).length === 10);
assert.ok(body.includes("Game by game") && (body.match(/<figure class="bc"/g) || []).length === 4, "one chart per market");
assert.equal((body.match(/<figure class="bc" hidden/g) || []).length, 3, "first market shown, others hidden");
assert.equal((body.match(/class="bc-(over|under)"/g) || []).length, 4 * 12 - 2, "bars per game per market (2 games without assists)");
assert.ok(body.includes("Hit rates") && body.includes("100%<small>5/5</small>") && body.includes("42%<small>5/12</small>"));

// copy rules on every new piece
for (const h of [hm, body, bodyNoLog]) {
  const text = h.replace(/<[^>]+>/g, " ");
  assert.ok(!/\btips?\b|bet this|units?\b|\bedge\b|fair|\bmodel\b|method|projection|value|p_over|sigma/i.test(text), "banned copy: " + text.match(/\btips?\b|bet this|units?\b|\bedge\b|fair|\bmodel\b|method|projection|value|p_over|sigma/i));
  assert.ok(!/\bproj\b/.test(h) && !/(^|\s)0\.6\b|60%(?!<small>)/.test(text), "no projection numbers or probabilities");
}

// board names link to player pages
assert.ok(renderCards(noLogBoard, { full: true }).includes('<a class="pp-name" href="/props/nba/player/realname-delta">Realname Delta</a>'));

// ---------------------------------------------------------------- routes (no network)
const snap = { row: null };
globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  const auth = new Headers(init.headers || {}).get("authorization") || "";
  const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
  if (url.includes("/rest/v1/tips_page_snapshot")) { assert.ok(url.includes("id=eq.nba-props")); return j(snap.row ? [snap.row] : []); }
  if (url.includes("/auth/v1/user")) return auth === "Bearer member-token" ? j({ email: "m@example.test" }) : j({}, 401);
  if (url.includes("/rest/v1/member_allowlist")) return j(auth === "Bearer member-token" ? [{ role: "member" }] : []);
  throw new Error("unexpected fetch in test (no odds calls allowed): " + url);
};
const ctx = (url, params = {}, headers = {}) => ({
  request: new Request(url, { headers }), params, now: NOW,
  env: { SUPABASE_SERVICE_ROLE_KEY: "k", ASSETS: { fetch: async () => new Response(fs.readFileSync(new URL("../data/nba_points_props/board.json", import.meta.url))) } },
});
const use = (b) => { snap.row = { payload: b, generated_at: GEN }; _resetBoardCache(); };

use(noLogBoard);
let r = await page(ctx("https://x.test/props/nba"));
let h = await r.text();
assert.equal(r.status, 200);
assert.ok(h.includes('<div id="propsHeatmap"></div>'), "heatmap hidden on the live shape (no game logs)");

use(logBoard);
h = await (await page(ctx("https://x.test/props/nba"))).text();
assert.ok(h.includes('id="hitRates"'), "heatmap shown once logs exist");
assert.equal((h.split('id="propsHeatmap"')[1].match(/<tr data-game/g) || []).length, 3, "public heatmap = free players only");
assert.ok(!h.split('id="propsHeatmap"')[1].includes("Realname Foxtrot") || ids.has("realname-foxtrot"));
const mem = await (await boardApi(ctx("https://x.test/api/props-nba", {}, { authorization: "Bearer member-token" }))).json();
assert.equal((mem.heatmap.match(/<tr data-game/g) || []).length, 6, "members heatmap = everyone");

// public player page
const pub = [...ids][0];
r = await playerPage(ctx(`https://x.test/props/nba/player/${pub}`, { id: pub }));
h = await r.text();
assert.equal(r.status, 200);
const pubName = findPlayer(logBoard, pub).player;
assert.ok(h.includes(`<h1>${pubName}</h1>`) && h.includes("team-hero") && h.includes("Season averages"));
assert.ok(h.includes("/props-player.js"));

// gated player page: no real name, numbers or status
const gated = findPlayer(logBoard, "realname-golf") ? null : ["realname-alpha", "realname-bravo", "realname-charlie", "realname-delta", "realname-echo", "realname-foxtrot"].find((x) => !ids.has(x));
r = await playerPage(ctx(`https://x.test/props/nba/player/${gated}`, { id: gated }));
h = await r.text();
assert.equal(r.status, 200);
const gName = findPlayer(logBoard, gated).player;
const visible = h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/data-player="[^"]*"/, "");
assert.ok(!visible.includes(gName), "gated page leaks no name");
assert.ok(!/Season averages|Today's line|Hit rates/.test(visible), "gated page leaks no data");
assert.ok(h.includes("Join members") && h.includes('name="robots" content="noindex"'));
assert.equal((await playerApi(ctx(`https://x.test/api/props-nba-player?id=${gated}`))).status, 401, "player API needs a member");
const pj = await (await playerApi(ctx(`https://x.test/api/props-nba-player?id=${gated}`, {}, { authorization: "Bearer member-token" }))).json();
assert.ok(pj.ok && pj.name === gName && pj.html.includes("Season averages") && pj.hero.includes(gName));

// unknown / Out players: not on today's board
for (const id of ["nobody-here", "realname-golf"]) {
  r = await playerPage(ctx(`https://x.test/props/nba/player/${id}`, { id }));
  assert.equal(r.status, 404, id);
  assert.ok((await r.text()).includes("Not on today's board"));
}

console.log("nba-player-props tests passed");
