// Props results page: settled rows only, tallies, filters, hit-rate series, headline record,
// Game column rule, voids (V) and pushes kept out of every record, optional team / opp / home /
// season_avg fields, sport tabs, empty states, CSV, copy rules, privacy, nav links.
import assert from "node:assert/strict";
import {
  resultsFrom, normaliseRow, tally, sportIds, tabSports, renderBody, dateLabel, publicRows, renderPropsCsv,
  EMPTY_TEXT, PAGE_SIZE, SNAPSHOT_ID, _resetResultsCache,
} from "../functions/_shared/props-results.js";
import {
  filterRows, dailySeries, bestDay, gameLabelsVary, heroHtml, chartSvg, chartBlockHtml, breakdownHtml,
  headHtml, rowHtml, listSummary, lightsLabel, recText, asideText, sportEmptyText, hasSeasonAvg, matchupText, wlBar,
} from "../props-results-core.js";
import { onRequestGet as page } from "../functions/props/results.js";
import { onRequestGet as csvRoute } from "../functions/props/results.csv.js";
import { onRequestGet as nbaPage } from "../functions/props/nba.js";
import { NAV_LINKS } from "../functions/_shared/site.js";

const row = (o) => ({ date: "2026-11-13", game: "Away @ Home", player: "Player A", stat: "points", line: 20.5, call: "Over", pct: 0.62, light: "green", actual: 24, result: "W", ...o });
const payload = {
  generated_at: "2026-11-14T20:00:00Z",
  sports: {
    nhl: { rows: [row({ player: "Skater", stat: "points", date: "2026-11-12" })] },
    nba: {
      rows: [
        row({}),
        row({ player: "Player B", date: "2026-11-14", result: "L", actual: 18 }),
        row({ player: "Player C", light: "orange", pct: 0.57, stat: "rebounds", result: "W", call: "Under" }),
        row({ player: "Player D", light: "red", pct: 0.52, stat: "assists", result: "P", actual: 20.5 }),
        row({ player: "Player E", light: "green", stat: "threes", result: "P", actual: null, call: "Under" }), // push, no stat line
        row({ player: "Open One", result: "", actual: null }), // open: never shown
        row({ player: "Open Two", result: "W", actual: null }), // W without an actual: never shown
        row({ player: "Bad Stat", stat: "steals" }),
      ],
    },
  },
};

// ------------------------------------------------------------------ normalise: settled only
assert.equal(normaliseRow(row({ result: null }), "nba"), null);
assert.equal(normaliseRow(row({ actual: "" }), "nba"), null, "W/L need an actual");
assert.equal(normaliseRow(row({ result: "L", actual: null }), "nba"), null);
assert.equal(normaliseRow(row({ result: "P", actual: null }), "nba").actual, null, "a push may have no actual");
assert.equal(normaliseRow(row({ pct: 62, light: "" }), "nba").light, "GREEN");
assert.equal(normaliseRow(row({ call: "under" }), "nba").call, "Under");

const res = resultsFrom({ payload });
assert.deepEqual(sportIds(res), ["nba", "nhl"], "NBA first, then other sports present in the data");
assert.deepEqual(tabSports(res), ["nba", "nfl", "nhl"], "NBA, NFL, NHL tabs always");
assert.deepEqual(tabSports(resultsFrom({ payload: { sports: { tennis: { rows: [row({})] }, afl: { rows: [row({})] }, nba: { rows: [row({})] } } } })), ["nba", "nfl", "nhl", "afl", "tennis"], "then any other sport alphabetically");
const nba = res.sports.nba;
assert.equal(nba.length, 5);
assert.equal(nba[0].player, "Player B", "newest first");
assert.ok(!nba.some((r) => /Open|Bad/.test(r.player)));

