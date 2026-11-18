// Green first: an NBA pick in the green range (65%+ shown) is GREEN even when the price also beats our fair price.
// It keeps a small "Best value" tag, counts once in the green record and never in the Best value record.
// The Best value light and record are Best value picks below the green range only (60–64% in the NBA).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { gamesOf, gameRow, renderGame, renderToday } from "../functions/_shared/site.js";
import { rowsFromFeed, lightTally, tally, renderResultsPage, filterResultRows } from "../functions/_shared/record-pages.js";
import { matchesLightFilter, sortGreenFirst, renderFilterBar } from "../functions/_shared/game-filters.js";
import * as S from "../functions/_shared/lights.js";

const require = createRequire(import.meta.url);
const P = require("../phone-core.js");
const NOT_SUPER = /\bSuper\b(?! Bowl)/;

const day = (d, h = 0) => new Date(Date.UTC(2026, 10, d, h)).toISOString();
const soon = new Date(Date.now() + 6 * 3600e3).toISOString();
const base = { season: 2027, status: "post", first_posted: day(1) };
const feed = {
  season: 2027,
  games: [
    // settled: a 77% Best value pick that won, and a 60% Best value pick that lost
    { ...base, game_id: "9001", start_utc: day(10), home: "LAC", away: "SA", pick: "LAC", pick_p: 0.77, light: "SUPER", won: true, home_score: 112, away_score: 101 },
    { ...base, game_id: "9002", start_utc: day(11), home: "MIA", away: "ORL", pick: "MIA", pick_p: 0.60, light: "SUPER", won: false, home_score: 98, away_score: 104 },
    // a plain green and a red, so the totals are not just the two above
    { ...base, game_id: "9003", start_utc: day(12), home: "BOS", away: "NY", pick: "BOS", pick_p: 0.70, light: "GREEN", won: true, home_score: 110, away_score: 99 },
    { ...base, game_id: "9004", start_utc: day(13), home: "DAL", away: "HOU", pick: "DAL", pick_p: 0.52, light: "RED", won: false, home_score: 90, away_score: 95 },
    // upcoming: Clippers 77% and Lakers 76% (the reported case), and a 61% Best value
    { season: 2027, status: "pre", game_id: "9101", start_utc: soon, home: "LAC", away: "DEN", pick: "LAC", pick_p: 0.775, light: "SUPER", won: null },
    { season: 2027, status: "pre", game_id: "9102", start_utc: soon, home: "LAL", away: "PHX", pick: "LAL", pick_p: 0.763, light: "SUPER", won: null },
    { season: 2027, status: "pre", game_id: "9103", start_utc: soon, home: "CHI", away: "ATL", pick: "CHI", pick_p: 0.61, light: "SUPER", won: null },
  ],
};

// ---------------------------------------------------------------- the light and the tag
const data = gamesOf("nba", feed);
const byId = Object.fromEntries(data.games.map((g) => [g.game_id, g]));
assert.equal(byId["9001"].light, "GREEN", "77% Best value → green light");
assert.equal(byId["9001"].best_value, true, "77% keeps the Best value tag");
assert.equal(byId["9002"].light, "SUPER", "60% Best value → Best value light");
assert.equal(byId["9002"].best_value, true);
assert.equal(byId["9003"].best_value, false, "plain green has no tag");
assert.equal(byId["9101"].light, "GREEN", "Clippers 77% → green");
assert.equal(byId["9102"].light, "GREEN", "Lakers 76% → green");
assert.equal(byId["9103"].light, "SUPER", "61% → Best value");
// the boundary is the shown (rounded-down) chance
assert.equal(S.shownLight("nba", "SUPER", 0.6499), "SUPER");
assert.equal(S.shownLight("nba", "SUPER", 0.65), "GREEN");

// ---------------------------------------------------------------- rendering: green light + small Best value tag
const rowHtml = gameRow(byId["9101"]);
assert.match(rowHtml, /class="chip GREEN">Green<\/span><span class="bv-tag"[^>]*>Best value<\/span>/, "sport page row: green chip then Best value tag");
assert.doesNotMatch(gameRow(byId["9103"]), /bv-tag/, "the Best value light needs no extra tag");
assert.match(gameRow(byId["9103"]), /class="chip SUPER">Best value<\/span>/);
assert.doesNotMatch(gameRow(byId["9003"]), /bv-tag/);
const gamePage = renderGame(byId["9101"], data.games, {});
assert.match(gamePage, /<dt>Light<\/dt><dd><span class="chip GREEN">Green<\/span><span class="bv-tag"/, "game page: green light + tag");
assert.doesNotMatch(gamePage, NOT_SUPER);
const today = renderToday("nba", data, "https://probalabsports.com/nba/today");
assert.match(today, /bv-tag/);
assert.doesNotMatch(today, NOT_SUPER);

