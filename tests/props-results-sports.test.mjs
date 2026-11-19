// NFL / NHL props results: settled data rows (the side season form favoured) from nfl-props-results / nhl-props-results,
// period tabs, by-market breakdowns, and opening / closing prices on the board. Data only.
import assert from "node:assert/strict";
import fs from "node:fs";
import { resultsFrom, renderBody, loadResults, _resetResultsCache, sydneyToday, renderPropsCsv } from "../functions/_shared/props-results.js";
import { filterRows, periodStart, breakdownHtml, headHtml, statsFor, heroHtml } from "../props-results-core.js";
import { hitLight, yesLight, renderSportBoard } from "../functions/_shared/sport-props.js";
import { itemFromSportRow } from "../functions/_shared/prop-cards.js";

const load = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const nfl = load("./fixtures/props-results-nfl.json");
const nhl = load("./fixtures/props-results-nhl.json");
const wrap = (payload) => ({ payload, generated_at: payload.generated_at });

// ---- loading and normalising
const res = resultsFrom(null, { nfl: wrap(nfl), nhl: wrap(nhl) });
assert.deepEqual(Object.keys(res.sports).sort(), ["nfl", "nhl"]);
assert.equal(res.sports.nfl.length, nfl.rows.length, "every NFL row is a valid settled row");
assert.equal(res.sports.nhl.length, nhl.rows.length, "every NHL row is a valid settled row");
assert.ok(res.sports.nhl.some((r) => r.call === "No" || r.call === "Yes"), "anytime markets settle Yes / No");
assert.ok(res.sports.nhl.some((r) => r.stat === "saves") && res.sports.nfl.some((r) => r.stat === "receptions"));
for (const r of [...res.sports.nfl, ...res.sports.nhl]) {
  assert.ok(statsFor(r.sport).some(([id]) => id === r.stat));
  assert.ok(["GREEN", "ORANGE", "RED"].includes(r.light));
  if (r.result === "V") assert.equal(r.actual, null);
}
// a wrong schema or sport is ignored, an NBA row is not taken as NFL
assert.equal(resultsFrom(null, { nfl: wrap({ ...nfl, sport: "nhl" }) }), null);
assert.equal(resultsFrom(null, { nfl: wrap({ ...nfl, schema: "x" }) }), null);
assert.equal(resultsFrom(null, { nfl: wrap({ ...nfl, rows: [{ ...nfl.rows[0], stat: "points" }] }) }), null, "points is not an NFL market");

// ---- the three snapshots are read and merged
const nbaPayload = { generated_at: "2026-11-16T09:00:00Z", sports: { nba: { rows: [{ date: "2026-11-15", game: "BOS @ NY", player: "A Guard", stat: "points", line: 24.5, call: "Over", pct: 62, light: "green", actual: 30, result: "W" }] } } };
const asked = [];
globalThis.fetch = async (url) => {
  const id = decodeURIComponent(String(url)).match(/id=eq\.([\w-]+)/)[1];
  asked.push(id);
  const payload = id === "props-results" ? nbaPayload : id === "nfl-props-results" ? nfl : nhl;
  return new Response(JSON.stringify([{ payload, generated_at: payload.generated_at }]), { headers: { "content-type": "application/json" } });
};
_resetResultsCache();
const merged = await loadResults({ env: { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" } }, { now: Date.parse("2026-11-17T01:00:00Z") });
assert.deepEqual(asked.sort(), ["nfl-props-results", "nhl-props-results", "props-results"]);
assert.deepEqual(Object.keys(merged.sports).sort(), ["nba", "nfl", "nhl"]);

// ---- page: NFL first when it is the first sport with rows; data wording; period tabs
const html = renderBody(res, { now: Date.parse("2026-11-17T01:00:00Z") });
for (const s of ["Season", "Last 30 days", "Last 7 days", "By market and side", "Settled rows", "All markets", "Passing yards", "Anytime TD", ">Chance<", ">Side<", "the higher Chance"]) {
  assert.ok(html.includes(s), s);
}
assert.ok(!html.includes(">Our call<"), "NFL rows are data, not calls");
assert.ok(html.includes('<small class="pr-basis">season rate</small>') && !html.includes("Season rate"), "rows settled before the switch (no basis) are marked season rate");
const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
for (const w of [/\bunits?\b/i, /\bstakes?\b/i, /\bedge\b/i, /fair price/i, /\bvalue\b/i, /\btips?\b(?! )/i]) {
  assert.ok(!w.test(text.replace(/Data, not tips/g, "")), String(w));
}
assert.match(html, /"today":"2026-11-17"/);
assert.equal(sydneyToday(Date.parse("2026-11-16T14:00:00Z")), "2026-11-17", "Sydney date");

// ---- periods
assert.equal(periodStart("season", "2026-11-17"), null);
assert.equal(periodStart("7", "2026-11-17"), "2026-11-11");
const last30 = filterRows(res.sports.nhl, { since: periodStart("30", "2026-11-17") });
assert.ok(last30.length > 0 && last30.length < res.sports.nhl.length && last30.every((r) => r.date >= "2026-10-19"));
const hero = heroHtml(last30, "NHL", "nhl", "Last 30 days");
assert.match(hero, /Last 30 days/);
assert.match(hero, /Green rows/);

// ---- breakdown by market (NHL markets, sides that occur)
const bk = breakdownHtml(filterRows(res.sports.nhl, { lights: ["GREEN"] }), { sport: "nhl" });
for (const s of ["Shots on goal", "Assists", "Anytime goal", "Goalie saves", "By market", "By side"]) assert.ok(bk.includes(s), s);
assert.match(headHtml(false, true, "nhl"), /<th>Side<\/th><th class="n">Chance<\/th>/);
assert.match(headHtml(false, false, "nba"), /<th>Our call<\/th><th class="n">Chance<\/th>/);
assert.match(renderPropsCsv(res), /^nfl,/m);

// ---- board: anytime rows lit with the same rule as the settle step; opening + closing prices for the player view
const board = load("../data/nhl_props/board.json");
const yes = board.games.flatMap((g) => g.props).find((r) => r.kind === "yes" && r.rates && r.rates.season.n >= 5);
const yl = yesLight(yes);
assert.ok(["Yes", "No"].includes(yl.side) && yl.light && hitLight(yes).side === yl.side);
assert.equal(yl.side, yes.call, "board light = the side the collector froze for settling");
const g = board.games[0];
assert.equal(g.price_pull, "close");
assert.ok(g.open_utc && g.open_utc < g.prices_utc);
const priced = g.props.find((r) => r.kind === "ou" && r.books.length);
const it = itemFromSportRow("nhl", priced, "Shots on goal", "", "", g);
assert.deepEqual(it.pulls, { open_utc: g.open_utc, latest_utc: g.prices_utc, latest: "close" });
assert.ok(it.books.every((b) => "open_over" in b && "open_under" in b));
assert.match(renderSportBoard("nhl", board, { full: true }), /data-pv/);
console.log("props-results-sports tests passed");
