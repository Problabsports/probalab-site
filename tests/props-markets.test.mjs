// Round 3 props markets: NFL receptions / pass TDs / completions, NHL points / assists / goalie saves, NBA threes +
// combos. AU prices only; a market with no AU price still shows form with blank prices ("-", "No AU price"); no bookie
// line -> "Avg line" (season average to the nearest .5). Data only.
import assert from "node:assert/strict";
import fs from "node:fs";
import { SPORTS, renderSportBoard, marketsOnBoard, propRow } from "../functions/_shared/sport-props.js";
import { itemFromSportRow, cardHtml } from "../functions/_shared/prop-cards.js";
import { renderPanels, marketsOn, gameDataRows, dataStatOf, MARKET_LABEL } from "../functions/_shared/nba-props.js";

const nfl = JSON.parse(fs.readFileSync(new URL("../data/nfl_props/board.json", import.meta.url)));
const nhl = JSON.parse(fs.readFileSync(new URL("../data/nhl_props/board.json", import.meta.url)));

// market filters list every market on the board, including the new ones
assert.deepEqual(SPORTS.nfl.markets.map(([k]) => k), ["player_pass_yds", "player_pass_tds", "player_pass_completions", "player_rush_yds",
  "player_reception_yds", "player_receptions", "player_anytime_td"]);
assert.deepEqual(SPORTS.nhl.markets.map(([k]) => k), ["player_shots_on_goal", "player_points", "player_assists", "player_goal_scorer_anytime", "player_total_saves"]);
assert.deepEqual(marketsOnBoard("nfl", nfl).map(([, l]) => l), ["Passing yards", "Passing TDs", "Pass completions", "Rushing yards", "Receiving yards", "Receptions", "Anytime TD"]);
assert.deepEqual(marketsOnBoard("nhl", nhl).map(([, l]) => l), ["Shots on goal", "Points", "Assists", "Anytime goal scorer", "Goalie saves"]);

// no AU price: blank price cells with a note, never a number; Avg line labelled
for (const [sport, board] of [["nfl", nfl], ["nhl", nhl]]) {
  const rows = board.games.flatMap((g) => g.props);
  const noAu = rows.filter((r) => r.no_au_price);
  assert.ok(noAu.length, `${sport} sample has unpriced markets`);
  for (const r of noAu) {
    assert.deepEqual(r.books, []);
    const tr = propRow(sport, r, "x");
    assert.equal((tr.match(/No AU price/g) || []).length, 2, "both price cells say No AU price");
    assert.ok(!/<b>\d+\.\d\d<\/b>/.test(tr), "no price numbers on an unpriced row");
    const card = cardHtml(itemFromSportRow(sport, r, "M", "", ""), "x", "");
    assert.match(card, /ppc-noau/);
    assert.ok(!/<b>\d+\.\d\d<\/b>/.test(card));
    if (r.kind === "ou") {
      assert.equal(r.line_source, "avg");
      assert.equal(r.line % 1, 0.5);
      assert.match(tr, /Avg line/);
      assert.match(card, /Avg line/);
      assert.ok(!/class="chip /.test(tr) && /data-light=""/.test(tr), "no light against an Avg line");
    }
  }
}
const html = renderSportBoard("nhl", nhl, { full: true });
assert.match(html, /Goalie saves/);
assert.ok(/No AU price/.test(html) && /Avg line/.test(html));

// NBA: threes + combos as data-only rows (no model prediction; Chance from the book + game_log): bookie line when priced, else Avg line
const player = (o) => ({ player: "Test Guard", team: "Boston Celtics", status: "Active",
  stats: { points: { season_avg: 24, line: 24.5, proj: 26, p_over: 0.62, p_under: 0.38 } },
  game_log: [{ date: "2026-11-12", opp: "NY", home: true, points: 30, rebounds: 6, assists: 7, threes: 4 },
             { date: "2026-11-10", opp: "MIA", home: false, points: 20, rebounds: 4, assists: 5, threes: 2 }], ...o });
const p1 = player({});
assert.deepEqual(dataStatOf(p1, "pra"), { line: 36.5, line_source: "avg", books: [], avg: 36, side: "", p: null }, "pra avg (43 + 29) / 2 = 36 -> 36.5");
assert.equal(dataStatOf(p1, "points"), null, "a stat with a prediction stays a prediction row");
const p2 = player({ stats: { ...p1.stats, pr: { line: 31.5, line_source: "book", books: [{ key: "sportsbet", name: "Sportsbet", over: 1.87, under: 1.87 }] } } });
assert.equal(dataStatOf(p2, "pr").line_source, "book");
const g = { event_id: "t1", away: "Boston Celtics", home: "New York Knicks", commence_utc: "2099-01-01T00:00:00Z", players: [p1, p2] };
const rows = gameDataRows(g);
assert.deepEqual([...new Set(rows.map((r) => r.stat))].sort(), ["pa", "pr", "pra", "threes"]);
// data-only rows: no model (s.p null) but a Chance on every row; no light here (2 games in the log, Avg lines)
assert.ok(rows.every((r) => r.s.p == null && r.s.chance && ["Over", "Under"].includes(r.s.chance.side) && r.s.chance.p >= 0.05 && r.s.chance.p <= 0.95), "data-only: Chance on every row");
assert.ok(rows.every((r) => r.light === ""), "data-only: under 5 games or an Avg line -> no light");
const prRow = rows.find((r) => r.stat === "pr" && r.s.line_source === "book");
// pr 31.5 on Sportsbet 1.87 / 1.87 (0.5 with the margin out), log 36 and 24: 1 over / 1 under of 2 -> (1 + 5) / 12 = 50% Over
assert.deepEqual(prRow.s.chance, { side: "Over", p: 0.5 });
const board = { games: [g] };
assert.deepEqual(marketsOn(board).map(([, l]) => l), ["Points", "Threes", "Pts + Reb + Ast", "Pts + Reb", "Pts + Ast"]);
assert.equal(MARKET_LABEL.pra, "Pts + Reb + Ast");
const nbaHtml = renderPanels(board, { full: true });
assert.match(nbaHtml, /data-market="pra"/);
assert.match(nbaHtml, /Avg line/);
assert.match(nbaHtml, /pp-data-row/);
const text = nbaHtml.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
for (const w of [/\bvalue\b/i, /\bedge\b/i, /fair price/i, /\bunits?\b/i, /\btips?\b/i]) assert.ok(!w.test(text), String(w));
console.log("props-markets tests passed");
