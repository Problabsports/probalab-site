// Round 2 props cards + player view: one best price per side, simple card, player view data, NBA parity, data-only copy.
import assert from "node:assert/strict";
import fs from "node:fs";
import { bestBook, countHits, itemFromSportRow, itemFromNbaRow, cardHtml, pvScript, miniChart } from "../functions/_shared/prop-cards.js";
import { renderSportBoard, freeRowKeys } from "../functions/_shared/sport-props.js";
import { renderPanels } from "../functions/_shared/nba-props.js";

const books = [{ key: "sportsbet", name: "Sportsbet", over: 1.9, under: 1.85 }, { key: "pointsbetau", name: "PointsBet", over: 1.9, under: 1.88 },
  { key: "tab", name: "TAB", over: 1.95, under: 1.8 }, { key: "neds", name: "Neds", over: null, under: 1.92 }];
assert.equal(bestBook(books, "over").key, "tab", "highest Over across every bookie");
assert.equal(bestBook(books, "under").key, "neds");
assert.equal(bestBook([{ key: "pointsbetau", name: "P", over: 2 }, { key: "sportsbet", name: "S", over: 2 }], "over").key, "sportsbet", "Sportsbet wins ties");
assert.equal(bestBook([], "over"), null);
assert.deepEqual(countHits([30, 20, 26, 25, 10, 40], 25.5).l5, { n: 5, over: 2, under: 3 });

const ou = itemFromSportRow("nfl", { player: "Brock Ellery", team: "San Francisco 49ers", team_abbr: "SF", position: "QB", kind: "ou", line: 267.5, books,
  log: [{ date: "2026-11-15", opp: "ATL", ha: "A", v: 280 }, { date: "2026-11-08", opp: "DEN", ha: "H", v: 240 }], season: { gp: 9, avg: 262 },
  hits: { l5: { n: 5, over: 3, under: 2 }, l10: { n: 9, over: 5, under: 4 }, season: { n: 9, over: 5, under: 4 } } }, "Passing yards", "ORANGE", "Over");
