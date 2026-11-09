import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rowsFromFeed, rowsFromNhl, rowsFromSoccer, rowsFromTennis, tally, EPL_LIGHTS_FROM, renderRecordCsv, seasonLabel } from "../functions/_shared/record-pages.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = async (name) => JSON.parse(await readFile(join(root, "data", name), "utf8"));

// NBA-style feed rows: only post + pick + won, lights preserved, no invented units.
const feed = {
  season: 2027,
  games: [
    { game_id: "1", season: 2027, start_utc: "2026-11-01T00:00:00Z", first_posted: "2026-10-31T12:00:00Z", home: "BOS", away: "NY", home_name: "Boston Celtics", away_name: "New York Knicks", pick: "BOS", pick_name: "Boston Celtics", pick_p: 0.72, light: "GREEN", status: "post", won: true, home_score: 110, away_score: 100, vs_close: 0.02, close_price: 1.4, posted_price: 1.45 },
    { game_id: "2", season: 2027, start_utc: "2026-11-02T00:00:00Z", first_posted: "2026-11-01T12:00:00Z", home: "LAL", away: "MIA", home_name: "Los Angeles Lakers", away_name: "Miami Heat", pick: "MIA", pick_name: "Miami Heat", pick_p: 0.51, light: "RED", status: "post", won: false, home_score: 99, away_score: 90, vs_close: -0.01, close_price: 1.9, posted_price: 1.85 },
    { game_id: "3", season: 2027, start_utc: "2026-11-03T00:00:00Z", first_posted: "2026-11-02T12:00:00Z", home: "DEN", away: "PHX", home_name: "Denver Nuggets", away_name: "Phoenix Suns", pick: "DEN", pick_name: "Denver Nuggets", pick_p: 0.8, light: "SUPER", status: "pre", won: null },
    { game_id: "4", season: 2027, start_utc: "2026-11-04T00:00:00Z", home: "CHI", away: "ATL", home_name: "Chicago Bulls", away_name: "Atlanta Hawks", pick: null, pick_p: null, light: null, status: "post", won: true, home_score: 1, away_score: 0 },
  ],
};
const nbaRows = rowsFromFeed("nba", feed);
assert.equal(nbaRows.length, 2);
assert.equal(nbaRows[0].posted_utc, "2026-10-31T12:00:00Z");
assert.equal(nbaRows.every((r) => r.units == null), true);
const nbaT = tally(nbaRows);
assert.equal(nbaT.n, 2);
assert.equal(nbaT.w, 1);
assert.equal(nbaT.byLight.GREEN.w, 1);
assert.equal(nbaT.byLight.RED.w, 0);
assert.equal(nbaT.close.n, 2);
assert.equal(nbaT.close.beat, 1);
assert.equal(seasonLabel("nba", nbaRows, 2027), "2026–27");

const csv = renderRecordCsv({ sport: "nba", rows: nbaRows });
assert.match(csv, /^sport,game_id,/);
assert.doesNotMatch(csv, /units/i);
assert.match(csv, /Boston Celtics/);

const nhl = rowsFromNhl({
  picks: await load("nhl-picks.json"),
  pretip: await load("nhl-pretip.json"),
  grades: await load("nhl-grades.json"),
  market: await load("nhl-market.json"),
});
const nhlT = tally(nhl);
assert.equal(nhlT.n, 129);
assert.equal(nhlT.w, nhl.filter((r) => r.won).length);
assert.ok(nhl.every((r) => r.start_utc));
assert.equal(nhl.filter((r) => r.posted_utc).length, nhlT.posted);
// Market coverage is whatever is already on file (currently a handful of games).
assert.ok(nhlT.close.n <= nhlT.n);

const epl = rowsFromSoccer("epl", {
  picks: await load("epl-picks.json"),
  grades: await load("epl-grades.json"),
  market: await load("epl-market.json"),
});
const eplT = tally(epl);
assert.equal(eplT.n, 30);
assert.equal(eplT.w, 12);
assert.equal(eplT.byLight.GREEN.n, 3);
assert.equal(eplT.byLight.GREEN.w, 3);
assert.equal(eplT.byLight.ORANGE.n, 12);
assert.equal(eplT.byLight.ORANGE.w, 5);
assert.equal(eplT.byLight.RED.n, 14);
assert.equal(eplT.byLight.RED.w, 4);
assert.equal(eplT.byLight.NONE.n, 1);
assert.ok(epl.some((r) => r.start_utc < EPL_LIGHTS_FROM && r.light == null));
assert.ok(epl.filter((r) => r.start_utc >= EPL_LIGHTS_FROM).every((r) => r.light));

const champ = rowsFromSoccer("championship", {
  picks: await load("championship-picks.json"),
  grades: await load("championship-grades.json"),
  market: await load("championship-market.json"),
});
const champT = tally(champ);
assert.equal(champT.n, 11);
assert.equal(champT.w, 4);
assert.ok(champ.every((r) => r.light)); // Championship always lit
assert.equal(champT.close.n, 0); // market file is empty
assert.ok(champ.every((r) => r.posted_utc == null));
assert.match(champ[0].posted_note, /not on file/i);

const tennis = rowsFromTennis({
  picks: await load("tennis-picks.json"),
  market: await load("tennis-market.json"),
});
const tenT = tally(tennis);
assert.equal(tenT.n, 16);
assert.equal(tenT.w, 12);
assert.equal(tenT.byLight.GREEN.n, 4);
assert.equal(tenT.byLight.GREEN.w, 3);
assert.equal(tenT.byLight.ORANGE.n, 5);
assert.equal(tenT.byLight.ORANGE.w, 4);
assert.equal(tenT.byLight.RED.n, 7);
assert.equal(tenT.byLight.RED.w, 5);
assert.equal(tenT.close.n, 1);

console.log("Record pages: assertions passed");
console.log(`NHL ${nhlT.w}/${nhlT.n} posted ${nhlT.posted} close ${nhlT.close.n}`);
console.log(`EPL ${eplT.w}/${eplT.n} lights G ${eplT.byLight.GREEN.w}/${eplT.byLight.GREEN.n} unlit ${eplT.byLight.NONE.n} close ${eplT.close.n}`);
console.log(`CHAMP ${champT.w}/${champT.n}`);
console.log(`Tennis ${tenT.w}/${tenT.n} close ${tenT.close.n}`);
