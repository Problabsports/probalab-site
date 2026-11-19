// NFL / NHL props pages (data only): sample vs real board, empty board, free view limit, Sportsbet first and best
// other price, yes-only markets with implied chance, last-8 chart, hit rates, member API, fixture guard, nav, wording.
import assert from "node:assert/strict";
import fs from "node:fs";
import { onRequestGet as nflPage } from "../functions/props/nfl.js";
import { onRequestGet as nhlPage } from "../functions/props/nhl.js";
import { onRequestGet as nbaPage } from "../functions/props/nba.js";
import { onRequestGet as nflApi } from "../functions/api/props-nfl.js";
import { onRequestGet as nflData } from "../functions/data/nfl_props/[[path]].js";
import {
  SPORTS, realSportBoard, hitLight, rateLight, bookSplit, freeRowKeys, formChart, renderSportBoard, propRow, _resetSportBoardCache,
} from "../functions/_shared/sport-props.js";
import { bookCells, boardHasBooks } from "../functions/_shared/nba-props.js";
import { NAV_SPORTS } from "../functions/_shared/site.js";

const NOW = Date.parse("2026-11-20T02:00:00Z");
const boards = { nfl: JSON.parse(fs.readFileSync(new URL("../data/nfl_props/board.json", import.meta.url))), nhl: JSON.parse(fs.readFileSync(new URL("../data/nhl_props/board.json", import.meta.url))) };
const snap = { rows: {} };
globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  const auth = new Headers(init.headers || {}).get("authorization") || "";
  const j = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (url.includes("/rest/v1/tips_page_snapshot")) {
    const id = (url.match(/id=eq\.([a-z-]+)/) || [])[1];
    assert.equal(auth, "Bearer test-service-key");
    return j(snap.rows[id] ? [snap.rows[id]] : []);
  }
  if (url.includes("/auth/v1/user")) return auth === "Bearer member-token" ? j({ email: "m@example.test" }) : j({ msg: "bad" }, 401);
  if (url.includes("/rest/v1/member_allowlist")) return j(auth === "Bearer member-token" ? [{ role: "member" }] : []);
  throw new Error("unexpected fetch " + url);
};
const ctx = (url, sport, headers = {}, params = {}) => ({
  request: new Request(url, { headers }), params, now: NOW,
  env: { SUPABASE_SERVICE_ROLE_KEY: "test-service-key", ASSETS: { fetch: async (u) => {
    const p = new URL(u).pathname;
    if (p.startsWith("/data/nba_points_props/")) return new Response(fs.readFileSync(new URL("../data/nba_points_props/board.json", import.meta.url)));
    return new Response(JSON.stringify(boards[sport] || boards.nfl), { headers: { "content-type": "application/json" } });
  } } },
});
const main = (h) => h.slice(h.indexOf("<main"), h.indexOf("</main>"));

// ---- sample board (no Supabase row yet): shown, marked sample, noindex
for (const [sport, page] of [["nfl", nflPage], ["nhl", nhlPage]]) {
  snap.rows = {}; _resetSportBoardCache();
  const r = await page(ctx(`https://x.test/props/${sport}`, sport));
  const h = await r.text(), m = main(h);
  assert.equal(r.status, 200);
  assert.ok(m.includes("Sample data") && h.includes('content="noindex"'), `${sport} sample is marked and noindex`);
  assert.ok(m.includes(`<h1>${SPORTS[sport].name} player props</h1>`));
  for (const id of ["ppGame", "ppTeam", "ppMarket", "ppLights", "ppLegend"]) assert.ok(m.includes(`id="${id}"`), `${sport} filter ${id}`);
  assert.ok(m.includes('data-basis="chance"') && m.includes("Lights use the Chance") && m.includes("60%+") && m.includes("55–59%"), "props scale key on the Chance");
  assert.ok(m.includes(`data-api="/api/props-${sport}"`), "member swap endpoint");
  assert.ok(m.includes('class="pp-sports') && m.includes('href="/props/nba"') && m.includes('href="/props/nhl"'), "sport switch");
  assert.ok(m.includes("<th scope=\"col\" class=\"num\">Sportsbet") && m.includes("Best other"), "price columns");
  assert.ok(m.includes('class="pp-form"'), "last 8 chart");
  assert.ok(/\/img\/logos\/(nfl|nhl)\/[a-z0-9-]+\.png/.test(m), "team logos");
  // data only: none of these words anywhere in the page body
  const visible = m.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
  for (const w of [/\bvalue\b/i, /\bedge\b/i, /fair price/i, /\bunits?\b/i, /\btip\b/i, /\bstake\b/i, /model chance/i]) assert.ok(!w.test(visible), `${sport}: ${w}`);
  // free view: at most 3 players per market per game, and the gate counts the rest
  for (const g of boards[sport].games) {
    const keys = freeRowKeys(g);
    const per = {};
    for (const k of keys) { const mk = k.split("|")[1]; per[mk] = (per[mk] || 0) + 1; }
    assert.ok(Object.values(per).every((n) => n <= 3), "3 per market");
    if (g.props.length > keys.size) assert.ok(m.includes(`${g.props.length - keys.size} more prop`));
  }
}

