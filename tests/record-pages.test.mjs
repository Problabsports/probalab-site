import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rowsFromFeed, rowsFromNhl, rowsFromSoccer, rowsFromTennis, tally, EPL_LIGHTS_FROM, renderRecordCsv, renderResultsCsv, renderResultsPage, renderLightsPage, parseResultsFilters, filterResultRows, resultsHref, lightTally, seasonLabel } from "../functions/_shared/record-pages.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = async (name) => JSON.parse(await readFile(join(root, "data", name), "utf8"));
const CFG = JSON.parse(await readFile(join(root, "lights.json"), "utf8"));

// Expected counts are read straight from the data files, independently of record-pages.js, so a data refresh never
// breaks this test while a counting bug in record-pages.js still does.
const list = (x) => (Array.isArray(x) ? x : x?.games ?? x?.matches ?? []);
const pc = (v) => (v == null ? null : Number(v) > 1 ? Number(v) / 100 : Number(v));
const count = (items, light) => {
  const xs = light === undefined ? items : items.filter((x) => (x.light ?? null) === light);
  return { n: xs.length, w: xs.filter((x) => x.won).length };
};
const marketCount = (market, items) => items.filter((x) => {
  const m = market?.[x.id]?.[x.side];
  return x.side != null && m && m.posted_price && m.close_price && m.vs_close != null;
}).length;
// light from the whole-number % shown (lights.json: the shown chance is rounded down, so the number matches its light)
function cutLight(sport, p) {
  const c = CFG.games[sport];
  if (p == null) return null;
  const v = Math.floor(p * 100 + 1e-9);
  return v >= Math.round(c.green_min * 100) ? "GREEN" : v >= Math.round(c.orange_min * 100) ? "ORANGE" : "RED";
}
const expectNhl = (pretip) => Object.values(pretip?.games ?? {}).filter((s) => typeof s.won === "boolean").map((s) => ({ won: s.won, light: s.light ?? null }));
function expectSoccer(sport, picks, grades) {
  return list(picks).filter((g) => grades?.[String(g.game_id ?? g.id)]?.graded).map((g) => {
    const id = String(g.game_id ?? g.id);
    const lit = sport !== "epl" || (g.start_utc && g.start_utc >= CFG.games.epl.lights_from);
    return { id, side: g.pick, won: !!grades[id].correct, light: lit ? cutLight(sport, pc(g["p_" + g.pick])) : null };
  });
}
function expectTennis(picks) {
  return list(picks).map((m) => ({ m, won: m.result === "won" ? true : m.result === "lost" ? false : m.right == null ? null : !!m.right }))
    .filter((x) => x.won != null)
    .map(({ m, won }) => ({ id: String(m.id ?? m.game_id), side: m.pick, won, light: m.light ? cutLight("tennis", pc(m.pick_pct ?? m.pick_p)) : null }));
}
function sameCounts(t, items, lights, what) {
  const all = count(items);
  assert.equal(t.n, all.n, `${what}: picks`);
  assert.equal(t.w, all.w, `${what}: wins`);
  for (const l of lights) {
    const e = count(items, l), got = t.byLight[l ?? "NONE"] ?? { n: 0, w: 0 };
    assert.equal(got.n, e.n, `${what} ${l ?? "no light"}: picks`);
    assert.equal(got.w, e.w, `${what} ${l ?? "no light"}: wins`);
  }
}

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

const nhlPretip = await load("nhl-pretip.json");
const nhl = rowsFromNhl({
  picks: await load("nhl-picks.json"),
  pretip: nhlPretip,
  grades: await load("nhl-grades.json"),
  market: await load("nhl-market.json"),
});
const nhlT = tally(nhl);
const nhlE = expectNhl(nhlPretip);
assert.ok(nhlE.length > 0, "NHL data has finished picks");
sameCounts(nhlT, nhlE, ["SUPER", "GREEN", "ORANGE", "RED"], "NHL");
assert.equal(nhlT.w, nhl.filter((r) => r.won).length);
assert.ok(nhl.every((r) => r.start_utc));
assert.equal(nhl.filter((r) => r.posted_utc).length, nhlT.posted);
// Market coverage is whatever is already on file (currently a handful of games).
assert.ok(nhlT.close.n <= nhlT.n);

