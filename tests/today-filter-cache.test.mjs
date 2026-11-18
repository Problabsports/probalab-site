// Today filter cache (18 Nov 2026): switching ?light= on /today and /<sport>/today must show that filter's own,
// current list. Before this fix the sport page cache keyed on the path only, so /nba/today?light=all could return the
// cached green page for up to 60s, and the edge copy's max-age=60 leaked to the browser.
import assert from "node:assert/strict";
import { todayCachePlan, TODAY_PAGE_TTL } from "../functions/_shared/game-filters.js";
import { handleSport, sportPageCachePlan } from "../functions/_shared/site.js";
import { onRequestGet as todayGet } from "../functions/today.js";

const O = "https://probalabsports.com";

// ---------------------------------------------------------------- cache plan: one key per filter view
{
  const def = todayCachePlan(`${O}/nba/today`);
  assert.equal(def.key, `${O}/nba/today`);
  assert.equal(def.ttl, TODAY_PAGE_TTL);
  for (const q of ["?light=green", "?light=GREEN", "?light=nonsense", "?sport=all", "?utm_source=x"]) {
    assert.deepEqual(todayCachePlan(`${O}/nba/today${q}`), def, `${q} renders the default view, so shares its copy`);
  }
  const keys = new Set();
  for (const light of ["green", "all", "super", "orange", "red"]) keys.add(todayCachePlan(`${O}/nba/today?light=${light}`).key);
  assert.equal(keys.size, 5, "every light filter has its own cache key");
  for (const light of ["all", "super", "orange", "red"]) {
    const p = todayCachePlan(`${O}/today?light=${light}`);
    assert.equal(p.key, `${O}/today?light=${light}`);
    assert.equal(p.ttl, 0, `${light}: a filtered view is never page-cached`);
  }
  assert.equal(todayCachePlan(`${O}/today?sport=nhl`).ttl, 0);
  assert.equal(todayCachePlan(`${O}/today?light=all&sport=nba`).key, `${O}/today?sport=nba&light=all`, "canonical order");
}
{
  for (const s of ["nba", "nfl", "nhl", "epl", "championship", "tennis"]) {
    assert.equal(sportPageCachePlan(`${O}/${s}/today?light=all`).key, `${O}/${s}/today?light=all`, s);
    assert.equal(sportPageCachePlan(`${O}/${s}/today?light=all`).ttl, 0, s);
    assert.equal(sportPageCachePlan(`${O}/${s}/today`).ttl, 60, s);
    // the sport page's own buttons link with ?sport=<s>; that is still the default view
    assert.deepEqual(sportPageCachePlan(`${O}/${s}/today?sport=${s}`), sportPageCachePlan(`${O}/${s}/today`), s);
    assert.equal(sportPageCachePlan(`${O}/${s}/today?sport=${s}&light=super`).key, `${O}/${s}/today?light=super`, s);
  }
  // hub and game pages ignore the query: path key, so ?x= cannot bust or split the cache
  assert.deepEqual(sportPageCachePlan(`${O}/nba?light=all`), { key: `${O}/nba`, ttl: 60 });
  assert.deepEqual(sportPageCachePlan(`${O}/nba/bos-vs-ny-prediction-2026-11-19-1?x=1`), { key: `${O}/nba/bos-vs-ny-prediction-2026-11-19-1`, ttl: 60 });
}