// ---- yes-only rows: price per book + implied chance; scoring rates last 8 / season
const nhlYes = boards.nhl.games[0].props.find((r) => r.kind === "yes");
const yesHtml = propRow("nhl", nhlYes);
assert.ok(/<b>\d+\.\d\d<\/b><small>\d+% implied<\/small>/.test(yesHtml), "Sportsbet price + implied chance");
assert.ok(/<small>[A-Za-z0-9 ]+ · \d+%<\/small>/.test(yesHtml), "best other book + implied chance");
assert.ok(/last \d+<\/small>/.test(yesHtml) && /<td class="num pp-chance( hl-(GREEN|ORANGE|RED))?"><b>\d+%<\/b><small>implied<\/small><\/td>/.test(yesHtml), "scoring rate last 8; implied % in the Chance column, coloured by the scoring-rate light");
assert.match(formChart(nhlYes), /<circle/);

// ---- O/U: Sportsbet first, best other per side, light on the Chance
const row = { kind: "ou", line: 24.5, books: [{ key: "tab", name: "TAB", over: 1.95, under: 1.8 }, { key: "sportsbet", name: "Sportsbet", over: 1.87, under: 1.87 }, { key: "neds", name: "Neds", over: 1.9, under: 1.91 }],
  hits: { l5: { n: 5, over: 4, under: 1 }, l10: { n: 10, over: 6, under: 4 }, season: { n: 12, over: 4, under: 8 } }, log: [{ v: 30 }, { v: 10 }, { v: 24.5 }], season: { gp: 12, avg: 22 } };
const sp = bookSplit(row);
assert.equal(sp.sb.key, "sportsbet");
assert.equal(sp.over.key, "tab", "best other Over");
assert.equal(sp.under.key, "neds", "best other Under");
// Chance: Sportsbet 1.87 / 1.87 -> 0.5 with the margin out; Under (8 + 10 * 0.5) / (12 + 10) = 59% -> ORANGE (season rate alone: 66% green)
assert.deepEqual(hitLight(row, "nfl"), { light: "ORANGE", side: "Under", p: 13 / 22 });
assert.equal(hitLight({ hits: { season: { n: 4, over: 4, under: 0 } } }).light, "", "under 5 games: no light");
// lights.json: the shown % is rounded down and decides the light (59.5% shows 59%, orange)
assert.deepEqual([rateLight(0.6), rateLight(0.595), rateLight(0.55), rateLight(0.544)], ["GREEN", "ORANGE", "ORANGE", "RED"]);
const cells = propRow("nfl", { ...row, player: "P", market: "player_pass_yds" });
assert.ok(cells.includes('<td class="num pp-chance hl-ORANGE"><b>Under 59%</b></td>'), "Chance cell: side + shown %");
assert.ok(cells.includes('<td class="num pp-hit"><b>20%</b><small>1/5</small>'), "hit cells follow the Chance side (Under: 1 of 5 = 20%) and are neutral");
assert.ok(cells.includes('<td class="num pp-hit"><b>66%</b><small>8/12</small>') && !/pp-hit hl-/.test(cells), "season Under 8/12, no light colour on hit numbers");
const ch = formChart(row);
assert.ok(ch.includes('class="pf-over"') && ch.includes('class="pf-under"') && ch.includes('class="pf-push"') && ch.includes('class="pf-line"'));