const [eplPicks, eplGrades, eplMarket] = [await load("epl-picks.json"), await load("epl-grades.json"), await load("epl-market.json")];
const epl = rowsFromSoccer("epl", { picks: eplPicks, grades: eplGrades, market: eplMarket });
const eplT = tally(epl);
const eplE = expectSoccer("epl", eplPicks, eplGrades);
assert.ok(eplE.length > 0, "EPL data has finished picks");
sameCounts(eplT, eplE, ["GREEN", "ORANGE", "RED", null], "EPL");
assert.equal(eplT.close.n, marketCount(eplMarket, eplE), "EPL: picks with a closing price");
assert.ok(epl.some((r) => r.start_utc < EPL_LIGHTS_FROM && r.light == null));
assert.ok(epl.filter((r) => r.start_utc >= EPL_LIGHTS_FROM).every((r) => r.light));

const [chPicks, chGrades, chMarket] = [await load("championship-picks.json"), await load("championship-grades.json"), await load("championship-market.json")];
const champ = rowsFromSoccer("championship", { picks: chPicks, grades: chGrades, market: chMarket });
const champT = tally(champ);
const champE = expectSoccer("championship", chPicks, chGrades);
assert.ok(champE.length > 0, "Championship data has finished picks");
sameCounts(champT, champE, ["GREEN", "ORANGE", "RED"], "Championship");
assert.ok(champ.every((r) => r.light)); // Championship always lit
assert.equal(champT.close.n, marketCount(chMarket, champE), "Championship: picks with a closing price");
for (const r of champ) if (r.posted_utc == null) assert.match(r.posted_note, /not on file/i); // says so when no post time

const [tenPicks, tenMarket] = [await load("tennis-picks.json"), await load("tennis-market.json")];
const tennis = rowsFromTennis({ picks: tenPicks, market: tenMarket });
const tenT = tally(tennis);
const tenE = expectTennis(tenPicks);
assert.ok(tenE.length > 0, "tennis data has finished matches");
sameCounts(tenT, tenE, ["GREEN", "ORANGE", "RED"], "Tennis");
assert.equal(tenT.close.n, marketCount(tenMarket, tenE), "Tennis: picks with a closing price");

// Green headlines as the page should print them, from the data files.
const greenOf = (items) => count(items, "GREEN");
const G = { nhl: greenOf(nhlE), epl: greenOf(eplE), champ: greenOf(champE), tennis: greenOf(tenE) };

const views = [
  { sport: "nba", name: "NBA", season: "2026–27", rows: [
    { ...nbaRows[0], sport: "nba" },
    { ...nbaRows[1], sport: "nba" },
    { id: "s", sport: "nba", start_utc: "2026-11-05T00:00:00Z", posted_utc: "2026-11-04T12:00:00Z", home: "Denver Nuggets", away: "Phoenix Suns", pick: "Denver Nuggets", pick_p: 0.8, light: "SUPER", won: true, score: "10–9", href: "/nba/x" },
  ] },
  { sport: "nhl", name: "NHL", season: "2026–27", rows: nhl },
  { sport: "epl", name: "Premier League", season: "2026–27", rows: epl },
  { sport: "championship", name: "Championship", season: "2026–27", rows: champ },
  { sport: "tennis", name: "Tennis", season: "2026", rows: tennis },
];

assert.equal(parseResultsFilters("https://probalabsports.com/results").light, "green");
assert.equal(parseResultsFilters("https://probalabsports.com/results").sport, "all");
assert.equal(parseResultsFilters("https://probalabsports.com/results?sport=nba").sport, "nba");
assert.equal(parseResultsFilters("https://probalabsports.com/results?sport=nba&light=all").light, "all");
assert.equal(resultsHref(), "/results");
assert.equal(resultsHref({ sport: "nba" }), "/results?sport=nba");
assert.equal(resultsHref({ sport: "nba", light: "all" }), "/results?sport=nba&light=all");