// ------------------------------------------------------------------ tallies: pushes excluded from hit %
assert.deepEqual(tally(nba), { w: 2, l: 1, n: 3, pct: 2 / 3, p: 2, v: 0 });
assert.equal(recText(tally(nba)), "2–1", "pushes are never part of the record");
assert.equal(asideText(tally(nba)), "2 pushes");
assert.equal(recText({ w: 4, l: 4, p: 0 }), "4–4");
assert.equal(tally([row({ result: "P" })]).pct, null);
assert.equal(dateLabel("2026-11-14"), "Sat 14 Nov");

// ------------------------------------------------------------------ filters
const names = (rs) => rs.map((r) => r.player).sort().join(",");
assert.equal(names(filterRows(nba, { sport: "nba", lights: ["GREEN"] })), "Player A,Player B,Player E");
assert.equal(names(filterRows(nba, { lights: { ORANGE: true, RED: true, GREEN: false } })), "Player C,Player D");
assert.equal(names(filterRows(nba, { lights: [] })), "", "no lights on: nothing");
assert.equal(names(filterRows(nba, { stat: "rebounds" })), "Player C");
assert.equal(names(filterRows(nba, { call: "Under" })), "Player C,Player E");
assert.equal(names(filterRows(nba, { call: "Over", lights: ["GREEN"] })), "Player A,Player B");
assert.equal(names(filterRows(nba, { date: "2026-11-14" })), "Player B");
assert.equal(names(filterRows(nba, { stat: "all", call: "all", date: "all", game: "all" })), names(nba));
assert.equal(filterRows(nba, { sport: "nhl" }).length, 0);
assert.equal(lightsLabel(["GREEN"]), "Green");
assert.equal(lightsLabel({ GREEN: true, ORANGE: true }), "Green + Orange");
assert.equal(lightsLabel(["GREEN", "ORANGE", "RED"]), "All lights");

// ------------------------------------------------------------------ cumulative + daily hit rate
const R = (date, result) => ({ date, result });
const series = dailySeries([R("2026-11-02", "W"), R("2026-11-01", "W"), R("2026-11-01", "L"), R("2026-11-02", "W"), R("2026-11-02", "P"), R("2026-11-03", "P"), R("2026-11-03", "L")]);
assert.deepEqual(series.map((d) => d.date), ["2026-11-01", "2026-11-02", "2026-11-03"], "oldest first");
assert.deepEqual(series.map((d) => d.pct), [0.5, 1, 0], "daily rate, pushes left out");
assert.deepEqual(series.map((d) => d.cum), [0.5, 0.75, 0.6], "cumulative rate");
assert.deepEqual(series.map((d) => [d.cw, d.cl]), [[1, 1], [3, 1], [3, 2]]);
assert.equal(dailySeries([R("2026-11-01", "P"), R("2026-11-02", "V")]).length, 0, "push / void-only days are not charted");
assert.equal(bestDay(series).date, "2026-11-02");
assert.equal(bestDay(dailySeries([R("2026-11-01", "W"), ...Array(3).fill(R("2026-11-02", "W")), R("2026-11-02", "L")])).date, "2026-11-02", "3+ decided calls preferred over a 1-call day");
// chart: one point for one date (nothing invented), a line + area for several, bars for daily
const one = chartSvg(dailySeries([R("2026-11-15", "W"), R("2026-11-15", "L")]), "cum");
assert.equal((one.match(/<circle/g) || []).length, 1);
assert.ok(!one.includes("prAreaGrad)") && one.includes("15 Nov") && !one.includes("14 Nov"));
assert.ok(one.includes(">50%</text>"));
const many = chartSvg(series, "cum");
assert.ok(many.includes('fill="url(#prAreaGrad)"') && many.includes("Cumulative hit rate"));
assert.ok(!/units?\b|ROI|profit/i.test(many.replace(/<[^>]+>/g, " ")), "no units in the chart text");
const bars = chartSvg(series, "day");
assert.equal((bars.match(/<rect /g) || []).length, 3, "one bar per day with a rate");
assert.ok(bars.includes("Daily hit rate"));
assert.ok(chartSvg(series, "cum", "Green", { narrow: true }).includes('viewBox="0 0 400 '), "phone variant");
assert.equal(chartSvg([], "cum"), "");
// summary tiles: one day says so with the real numbers; several days show the best day
const oneDay = chartBlockHtml(filterRows(nba, { date: "2026-11-14" }), "cum", "Green");
assert.ok(oneDay.includes("Days settled") && oneDay.includes("Sat 14 Nov") && !oneDay.includes("Best day"));
assert.ok(chartBlockHtml(nba, "cum", "All lights").includes("Best day"));
assert.ok(chartBlockHtml([], "cum", "Green").includes("No settled green calls"));
assert.ok(!/fresh record|still proving/i.test(oneDay));