// ---- real board from Supabase: used when fresh, even with no games (empty message, not the sample)
snap.rows = { "nfl-props": { payload: { ...boards.nfl, sample: false, generated_at: "2026-11-20T01:00:00Z" }, generated_at: "2026-11-20T01:00:00Z" } }; _resetSportBoardCache();
let h = main(await (await nflPage(ctx("https://x.test/props/nfl", "nfl"))).text());
assert.ok(!h.includes("Sample data") && h.includes("pp-game"));
snap.rows = { "nfl-props": { payload: { schema: "props-board-v1", sport: "nfl", games: [], generated_at: "2026-11-20T01:00:00Z" } } }; _resetSportBoardCache();
h = main(await (await nflPage(ctx("https://x.test/props/nfl", "nfl"))).text());
assert.ok(h.includes(SPORTS.nfl.empty) && !h.includes("Sample data") && !h.includes('id="ppGame"'), "empty board message");
assert.equal(realSportBoard({ payload: { games: [], generated_at: "2026-11-18T00:00:00Z" } }, NOW), null, "36 h+ old board is not used");
assert.equal(realSportBoard({ payload: { games: [], sample: true, generated_at: "2026-11-20T01:00:00Z" } }, NOW), null);
// started games drop off after 3 h
snap.rows = { "nfl-props": { payload: { ...boards.nfl, generated_at: "2026-11-20T01:00:00Z" } } }; _resetSportBoardCache();
const later = { ...ctx("https://x.test/props/nfl", "nfl"), now: Date.parse("2026-11-28T00:00:00Z") };
assert.ok(main(await (await nflPage(later)).text()).includes(SPORTS.nfl.empty), "games 3 h past the start drop off");

// ---- member API and fixture guard
snap.rows = {}; _resetSportBoardCache();
assert.equal((await nflApi(ctx("https://x.test/api/props-nfl", "nfl"))).status, 401);
const api = await (await nflApi(ctx("https://x.test/api/props-nfl", "nfl", { authorization: "Bearer member-token" }))).json();
const allRows = boards.nfl.games.reduce((n, g) => n + g.props.length, 0);
assert.ok(api.ok && (api.html.match(/class="pp-row (?!pp-locked)/g) || []).length === allRows, "members get every row");
assert.equal((await nflData(ctx("https://x.test/data/nfl_props/board.json", "nfl", {}, { path: ["board.json"] }))).status, 404, "raw sample is members-only");

// ---- NBA: price columns appear only when the board carries prices
assert.equal(boardHasBooks({ games: [{ players: [{ stats: { points: { line: 20.5, proj: 22, p_over: 0.6, p_under: 0.4 } } }] }] }), false);
assert.equal(boardHasBooks({ games: [{ players: [{ stats: { points: { line: 20.5, proj: 22, p_over: 0.6, p_under: 0.4, books: [{ key: "sportsbet", name: "Sportsbet", over: 1.9, under: 1.9 }] } } }] }] }), true);
assert.match(bookCells([{ key: "neds", name: "Neds", over: 1.95, under: 1.8 }, { key: "sportsbet", name: "Sportsbet", over: 1.87, under: 1.9 }]), /<b>1\.87<\/b><b>1\.90<\/b>[\s\S]*<b>1\.95<\/b><b>1\.80<\/b>[\s\S]*Neds/);
const nbaH = main(await (await nbaPage(ctx("https://x.test/props/nba", "nba"))).text());
assert.ok(nbaH.includes('class="pp-sports') && !nbaH.includes("Best other"), "NBA: sport switch; no empty price columns while the NBA board has no prices");

// ---- nav and empty-board text
assert.ok(NAV_SPORTS.some(([h]) => h === "/props/nfl") && NAV_SPORTS.some(([h]) => h === "/props/nhl"));
for (const f of ["index.html", "404.html", "contact.html", "privacy.html", "terms.html"]) {
  const s = fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
  assert.ok(s.includes('href="/props/nfl"') && s.includes('href="/props/nhl"'), f);
}
assert.ok(renderSportBoard("nhl", { games: [] }).includes(SPORTS.nhl.empty));
console.log("sport-props tests passed");
