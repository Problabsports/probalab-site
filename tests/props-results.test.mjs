// Props results page: settled rows only, tallies, sport order, empty state, copy rules, nav links.
import assert from "node:assert/strict";
import { resultsFrom, normaliseRow, tally, sportIds, renderBody, dateLabel, EMPTY_TEXT, _resetResultsCache } from "../functions/_shared/props-results.js";
import { onRequestGet as page } from "../functions/props/results.js";
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
        row({ player: "Player C", light: "orange", pct: 0.57, stat: "rebounds", result: "W" }),
        row({ player: "Player D", light: "red", pct: 0.52, stat: "assists", result: "P", actual: 20.5 }),
        row({ player: "Open One", result: "", actual: null }), // open: never shown
        row({ player: "Open Two", result: "W", actual: null }), // no actual: never shown
        row({ player: "Bad Stat", stat: "steals" }),
      ],
    },
  },
};

// normalise: settled only
assert.equal(normaliseRow(row({ result: null }), "nba"), null);
assert.equal(normaliseRow(row({ actual: "" }), "nba"), null);
assert.equal(normaliseRow(row({ pct: 62, light: "" }), "nba").light, "GREEN");
assert.equal(normaliseRow(row({ call: "under" }), "nba").call, "Under");

const res = resultsFrom({ payload });
assert.deepEqual(sportIds(res), ["nba", "nhl"], "NBA first, then other sports present in the data");
assert.equal(res.sports.nba.length, 4);
assert.equal(res.sports.nba[0].player, "Player B", "newest first");
assert.ok(!res.sports.nba.some((r) => /Open|Bad/.test(r.player)));

// tally: pushes excluded from hit %
assert.deepEqual(tally(res.sports.nba), { w: 2, l: 1, p: 1, pct: 2 / 3 });
assert.equal(dateLabel("2026-11-14"), "Sat 14 Nov");

// empty / missing snapshot
assert.equal(resultsFrom(null), null);
assert.equal(resultsFrom({ payload: { sports: {} } }), null);
assert.equal(resultsFrom({ payload: { sports: { nba: { rows: [row({ result: "" })] } } } }), null);
assert.ok(renderBody(null).includes(EMPTY_TEXT));

// body: Green on by default, only Green rows visible, Green card first
const body = renderBody(res);
assert.match(body, /class="gf-btn GREEN on" data-light="GREEN" aria-pressed="true"/);
assert.match(body, /class="gf-btn ORANGE" data-light="ORANGE" aria-pressed="false"/);
assert.ok(body.indexOf('data-card="GREEN"') < body.indexOf('data-card="ORANGE"'));
assert.ok(body.indexOf('data-card="ORANGE"') < body.indexOf('data-card="RED"'));
assert.ok(body.indexOf("pr-summary") < body.indexOf("Members get today's full player props"));
for (const s of ["All", "Points", "Rebounds", "Assists", "Threes"]) assert.ok(body.includes(`>${s}</button>`), s);
assert.ok(body.includes('href="/members?next=%2Fprops%2Fnba#memberSignIn"'), "sign-in returns to /props/nba");
assert.ok(body.includes('href="/join"'));
const visible = [...body.matchAll(/<li class="pr-row (\w+)"[^>]*?( hidden)?>/g)];
assert.ok(visible.length === 5);
for (const m of visible) assert.equal(!m[2], m[1] === "GREEN" && m[0].includes('data-sport="nba"'), "only NBA green rows visible by default");

// page via the route: stubbed Supabase
const realFetch = globalThis.fetch;
let snapshot = payload;
globalThis.fetch = async (input) => {
  const url = String(input.url || input);
  if (url.includes("tips_page_snapshot") && url.includes("id=eq.props-results")) return new Response(JSON.stringify(snapshot ? [{ payload: snapshot }] : []), { headers: { "content-type": "application/json" } });
  if (url.includes("tips_page_snapshot")) return new Response("[]", { headers: { "content-type": "application/json" } });
  throw new Error("unexpected fetch in test: " + url);
};
const ctx = (path) => ({ request: new Request("https://x.test" + path), env: { SUPABASE_SERVICE_ROLE_KEY: "k", ASSETS: { fetch: async () => new Response("{}", { status: 404 }) } } });
_resetResultsCache();
const r = await page(ctx("/props/results"));
assert.equal(r.status, 200);
assert.match(r.headers.get("cache-control"), /s-maxage=60/);
const h = await r.text();
assert.ok(h.includes("Every graded player prop call, updated daily."));
assert.ok(h.includes("Player B") && !h.includes("Open One"));
assert.ok(h.includes('<a href="/props/results" aria-current="page">Props Results</a>'));
// copy rules (this page's own copy, not the shared footer): no method, units or money talk
const pageBody = h.slice(h.indexOf("<h1>"), h.indexOf("Gamble responsibly"));
const visibleText = pageBody.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
for (const bad of [/\bmodel/i, /projection/i, /\bminutes\b/i, /calibrat/i, /\bmethod/i, /\bcap(s|ped)?\b/i, /paper/i, /\bunits?\b/i, /\bROI\b/, /profit/i, /fresh record/i]) assert.ok(!bad.test(visibleText), "copy avoids " + bad);

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