const card = cardHtml(ou, "g1-0", 'data-team="San Francisco 49ers" data-market="player_pass_yds" data-light="ORANGE"');
assert.match(card, /data-pv-open="g1-0"/, "player name opens the player view");
assert.match(card, /<b>Brock Ellery<\/b><small>SF · QB<\/small>/);
assert.match(card, /\/img\/logos\/nfl\/san-francisco-49ers\.png/);
assert.match(card, /Passing yards <b>267\.5<\/b>/, "market + line on one line");
assert.match(card, /<small>Over<\/small><b>1\.95<\/b><span>TAB<\/span>/, "best Over with bookie name");
assert.match(card, /<small>Under<\/small><b>1\.92<\/b><span>Neds<\/span>/, "best Under with bookie name");
assert.ok(!/Best other|Sportsbet<\/th>|class="pp-price/.test(card), "no Sportsbet column or best-other block on the card");
assert.match(card, /<small>L5<\/small><b>60%<\/b>/);
assert.match(card, /class="ppc-chart"/);
// Chance: SB 1.90 / 1.85 with the margin out = 0.4933 Over, moved toward 5 of 9: (5 + 4.933) / 19 = 52% -> RED (season rate alone was 55% ORANGE)
assert.match(card, /chip RED/);
assert.match(card, /<span class="ppc-pred ppc-chance hl-RED">Chance <b>Over<\/b> · <b>52%<\/b><\/span>/, "one Chance line on the card");
assert.deepEqual(Object.keys(ou.chance).sort(), ["p", "side"], "item.chance carries only side and p");

const yes = itemFromSportRow("nhl", { player: "Jared Mann", team: "Seattle Kraken", team_abbr: "SEA", position: "C", kind: "yes", line: null,
  books: [{ key: "sportsbet", name: "Sportsbet", yes: 2.98 }, { key: "pointsbetau", name: "PointsBet", yes: 3.1 }],
  log: [{ v: 1 }, { v: 0 }], rates: { l8: { n: 8, yes: 5 }, season: { n: 20, yes: 9 } } }, "Anytime goal scorer", "", "");
const ycard = cardHtml(yes, "g2-0", "");
assert.equal(yes.chance, null, "anytime rows have no Chance");
assert.ok(!/ppc-pred/.test(ycard), "no Chance line on anytime cards");
assert.match(ycard, /<small>Best price<\/small><b>3\.10<\/b><span>PointsBet<\/span>/);
assert.match(ycard, /<small>Implied chance<\/small><b>32%<\/b>/);
assert.match(ycard, /Scored L8<\/small><b>62%<\/b>/);
assert.match(ycard, /Season<\/small><b>45%<\/b>/);
assert.match(miniChart(yes), /<circle/);

// player view data: every bookie for that prop, valid JSON, no "<" breaking out of the script tag
const pv = pvScript("g1", [["g1-0", ou]]);
const data = JSON.parse(pv.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
assert.equal(data["g1-0"].books.length, 4, "all bookies in the player view");
assert.ok(!pv.slice(pv.indexOf(">") + 1, -9).includes("<"));

// boards: cards + one JSON block per game, only the rows this viewer can see
const nfl = JSON.parse(fs.readFileSync(new URL("../data/nfl_props/board.json", import.meta.url)));
const free = renderSportBoard("nfl", nfl, { full: false });
const freeIds = nfl.games.reduce((n, g) => n + freeRowKeys(g).size, 0);
assert.equal((free.match(/class="ppc lt-/g) || []).length, freeIds, "one card per visible row");
const pvBlocks = [...free.matchAll(/<script type="application\/json" class="pp-pv"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
assert.equal(pvBlocks.reduce((n, b) => n + Object.keys(b).length, 0), freeIds, "player view data only for visible rows (no member rows leak)");
const full = renderSportBoard("nfl", nfl, { full: true });
assert.equal((full.match(/class="ppc lt-/g) || []).length, nfl.games.reduce((n, g) => n + g.props.length, 0));
assert.match(free, /class="pp-name pp-pv-btn" data-pv-open=/, "desktop table name opens the same view");

// NBA: same card + player view; prediction kept; form from game_log
const nbaRow = { player: "Marcus Vale", team: "Boston Celtics", stat: "points", light: "GREEN",
  s: { line: 25.5, side: "Over", p: 0.68, avg: 26.1, books: [{ key: "sportsbet", name: "Sportsbet", over: 1.65, under: 2.2 }] },
  game_log: [{ date: "2026-11-10", opp: "MIA", home: true, points: 30 }, { date: "2026-11-12", opp: "NY", home: false, points: 22 }] };
const nb = itemFromNbaRow(nbaRow, "Points", "BOS");
assert.equal(nb.log[0].date, "2026-11-12", "newest first");
assert.deepEqual(nb.hits.season, { n: 2, over: 1, under: 1 });
const ncard = cardHtml(nb, "s-0", "");
assert.match(ncard, /Prediction <b>Over<\/b> · <b>68%<\/b>/);
assert.match(ncard, /\/img\/logos\/nba\/boston-celtics\.png/);
const nbaBoard = JSON.parse(fs.readFileSync(new URL("../data/nba_points_props/board.json", import.meta.url)));
const nbaHtml = renderPanels(nbaBoard, { full: false });
assert.ok(/class="ppc lt-/.test(nbaHtml) && /class="pp-pv"/.test(nbaHtml), "NBA board has cards and player view data");
assert.match(nbaHtml, /Prices appear once this line is posted\./, "NBA board without prices says so on the card");

// data only: no tips, units, edge, fair price or value wording in cards or player view data
for (const h of [card, ycard, ncard, free, nbaHtml]) {
  const text = h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
  for (const w of [/\bvalue\b/i, /\bedge\b/i, /fair price/i, /\bunits?\b/i, /\btips?\b/i, /\bstake\b/i]) assert.ok(!w.test(text), String(w));
}
const client = fs.readFileSync(new URL("../props-cards.js", import.meta.url), "utf8");
for (const w of [/\bvalue\b/i, /\bedge\b/i, /fair price/i, /\bunits?\b/i, /\btips?\b/i]) assert.ok(!w.test(client.replace(/\/\*[\s\S]*?\*\//g, "")), "player view copy: " + w);
assert.match(client, /Highest price per side highlighted/);
console.log("prop-cards tests passed");