// ---------------------------------------------------------------- records: counted once, green first
const rows = rowsFromFeed("nba", data);
assert.equal(rows.length, 4);
const green = lightTally(rows, "GREEN"), bv = lightTally(rows, "SUPER");
assert.deepEqual(green, { n: 2, w: 2 }, "green record = the 77% Best value pick + the plain green");
assert.deepEqual(bv, { n: 1, w: 0 }, "Best value record = only the 60% pick");
assert.equal(rows.filter((r) => r.id === "9001").length, 1, "the 77% pick is one row");
assert.equal(green.n + bv.n, rows.filter((r) => r.light === "GREEN" || r.light === "SUPER").length, "no double counting");
assert.equal(tally(rows).byLight.SUPER.n, 1);
assert.equal(tally(rows).byLight.GREEN.n, 2);

// ---------------------------------------------------------------- filters
const ids = (xs) => xs.map((r) => r.id).sort();
assert.deepEqual(ids(filterResultRows(rows, { light: "green" })), ["9001", "9002", "9003"], "Green + Best value list");
assert.deepEqual(ids(filterResultRows(rows, { light: "super" })), ["9001", "9002"], "Best value filter shows every Best value tag");
assert.deepEqual(ids(filterResultRows(rows, { light: "orange" })), []);
const view = { sport: "nba", name: "NBA", season: "2026–27", rows };
const resGreen = renderResultsPage([view], { sport: "all", light: "green" });
assert.ok(resGreen.includes("2 of 2"), "green headline 2 of 2");
assert.doesNotMatch(resGreen, NOT_SUPER);
const resSuper = renderResultsPage([view], { sport: "nba", light: "super" });
assert.match(resSuper, /Showing <b>2<\/b> of 4 finished picks · 0 of 1 right \(0%\) below the green range/, "Best value filter record counts only below-green picks");
assert.match(resSuper, /class="small muted bv-filter-note">Includes green picks tagged Best value/);
assert.doesNotMatch(resSuper, NOT_SUPER);
// upcoming-game filters (Today, sport pages, Home share the rule)
const up = data.games.filter((g) => g.status === "pre");
assert.deepEqual(up.filter((g) => matchesLightFilter(g, "green")).map((g) => g.game_id), ["9101", "9102", "9103"]);
assert.deepEqual(up.filter((g) => matchesLightFilter(g, "super")).map((g) => g.game_id), ["9101", "9102", "9103"]);
assert.equal(matchesLightFilter("SUPER", "super"), true, "a bare light still works");
assert.deepEqual(sortGreenFirst([byId["9103"], byId["9101"]]).map((g) => g.light), ["GREEN", "SUPER"], "green first");
assert.match(renderFilterBar({ sport: "nba", light: "super" }), /filter-note muted">Every NBA game tagged Best value, green ones included/);
assert.doesNotMatch(renderFilterBar({ sport: "all", light: "green" }), NOT_SUPER);
// phone: Today chip counts use the same rule
const phoneRows = [
  P.rowFromParts({ sport: "nba", chipClass: "chip GREEN", bestValue: true, pickText: "LA Clippers 77%", matchText: "A @ B" }),
  P.rowFromParts({ sport: "nba", chipClass: "chip SUPER", pickText: "Chicago Bulls 61%", matchText: "C @ D" }),
  P.rowFromParts({ sport: "nba", chipClass: "chip GREEN", pickText: "Boston Celtics 70%", matchText: "E @ F" }),
];
assert.equal(P.sportCounts(phoneRows, "green").nba.shown, 3);
assert.equal(P.sportCounts(phoneRows, "super").nba.shown, 2);
assert.match(P.cardHtml(phoneRows[0]), /pf-card pf-l-GREEN".*pf-bv">Best value/s);

// phone sport pages (the shared game card): green light + small Best value tag
const hub = P.hubRowFromParts({ sport: "nba", dayText: "Wed 19 Nov", matchText: "Denver Nuggets @ LA Clippers", pickText: "LAC 77%", chipClass: "chip GREEN", bestValue: true });
assert.equal(hub.light, "GREEN");
assert.match(P.cardHtml(hub), /pf-card pf-l-GREEN.*class="pf-lpill pf-l-GREEN">Green<\/span><span class="pf-bv">Best value<\/span>/s);
assert.doesNotMatch(P.cardHtml({ ...hub, bestValue: false }), /pf-bv/);
assert.doesNotMatch(P.cardHtml(P.hubRowFromParts({ sport: "nba", matchText: "A @ B", pickText: "A 61%", chipClass: "chip SUPER" })), /pf-bv/, "the Best value light needs no extra tag");

console.log("green-first Best value tests passed");
