// NBA props prices + strip counts.
// Fixture tests/fixtures/nba-props-merged.json = the mini job's sample board (fictional players) after the real
// merge_books.add_books() ran on the offline Odds API fixtures (no network): stats.<stat>.books / books_us / best.
// 1) With books on the board, /props/nba shows the best AU Over and Under with the bookie name, like NHL.
// 2) A board without books (what the live nba-props row held on 18 Nov) shows "No AU price", never a fake price.
// 3) The strip's player count is the players with a card in the view (free view or members), on NBA and NHL.
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderPanels, viewPlayerCount, boardHasBooks } from "../functions/_shared/nba-props.js";
import { renderSportBoard, boardCounts } from "../functions/_shared/sport-props.js";
import { bestBook } from "../functions/_shared/prop-cards.js";

const items = (h) => [...h.matchAll(/class="pp-pv"[^>]*>(.*?)<\/script>/gs)].flatMap((m) => Object.values(JSON.parse(m[1])));
const cards = (h) => (h.match(/<article class="ppc /g) || []).length;
const cardPlayers = (h) => new Set(items(h).map((i) => i.player)).size;

const merged = { ...JSON.parse(fs.readFileSync("tests/fixtures/nba-props-merged.json", "utf8")), sample: false };
assert.ok(boardHasBooks(merged), "merged board carries AU prices");

for (const full of [false, true]) {
  const h = renderPanels(merged, { full });
  const its = items(h);
  assert.equal(cards(h), its.length, "one card per item");
  // 1) every priced item: best AU Over / Under = highest price, with the bookie name under it
  const priced = its.filter((i) => !i.no_au_price);
  assert.ok(priced.length >= its.length - 2, `${full ? "members" : "free"}: almost every row priced`);
  for (const it of priced) {
    const o = bestBook(it.books, "over"), u = bestBook(it.books, "under");
    assert.ok(o && u, `${it.player} ${it.market}: both sides priced`);
    assert.ok(it.books.every((b) => b.over <= o.over && b.under <= u.under), "best = highest price per side");
  }
  const sample = priced[0], o = bestBook(sample.books, "over"), u = bestBook(sample.books, "under");
  assert.ok(h.includes(`<small>Over</small><b>${o.over.toFixed(2)}</b><span>${o.name}</span>`), "card: best Over + bookie");
  assert.ok(h.includes(`<small>Under</small><b>${u.under.toFixed(2)}</b><span>${u.name}</span>`), "card: best Under + bookie");
  assert.match(h, /Best other<small>Over · Under<\/small>/, "table price columns on, as on NHL");
  assert.doesNotMatch(h, /\b(units?|stake|edge|fair price|tip)\b/i, "data only: no tips, units, edge or fair price");
  // lights: props scale from lights.json, decided on the shown (floored) %
  for (const it of its.filter((i) => i.pred)) {
    const shown = Math.floor(it.pred.p * 100 + 1e-9);
    assert.equal(it.light, shown >= 60 ? "GREEN" : shown >= 55 ? "ORANGE" : "RED", `${it.player}: ${shown}% -> ${it.light}`);
  }
  // 3) strip count = players with a card
  assert.equal(viewPlayerCount(merged, { full }), cardPlayers(h), `${full ? "members" : "free"}: strip players = card players`);
}
assert.ok(viewPlayerCount(merged, { full: false }) < viewPlayerCount(merged, { full: true }), "free view counts fewer players than members");

// 2) the live nba-props row of 18 Nov had no books at all: every card says No AU price
const stripBooks = (b) => ({ ...b, games: b.games.map((g) => ({ ...g, players: g.players.map((p) => ({ ...p,
  stats: Object.fromEntries(Object.entries(p.stats).filter(([, s]) => s.proj != null).map(([k, s]) => [k, { season_avg: s.season_avg, line: s.line, proj: s.proj, sigma: s.sigma, p_over: s.p_over, p_under: s.p_under }])) })) })) });
const bare = stripBooks(merged);
assert.equal(boardHasBooks(bare), false);
const hb = renderPanels(bare, { full: false });
assert.ok(items(hb).length && items(hb).every((i) => i.no_au_price && !i.books.length), "no books -> no_au_price, books []");
assert.doesNotMatch(hb, /Best other/, "no price columns without prices");

// 3) NHL / NFL strip: players with a card (free view), not every player on the board
for (const sport of ["nhl", "nfl"]) {
  const board = JSON.parse(fs.readFileSync(`data/${sport}_props/board.json`, "utf8"));
  for (const full of [false, true]) {
    const h = renderSportBoard(sport, board, { full });
    assert.equal(boardCounts(board, { full }).players, cardPlayers(h), `${sport} ${full ? "members" : "free"}: strip players = card players`);
  }
  const all = new Set(board.games.flatMap((g) => (g.props || []).map((r) => r.player))).size;
  assert.equal(boardCounts(board, { full: true }).players, all, `${sport}: members count every player`);
}

// client: the members swap updates the strip from the API's count
const js = fs.readFileSync("props-nba.js", "utf8");
assert.match(js, /getElementById\("ppPlayers"\)/);
assert.match(js, /j\.players/);
console.log("props-nba-prices: ok");