// ---------------------------------------------------------------- end to end through handleSport with an edge cache
const soon = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const feed = {
  season: 2027,
  games: [
    { season: 2027, status: "pre", game_id: "9001", start_utc: soon(3), home: "BOS", away: "NY", pick: "BOS", pick_p: 0.74, light: "GREEN" },
    { season: 2027, status: "pre", game_id: "9002", start_utc: soon(5), home: "MIA", away: "ORL", pick: "MIA", pick_p: 0.51, light: "RED" },
  ],
};
const store = new Map();
const puts = [];
globalThis.caches = {
  default: {
    async match(req) { const r = store.get(req.url); return r ? r.clone() : undefined; },
    async put(req, res) { if (!req.url.includes("/api/feed")) puts.push(req.url); store.set(req.url, res.clone()); }, // puts: page copies only
  },
};
let feedCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.startsWith("https://feed.test/")) { feedCalls++; return new Response(JSON.stringify(u.includes("sport=nba") ? feed : { season: 2027, games: [] }), { headers: { "content-type": "application/json" } }); }
  return new Response("{}", { status: 404 }); // injuries etc.
};
const ctx = (path) => {
  const pending = [];
  return {
    request: new Request(`${O}${path}`),
    params: { path: path.split("?")[0].split("/").filter(Boolean).slice(1) },
    env: { FEED_BASE: "https://feed.test/feed", ASSETS: { fetch: async () => new Response("{}", { status: 404 }) } },
    waitUntil: (p) => pending.push(p),
    done: () => Promise.all(pending),
  };
};
const get = async (path) => { const c = ctx(path); const r = await handleSport(c, "nba"); const body = await r.text(); await c.done(); return { r, body }; };
const BOS = '-9001"><span class="d">', MIA = '-9002"><span class="d">'; // visible list rows (JSON-LD and intro text name every game)

try {
  // 1. default (green) view: rendered, page-cached under the plain path
  const a = await get("/nba/today");
  assert.equal(a.r.status, 200);
  assert.ok(a.body.includes(BOS) && !a.body.includes(MIA), "green view: green game only");
  assert.deepEqual(puts, [`${O}/nba/today`]);
  assert.match(a.r.headers.get("cache-control"), /max-age=0/, "browser always revalidates");

  // 2. All lights straight after: must NOT be the cached green page
  const b = await get("/nba/today?light=all");
  assert.ok(b.body.includes(BOS) && b.body.includes(MIA), "All lights shows every game straight away");
  assert.match(b.body, /aria-current="true">All</, "All lights button is the active one");
  assert.equal(b.r.headers.get("cache-control"), "no-cache");
  assert.deepEqual(puts, [`${O}/nba/today`], "filtered view is not written to the page cache");

  // 3. Best value, then Green again: each its own result; Green comes from the edge copy
  const c = await get("/nba/today?light=super");
  assert.ok(!c.body.includes(MIA), "Best value view does not reuse the All lights list");
  assert.match(c.body, /aria-current="true">Best value</);
  const before = feedCalls;
  const d = await get("/nba/today?sport=nba"); // the Green button's own link on the sport page
  assert.equal(d.body, a.body, "?light=green is the default view's copy");
  assert.equal(feedCalls, before, "default view served from the page cache");
  assert.match(d.r.headers.get("cache-control"), /max-age=0/, "edge-only max-age=60 is not handed to the browser");
  assert.equal(d.r.headers.get("x-pl-origin-cache-control"), null, "internal header stripped");

  // 4. main /today: default view keeps a short shared cache, filtered views are no-cache
  for (const [q, cc] of [["", /s-maxage=60/], ["?light=all", /^no-cache$/], ["?light=super", /^no-cache$/], ["?sport=nba", /^no-cache$/]]) {
    const t = await todayGet(ctx(`/today${q}`));
    assert.equal(t.status, 200, q);
    assert.match(t.headers.get("cache-control"), cc, `/today${q}`);
  }
  const all = await (await todayGet(ctx("/today?light=all"))).text();
  const row = (h, id) => h.includes("today-games") && new RegExp(`href="[^"]*-${id}"`).test(h.slice(h.indexOf("today-games")));
  assert.ok(row(all, "9001") && row(all, "9002"), "/today?light=all lists both games");
  const green = await (await todayGet(ctx("/today"))).text();
  assert.ok(row(green, "9001") && !row(green, "9002"), "/today default: green only");
} finally {
  globalThis.fetch = realFetch;
  delete globalThis.caches;
}

console.log("today-filter-cache: ok");