// ------------------------------------------------------------------ headline record
const hero = heroHtml(nba, "NBA");
const big = [...hero.matchAll(/<p class="record-hero([^"]*)"><b>([^<]+)<\/b> <span>([^<]+)<\/span>/g)];
assert.equal(big.length, 2, "two headline figures");
assert.equal(big[0][1], " green-hero pr-big", "green first, in green");
assert.equal(big[1][1], " pr-big", "all-settled figure at the same size class");
assert.deepEqual([big[0][2], big[0][3]], ["1–1", "50%"], "green W-L and hit %");
assert.match(hero, /green-hero pr-big"><b>1–1<\/b> <span>50%<\/span><\/p>\s*<p class="pr-hero-sub">1 of 2 green calls right · <em class="pr-aside">1 push<\/em><\/p>/, "a real push is named on the sub-line, off the big record");
assert.deepEqual([big[1][2], big[1][3]], ["2 of 3", "67%"], "all settled, pushes left out of the %");
assert.ok(hero.indexOf('data-hero="green"') < hero.indexOf('data-hero="all"'));
for (const k of ["Orange", "Red", "Void", "Over calls", "Under calls"]) assert.ok(hero.includes(`>${k}</span>`), k);
assert.ok(hero.indexOf('data-hero="all"') < hero.indexOf(">Orange<"), "smaller tiles after the headline");
assert.ok(!hero.includes("Super") && !hero.includes("Best value"));

// ------------------------------------------------------------------ breakdowns
const bk = breakdownHtml(filterRows(nba, { lights: ["GREEN"] }), { stat: "points", call: "all" });
for (const s of ["Points", "Rebounds", "Assists", "Threes", "Over", "Under"]) assert.ok(bk.includes(`<span class="pr-bk-k">${s}</span>`), s);
assert.match(bk, /class="pr-bk on" data-filter="stat" data-value="points" aria-pressed="true"/);
assert.match(bk, /data-filter="call" data-value="Over" aria-pressed="false"/);
assert.ok(bk.includes("None settled"), "honest empty state for an empty stat");
assert.ok((bk.match(/class="pr-bar"/g) || []).length === 6, "a small chart per tile");

// ------------------------------------------------------------------ Game column + filter
const g = (game) => ({ ...nba[0], game });
assert.equal(gameLabelsVary([g("A @ B"), g("A @ B")]), false, "one shared label: hidden");
assert.equal(gameLabelsVary([g(""), g("")]), false, "missing labels: hidden");
assert.equal(gameLabelsVary([g("A @ B"), g("")]), false, "one real label + blanks: hidden");
assert.equal(gameLabelsVary([g("A @ B"), g("C @ D")]), true, "labels vary: shown");
assert.ok(!headHtml(false).includes("Game") && headHtml(true).includes("<th>Date</th><th>Game</th><th>Player</th>"));
assert.ok(!rowHtml(g("A @ B"), false).includes("A @ B") && rowHtml(g("A @ B"), true).includes("A @ B"));
const cols = [...headHtml(false).matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
assert.deepEqual(cols, ["Date", "Player", "Stat", "Line", "Our call", "Chance", "Light", "Actual", "Result"]);
const pushRow = rowHtml(nba.find((r) => r.player === "Player E"), false);
assert.ok(pushRow.includes('class="n mono pr-actual">—<') && pushRow.includes('pr-badge P'));
assert.equal(listSummary(nba, 5), "Showing <b>5</b> of 5 settled calls · <b>2–1</b> (67%) · 2 pushes");
assert.equal(sportEmptyText("NFL"), "NFL props results will appear here once settled calls are up.");

// ------------------------------------------------------------------ body: one shared game label (today's live shape)
const shared = resultsFrom({ payload: { generated_at: "x", sports: { nba: { rows: Array.from({ length: 60 }, (_, i) => row({ player: `P${i}`, game: "Indiana Pacers @ Philadelphia 76ers", light: i % 3 ? "orange" : "green" })) } } } });
const sb = renderBody(shared);
assert.ok(!sb.includes("<th>Game</th>"), "Game column hidden on one shared label");
assert.match(sb, /id="prGameWrap" hidden/, "game filter hidden");
assert.ok(!sb.includes("Indiana Pacers"), "the shared (wrong) label is not sent to the page at all");
assert.equal(publicRows(shared).nba[0].game, "");
const varied = renderBody(resultsFrom({ payload: { sports: { nba: { rows: [row({ game: "A @ B" }), row({ game: "C @ D", player: "X" })] } } } }));
assert.ok(varied.includes("<th>Game</th>") && !/id="prGameWrap" hidden/.test(varied) && varied.includes('<option value="C @ D">'));

// ------------------------------------------------------------------ body: defaults
const body = renderBody(res);
assert.match(body, /class="gf-btn GREEN on" data-light="GREEN" aria-pressed="true"/);
assert.match(body, /class="gf-btn ORANGE" data-light="ORANGE" aria-pressed="false"/);
assert.match(body, /data-sport="nba" aria-selected="true"/);
assert.ok(body.indexOf('data-sport="nfl"') < body.indexOf('data-sport="nhl"'), "NFL tab shown even with no rows");
assert.ok(body.indexOf('id="prHero"') < body.indexOf('id="growth"'));
assert.ok(body.indexOf('id="growth"') < body.indexOf("pr-break"));
assert.ok(body.indexOf("pr-break") < body.indexOf("Members get today's full player props"));
assert.ok(body.indexOf("Members get today's full player props") < body.indexOf('id="picks"'));
for (const s of ["All stats", "Points", "Rebounds", "Assists", "Threes", "Over + Under", "Over", "Under", "Cumulative", "Daily"]) assert.ok(body.includes(`>${s}</button>`), s);
assert.ok(body.includes('<option value="2026-11-14">Sat 14 Nov</option>'), "date filter");
assert.ok(body.includes('href="/members?next=%2Fprops%2Fnba#memberSignIn"'), "sign-in returns to /props/nba");
assert.ok(body.includes('href="/join"'));
assert.ok(body.includes('href="/props/results.csv"'));
const listRows = body.slice(body.indexOf('id="prBody"'));
assert.equal((listRows.match(/<tr class="pr-r /g) || []).length, 3, "Green rows only by default");
assert.ok(!/<tr class="pr-r (ORANGE|RED)/.test(listRows));
// pagination
const big60 = renderBody(resultsFrom({ payload: { sports: { nba: { rows: Array.from({ length: PAGE_SIZE + 5 }, (_, i) => row({ player: `P${i}` })) } } } }));
assert.equal((big60.match(/<tr class="pr-r /g) || []).length, PAGE_SIZE);
assert.match(big60, /id="prMore">Show more/);
assert.match(body, /id="prMore" hidden/);

// ------------------------------------------------------------------ public data only
const json = JSON.parse(body.match(/<script type="application\/json" id="prData">([\s\S]*?)<\/script>/)[1]);
const keys = new Set(Object.values(json.sports).flat().flatMap((r) => Object.keys(r)));
assert.deepEqual([...keys].sort(), ["actual", "basis", "call", "date", "game", "home", "light", "line", "opp", "p", "player", "result", "season_avg", "sport", "stat", "team"]);
assert.ok(!json.sports.nba.some((r) => /Open/.test(r.player)), "open calls never sent");
const leak = renderBody(resultsFrom({ payload: { sports: { nba: { rows: [row({ proj: 31.4, sigma: 4.2, p_over: 0.7, minutes: 33, event_id: "e1", player: "</script><b>x" })] } } } }));
assert.ok(!/31\.4|sigma|p_over|event_id/.test(leak), "private fields never reach the page");
assert.ok(!leak.includes("</script><b>x"), "JSON payload cannot break out of its script tag");

// ------------------------------------------------------------------ CSV
const csv = renderPropsCsv(res).trim().split("\n");
assert.equal(csv[0], "sport,date,game,player,team,opp,home,stat,line,season_avg,call,chance,light,actual,result");
assert.equal(csv.length, 1 + 5 + 1, "every settled call, every sport");
assert.ok(csv.includes("nba,2026-11-13,,Player E,,,,threes,20.5,,Under,0.62,GREEN,,P"), "missing optional fields stay blank");
assert.equal(renderPropsCsv(null).trim(), csv[0]);

// ------------------------------------------------------------------ voids (V): listed, never counted
assert.equal(normaliseRow(row({ result: "V", actual: null }), "nba").result, "V", "void accepted with no actual");
assert.equal(normaliseRow(row({ result: "v", actual: 7 }), "nba").actual, null, "a void never carries an actual");
const vres = resultsFrom({ payload: { generated_at: "x", sports: { nba: { rows: [
  ...Array.from({ length: 4 }, (_, i) => row({ player: `GW${i}`, result: "W" })),
  ...Array.from({ length: 4 }, (_, i) => row({ player: `GL${i}`, result: "L", actual: 10 })),
  row({ player: "GV1", result: "V", actual: null }), row({ player: "GV2", result: "V", actual: null, stat: "assists" }),
  row({ player: "OW", light: "orange", pct: 0.57, result: "W" }), row({ player: "OV", light: "orange", pct: 0.57, result: "V", actual: null, call: "Under" }),
] } } } });
const vr = vres.sports.nba;
assert.equal(vr.length, 12, "voids are listed");
const vt = tally(vr);
assert.deepEqual([vt.w, vt.l, vt.n, vt.v, vt.p], [5, 4, 9, 3, 0], "voids out of W/L and n");
assert.equal(Math.round(vt.pct * 100), 56, "voids out of the hit rate");
assert.equal(asideText(vt), "3 void", "no push wording without a real push");
const vh = heroHtml(vr, "NBA");
assert.match(vh, /green-hero pr-big"><b>4–4<\/b> <span>50%<\/span><\/p>\s*<p class="pr-hero-sub">4 of 8 green calls right · <em class="pr-aside">2 void<\/em><\/p>/, "hero: green W-L and %, N void on the sub-line");
assert.match(vh, /pr-big"><b>5 of 9<\/b> <span>56%<\/span><\/p>\s*<p class="pr-hero-sub mono">5–4 · every light · <em class="pr-aside">3 void<\/em><\/p>/, "all settled excludes voids");
assert.ok(!/pr-big">[^\n]*pr-aside/.test(vh), "no void/push count on the big headline line");
assert.ok(!/push/i.test(vh.replace(/class="[^"]*"/g, "")), "no push mention when none exist");
assert.match(vh, /<span class="ut-k">Void<\/span><b>3<\/b><span class="pr-tile-r">not in records<\/span>/);
assert.ok(!/\d+–\d+–\d+/.test(vh), "never W-L-P in the hero");
const vhp = heroHtml([...vr, { ...vr[0], player: "PP", result: "P", actual: 20.5 }], "NBA");
assert.match(vhp, /<em class="pr-aside">2 void · 1 push<\/em>/, "a real push is named next to the voids");
// chart + breakdowns + list ignore voids
const greenV = filterRows(vr, { lights: ["GREEN"] });
const greenNoV = greenV.filter((r) => r.result !== "V");
assert.equal(chartSvg(dailySeries(greenV), "cum"), chartSvg(dailySeries(greenNoV), "cum"), "chart unchanged by voids");
assert.equal(chartSvg(dailySeries(greenV), "day"), chartSvg(dailySeries(greenNoV), "day"));
const cb = chartBlockHtml(greenV, "cum", "Green");
assert.ok(cb.includes("<b>8</b>") && cb.includes("4–4 · 2 void") && !cb.includes("<b>10</b>"), "settled-calls tile counts W/L only");
const vbk = breakdownHtml(greenV);
assert.ok(vbk.includes('data-value="points" aria-pressed="false">\n      <span class="pr-bk-k">Points</span>\n      <span class="pr-bk-v">50%</span>\n      <span class="pr-bk-r mono">4–4</span>'), "stat tile: W-L only");
assert.match(vbk, /data-value="assists"[^>]*>\s*<span class="pr-bk-k">Assists<\/span>\s*<span class="pr-bk-v">—<\/span>\s*<span class="pr-bk-r mono">None settled<\/span>/, "void-only stat: honest empty state");
assert.equal((wlBar({ w: 1, l: 1, n: 2 }).match(/<rect/g) || []).length, 2, "bar: W and L only");
assert.equal(listSummary(greenV, 12), "Showing <b>10</b> of 12 settled calls · <b>4–4</b> (50%) · 2 void");
const vRow = rowHtml(vr.find((r) => r.player === "GV1"), false);
assert.match(vRow, /<td class="n mono pr-actual">-<\/td>/, "void actual shows -");
assert.match(vRow, /<span class="pr-badge V" title="Void: did not play">VOID<\/span>/, "grey VOID badge");
const vBody = renderBody(vres);
assert.ok(vBody.includes(">VOID</span>"), "void rows are listed on the page");
assert.match(vBody, /id="prCount">Showing <b>10<\/b> of 12 settled calls · <b>4–4<\/b> \(50%\) · 2 void/);
assert.ok(renderPropsCsv(vres).includes(",GV1,"), "voids in the CSV");
assert.match(renderPropsCsv(vres), /,GV1,.*,GREEN,,V\n/, "void CSV row: blank actual, result V");

// ------------------------------------------------------------------ optional public fields: team, opp, home, season_avg
const f1 = normaliseRow(row({ team: " Los Angeles Lakers ", opp: "Phoenix Suns", home: false, season_avg: 24.6 }), "nba");
assert.deepEqual([f1.team, f1.opp, f1.home, f1.season_avg], ["Los Angeles Lakers", "Phoenix Suns", false, 24.6]);
const f2 = normaliseRow(row({ home: "true", season_avg: "7.5" }), "nba");
assert.deepEqual([f2.home, f2.season_avg], [true, 7.5], "string forms accepted");
const f3 = normaliseRow(row({}), "nba");
assert.deepEqual([f3.team, f3.opp, f3.home, f3.season_avg], ["", "", null, null], "missing fields ignored");
const f4 = normaliseRow(row({ home: "yes", season_avg: "n/a", opp: null }), "nba");
assert.deepEqual([f4.home, f4.season_avg, f4.opp], [null, null, ""], "invalid values ignored");
assert.equal(matchupText({ opp: "Phoenix Suns", home: false }), "@ Phoenix Suns");
assert.equal(matchupText({ opp: "Phoenix Suns", home: true }), "vs Phoenix Suns");
assert.equal(matchupText({ opp: "Phoenix Suns", home: null }), "vs Phoenix Suns");
assert.equal(matchupText({ opp: "", home: true }), "");
assert.match(rowHtml(f1, false), /<td class="pr-player">Player A<span class="pr-opp">@ Phoenix Suns<\/span><\/td>/);
assert.match(rowHtml(f3, false), /<td class="pr-player">Player A<\/td>/, "no opp: name only");
assert.equal(hasSeasonAvg([f3]), false);
assert.equal(hasSeasonAvg([f3, f1]), true);
assert.ok(headHtml(false, true).includes('<th class="n">Line</th><th class="n">Season avg</th><th>Our call</th>'));
assert.ok(!headHtml(false, false).includes("Season avg"));
assert.match(rowHtml(f1, false, true), /<td class="n mono pr-avg">24\.6<\/td>/);
assert.match(rowHtml(f3, false, true), /<td class="n mono pr-avg">—<\/td>/, "missing avg in a sport that has some: —");
const fres = resultsFrom({ payload: { sports: { nba: { rows: [row({ team: "Phoenix Suns", opp: "Los Angeles Lakers", home: true, season_avg: 26.1 }), row({ player: "Z" })] } } } });
const fb = renderBody(fres);
assert.ok(fb.includes("<th class=\"n\">Season avg</th>") && fb.includes("vs Los Angeles Lakers") && fb.includes(">26.1<"));
assert.ok(!renderBody(res).includes("Season avg"), "no season avg anywhere: no column");
assert.ok(renderPropsCsv(fres).includes(",Player A,Phoenix Suns,Los Angeles Lakers,true,points,20.5,26.1,Over,"));

// ------------------------------------------------------------------ page via the routes: stubbed Supabase
const realFetch = globalThis.fetch;
let snapshot = payload;
const seen = [];
globalThis.fetch = async (input) => {
  const url = String(input.url || input);
  seen.push(url);
  if (url.includes("tips_page_snapshot") && url.includes(`id=eq.${SNAPSHOT_ID}`)) return new Response(JSON.stringify(snapshot ? [{ payload: snapshot }] : []), { headers: { "content-type": "application/json" } });
  if (url.includes("tips_page_snapshot")) return new Response("[]", { headers: { "content-type": "application/json" } });
  throw new Error("unexpected fetch in test: " + url);
};
const ctx = (path) => ({ request: new Request("https://x.test" + path), env: { SUPABASE_SERVICE_ROLE_KEY: "k", ASSETS: { fetch: async () => new Response("{}", { status: 404 }) } } });
_resetResultsCache();
const r = await page(ctx("/props/results"));
assert.equal(r.status, 200);
assert.match(r.headers.get("cache-control"), /s-maxage=60/);
const h = await r.text();
assert.ok(h.includes("Every settled player prop, updated daily"));
assert.ok(h.includes("Player B") && !h.includes("Open One"));
assert.ok(h.includes('<a href="/props/results" aria-current="page">Props Results</a>'));
assert.ok(h.includes('<script type="module" src="/props-results.js"></script>'));
assert.ok(!seen.some((u) => u.includes("nba-props")), "today's board snapshot is never read");
// copy rules (this page's own copy, not the shared footer): no method, units or money talk
const pageBody = h.slice(h.indexOf("<h1>"), h.indexOf("Gamble responsibly"));
const visibleText = pageBody.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
for (const bad of [/\bmodel/i, /projection/i, /\bminutes\b/i, /calibrat/i, /\bmethod/i, /\bcap(s|ped)?\b/i, /\$1\.49/, /paper/i, /\bunits?\b/i, /\bROI\b/, /profit/i, /fresh record/i, /still proving/i, /\bSuper\b/, /nearest line/i]) assert.ok(!bad.test(visibleText), "copy avoids " + bad);
assert.ok(h.includes("For entertainment, not betting advice. 18+."));

const c = await csvRoute(ctx("/props/results.csv"));
assert.match(c.headers.get("content-type"), /text\/csv/);
assert.ok((await c.text()).includes("Player B"));

snapshot = null;
_resetResultsCache();
const empty = await (await page(ctx("/props/results"))).text();
assert.ok(empty.includes(EMPTY_TEXT));
assert.ok(!empty.includes("/props-results.js"));

// nav + /props/nba link
const i = NAV_LINKS.findIndex(([href]) => href === "/results");
assert.deepEqual(NAV_LINKS[i + 1], ["/props/results", "Props Results"]);
const nh = await (await nbaPage(ctx("/props/nba"))).text();
assert.ok(nh.includes('<a href="/props/results">See props results →</a>'));

globalThis.fetch = realFetch;
console.log("props-results tests passed");