const allRows = views.flatMap((v) => v.rows);
const greenDefault = filterResultRows(allRows, { sport: "all", light: "green" });
assert.ok(greenDefault.every((r) => r.light === "GREEN" || r.light === "SUPER"));
assert.ok(greenDefault.some((r) => r.light === "SUPER"));
assert.equal(filterResultRows(allRows, { sport: "epl", light: "green" }).length, G.epl.n);
assert.equal(filterResultRows(allRows, { sport: "championship", light: "green" }).length, G.champ.n);
assert.equal(filterResultRows(allRows, { sport: "championship", light: "green" }).filter((r) => r.won).length, G.champ.w);
assert.equal(filterResultRows(allRows, { sport: "tennis", light: "green" }).length, G.tennis.n);

const combinedCsv = renderResultsCsv(allRows);
assert.match(combinedCsv, /^sport,game_id,/);
assert.match(combinedCsv, /^nhl,/m);
assert.match(combinedCsv, /^epl,/m);
assert.match(combinedCsv, /^championship,/m);
assert.match(combinedCsv, /^tennis,/m);
// CSV keeps every pick, including non-green.
assert.match(combinedCsv, /,RED,/);
assert.match(combinedCsv, /,ORANGE,/);
assert.doesNotMatch(combinedCsv, /units/i);
const csvRows = combinedCsv.trim().split("\n").length - 1;
assert.equal(csvRows, allRows.length);

const htmlGreen = renderResultsPage(views, { sport: "all", light: "green" });
assert.match(htmlGreen, /<h1>Results<\/h1>/);
for (const [k, g] of Object.entries(G)) if (g.n) assert.ok(htmlGreen.includes(`${g.w} of ${g.n}`), `${k} green headline ${g.w} of ${g.n}`);
assert.match(htmlGreen, /href="\/results\.csv"/);
assert.match(htmlGreen, /Green \+ Best value/);
assert.match(htmlGreen, /Best value \(NBA only/);
assert.doesNotMatch(htmlGreen, /clears the green bar|above the green bar|higher-confidence green bar/);
const lights = renderLightsPage();
assert.match(lights, /Best value<\/span><\/span><p>Best value\. NBA only/);
assert.match(lights, /bookmaker price beats our fair price/);
assert.match(lights, /162 Best value games/);
assert.match(lights, /63%/);
assert.match(lights, /\+0\.7%/);
assert.match(lights, /break-even/);
assert.doesNotMatch(lights, /well above its usual level|clears the green bar/);
const htmlNba = renderResultsPage(views, { sport: "nba", light: "green" });
assert.match(htmlNba, /href="\/results\?sport=nba&amp;light=all"|href="\/results\?sport=nba&light=all"/);
assert.ok(htmlNba.includes("Denver Nuggets")); // Best value (SUPER) included in default green view
assert.ok(!htmlNba.includes("Miami Heat") || htmlNba.indexOf("Miami Heat") < htmlNba.indexOf("<tbody>") === False);
// The RED Miami pick should not appear as a list row in the default green view.
assert.doesNotMatch(htmlNba.split("record-picks")[1] ?? "", />Miami Heat</);

console.log("Record pages: assertions passed");
console.log(`NHL ${nhlT.w}/${nhlT.n} GREEN ${nhlT.byLight.GREEN.w}/${nhlT.byLight.GREEN.n}`);
console.log(`EPL ${eplT.w}/${eplT.n} GREEN ${eplT.byLight.GREEN.w}/${eplT.byLight.GREEN.n}`);
console.log(`CHAMP ${champT.w}/${champT.n} GREEN ${champT.byLight.GREEN.w}/${champT.byLight.GREEN.n}`);
console.log(`Tennis ${tenT.w}/${tenT.n} GREEN ${tenT.byLight.GREEN.w}/${tenT.byLight.GREEN.n}`);
