// Props prices by country: /api/geo, AU vs US price cells (decimal vs American), "No US price", the toggle,
// the player view's region, and the browser script that picks the region (geo once, manual choice wins).
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { countryOf, regionOf, onRequestGet as geo } from "../functions/api/geo.js";
import { american, fmtPrice, itemFromSportRow, itemFromNbaRow, cardHtml, usCells, regionToggle } from "../functions/_shared/prop-cards.js";
import { propRow, renderSportBoard, previewSample, HEAD } from "../functions/_shared/sport-props.js";
import { predictionRow, statOf, dataStatOf, boardHasBooks } from "../functions/_shared/nba-props.js";

// ---- /api/geo: Cloudflare country only
const req = (cf, hdr) => ({ cf, headers: new Map(Object.entries(hdr || {})) });
assert.equal(countryOf(req({ country: "US" })), "US");
assert.equal(countryOf(req({ country: "au" })), "AU");
assert.equal(countryOf(req(undefined, { "cf-ipcountry": "US" })), "US", "falls back to the CF-IPCountry header");
assert.equal(countryOf(req({ country: "XX" })), null, "unknown");
assert.equal(countryOf(req(undefined, {})), null);
assert.equal(regionOf("US"), "us");
for (const c of ["AU", "NZ", "GB", "CA", null]) assert.equal(regionOf(c), "au", `${c}: AU prices`);
const gr = await geo({ request: req({ country: "US" }) });
assert.deepEqual(await gr.json(), { country: "US", region: "us" });
assert.match(gr.headers.get("cache-control"), /no-store/, "never cached for someone else");

// ---- American odds
assert.equal(american(2.5), "+150");
assert.equal(american(1.91), "-110");
assert.equal(american(2.0), "+100");
assert.equal(american(1.5), "-200");
assert.equal(american(11), "+1000");
assert.equal(american(null), "—");
assert.equal(american(1), "—");
assert.equal(fmtPrice(1.9, "au"), "1.90");
assert.equal(fmtPrice(1.9, "us"), "-111");

// ---- NFL/NHL card: same layout, both regions rendered, CSS shows one
const au = [{ key: "sportsbet", name: "Sportsbet", region: "au", over: 1.9, under: 1.85 }, { key: "tab", name: "TAB", region: "au", over: 1.95, under: 1.8 }];
const us = [{ key: "draftkings", name: "DraftKings", region: "us", over: 1.87, under: 2.05 }, { key: "fanduel", name: "FanDuel", region: "us", over: 2.1, under: 1.8 }];
const row = { player: "Brock Ellery", team: "San Francisco 49ers", team_abbr: "SF", position: "QB", market: "player_pass_yds", kind: "ou", line: 267.5,
  books: au, books_us: us, log: [{ date: "2026-11-15", opp: "ATL", ha: "A", v: 280 }], season: { gp: 9, avg: 262 },
  hits: { l5: { n: 5, over: 3, under: 2 }, l10: { n: 9, over: 5, under: 4 }, season: { n: 9, over: 5, under: 4 } } };
const card = cardHtml(itemFromSportRow("nfl", row, "Passing yards", "ORANGE", "Over"), "g-0", "");
assert.match(card, /<div class="ppc-prices rg-au"><div><small>Over<\/small><b>1\.95<\/b><span>TAB<\/span><\/div><div><small>Under<\/small><b>1\.85<\/b><span>Sportsbet<\/span>/, "AU: decimal, best per side + bookie");
assert.match(card, /<div class="ppc-prices rg-us"><div><small>Over<\/small><b>\+110<\/b><span>FanDuel<\/span><\/div><div><small>Under<\/small><b>\+105<\/b><span>DraftKings<\/span>/, "US: American, best per side + bookie");
assert.equal((card.match(/class="ppc-prices/g) || []).length, 2, "one price block per region, nothing else added");
assert.match(card, /Passing yards <b>267\.5<\/b>/);
assert.match(card, /<small>L5<\/small><b>60%<\/b>/, "form row unchanged");
// Chance (PR #44) comes from AU prices only: the passed light is replaced by the Chance light, and US prices never move it
const it0 = itemFromSportRow("nfl", row, "Passing yards", "ORANGE", "Over");
const itNoUs = itemFromSportRow("nfl", { ...row, books_us: [] }, "Passing yards", "ORANGE", "Over");
const itOtherUs = itemFromSportRow("nfl", { ...row, books_us: [{ key: "fanduel", name: "FanDuel", region: "us", over: 1.2, under: 4.5 }] }, "Passing yards", "ORANGE", "Over");
assert.deepEqual(it0.chance, { side: "Over", p: (5 + 10 * ((1 / 1.9) / (1 / 1.9 + 1 / 1.85))) / 19 }, "Sportsbet AU price, margin removed, moved toward 5/9");
assert.deepEqual(itNoUs.chance, it0.chance);
assert.deepEqual(itOtherUs.chance, it0.chance, "US prices do not change the Chance");
assert.equal(it0.light, itNoUs.light);
assert.equal(itOtherUs.light, itNoUs.light);
assert.match(card, /ppc-chance hl-RED">Chance <b>Over<\/b> · <b>52%<\/b>/);
assert.match(card, /chip RED/);
const usOnlyIt = itemFromSportRow("nfl", { ...row, books: [] }, "Passing yards", "", "");
assert.equal(usOnlyIt.chance, null, "US price only: no Chance");
assert.equal(usOnlyIt.light, "", "US price only: no light");

// no US price -> blank US cells; no AU price -> blank AU cells
const noUs = cardHtml(itemFromSportRow("nfl", { ...row, books_us: [] }, "Passing yards", "", ""), "x", "");
assert.match(noUs, /ppc-noau rg-us"><div><small>Over<\/small><b>-<\/b><span>No US price<\/span>/);
assert.match(noUs, /ppc-prices rg-au"><div><small>Over<\/small><b>1\.95/);
const oldBoard = cardHtml(itemFromSportRow("nhl", { ...row, books_us: undefined }, "Shots", "", ""), "x", "");
assert.match(oldBoard, /No US price/, "a board from before the US patch: US cells blank");
const noAu = cardHtml(itemFromSportRow("nfl", { ...row, books: [], no_au_price: true }, "Passing yards", "", ""), "x", "");
assert.match(noAu, /ppc-noau rg-au">.*No AU price/s);
assert.match(noAu, /ppc-prices rg-us"><div><small>Over<\/small><b>\+110/);
// anytime market in the US
const yesRow = { ...row, market: "player_anytime_td", kind: "yes", line: null, books: [{ key: "sportsbet", name: "Sportsbet", yes: 3.4 }],
  books_us: [{ key: "draftkings", name: "DraftKings", yes: 3.5 }, { key: "betmgm", name: "BetMGM", yes: 3.25 }], hits: null, rates: { l8: { n: 8, yes: 3 }, season: { n: 9, yes: 3 } } };
const yc = cardHtml(itemFromSportRow("nfl", yesRow, "Anytime TD", "", ""), "x", "");
assert.match(yc, /rg-us"><div><small>Best price<\/small><b>\+250<\/b><span>DraftKings<\/span><\/div>\s*<div><small>Implied chance<\/small><b>28%<\/b>/);

// ---- desktop table: AU columns (Sportsbet / Best other) and US columns (Best Over / Best Under), CSS shows one pair
assert.equal((HEAD.match(/class="num rg-au"/g) || []).length, 2);
assert.equal((HEAD.match(/class="num rg-us"/g) || []).length, 2);
const tr = propRow("nfl", row, "x");
assert.match(tr, /<td class="num pp-price rg-us"><b>\+110<\/b><small>FanDuel<\/small><\/td><td class="num pp-price rg-us"><b>\+105<\/b><small>DraftKings<\/small><\/td>/);
assert.equal((tr.match(/<td[^>]*rg-au/g) || []).length, 2);
assert.equal((propRow("nfl", { ...row, books_us: [] }, "x").match(/No US price/g) || []).length, 2);
assert.match(usCells(yesRow), /<b>\+250<\/b><small>DraftKings<\/small>.*<b>28%<\/b><small>implied<\/small>/s);

// ---- NBA: books_us carried; US cells next to the AU ones
const nbaPlayer = { player: "Jalen Test", team: "Boston Celtics", stats: { points: { season_avg: 25, line: 24.5, proj: 26, p_over: 0.6, p_under: 0.4, books: au, books_us: us } } };
const s = statOf(nbaPlayer, "points");
assert.deepEqual(s.books_us, us);
const nbaTr = predictionRow({ ...nbaPlayer, stat: "points", s, light: "GREEN" }, { books: true });
assert.match(nbaTr, /rg-us"><b>\+110<\/b><small>FanDuel/);
assert.match(nbaTr, /rg-au"><span><b>1\.90<\/b><b>1\.85<\/b>/);
const nbaItem = itemFromNbaRow({ ...nbaPlayer, stat: "points", s, light: "GREEN" }, "Points", "BOS");
assert.deepEqual(nbaItem.books_us, us);
assert.match(cardHtml(nbaItem, "x", ""), /rg-us"><div><small>Over<\/small><b>\+110<\/b>/);
const usOnly = { player: "Data Only", team: "Boston Celtics", game_log: [], stats: { pra: { line: 36.5, line_source: "book", books: [], books_us: us } } };
assert.deepEqual(dataStatOf(usOnly, "pra").books_us, us, "a data-only stat only US books price still shows");
assert.ok(boardHasBooks({ games: [{ commence_utc: "2099-01-01T00:00:00Z", players: [usOnly] }] }), "US-only prices turn the price columns on");

// ---- sample boards (fixtures from the mini jobs) render both regions; AU cells unchanged
for (const sport of ["nfl", "nhl"]) {
  const board = JSON.parse(fs.readFileSync(`data/${sport}_props/board.json`, "utf8"));
  const h = renderSportBoard(sport, board, { full: true });
  assert.ok(/rg-us"><b>[+-]\d+<\/b>/.test(h), `${sport}: US prices in American odds`);
  assert.ok(/No US price/.test(h) && /No AU price/.test(h), `${sport}: both blanks present in the sample`);
  for (const g of board.games) for (const r of g.props) {
    assert.ok((r.books || []).every((b) => b.region === "au") && (r.books_us || []).every((b) => b.region === "us"), "every price tagged with its region");
  }
}

// ---- toggle + preview-only sample switch
assert.match(regionToggle(), /data-set-region="au" aria-pressed="true"/);
assert.match(regionToggle(), /data-set-region="us" aria-pressed="false"/);
assert.equal(previewSample({ request: { url: "https://preview-props-us-region.probalab.pages.dev/props/nfl?sample=1" } }), true);
assert.equal(previewSample({ request: { url: "https://probalabsports.com/props/nfl?sample=1" } }), false, "never on the live site");
assert.equal(previewSample({ request: { url: "https://x.pages.dev/props/nfl" } }), false);

// ---- props-region.js in a tiny browser stand-in
function runRegion({ store = {}, geoCountry = "US", fetchOk = true } = {}) {
  const attrs = {}, listeners = {}, fetched = [];
  const btn = (rg) => ({ rg, cls: new Set(), pressed: null, getAttribute: (k) => (k === "data-set-region" ? rg : null),
    classList: { toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, _s: null }, setAttribute(k, v) { this.pressed = v; } });
  const buttons = [btn("au"), btn("us")];
  buttons.forEach((b) => { b.classList._s = b.cls; });
  let resolveGeo;
  const geoDone = new Promise((r) => { resolveGeo = r; });
  const ctx = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: {
      documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] ?? null },
      querySelectorAll: () => buttons, readyState: "complete",
      addEventListener: (t, f) => { listeners[t] = f; }, dispatchEvent: () => true,
    },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    fetch: (url) => { fetched.push(url); const p = Promise.resolve(fetchOk ? { ok: true, json: () => Promise.resolve({ country: geoCountry }) } : { ok: false });
      p.then(() => setTimeout(resolveGeo, 0)); return p; },
  };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync("props-region.js", "utf8"), ctx);
  const click = (rg) => listeners.click({ target: { closest: () => buttons.find((b) => b.rg === rg) } });
  return { attrs, store, fetched, buttons, click, geoDone };
}
{ // first visit from the US: AU until /api/geo answers, then US; cached
  const t = runRegion({ geoCountry: "US" });
  assert.equal(t.attrs["data-region"], "au");
  await t.geoDone;
  assert.equal(t.attrs["data-region"], "us");
  assert.equal(t.store.pl_geo_country, "US");
  assert.deepEqual(t.fetched, ["/api/geo"]);
  assert.equal(t.buttons[1].pressed, "true");
}
{ // cached country: no second call
  const t = runRegion({ store: { pl_geo_country: "US" } });
  assert.equal(t.attrs["data-region"], "us");
  assert.deepEqual(t.fetched, [], "geo is asked once, then read from localStorage");
}
{ // Australia, or unknown -> AU
  const t = runRegion({ geoCountry: "AU" }); await t.geoDone;
  assert.equal(t.attrs["data-region"], "au");
  const u = runRegion({ geoCountry: null }); await u.geoDone;
  assert.equal(u.attrs["data-region"], "au"); assert.equal(u.store.pl_geo_country, "XX");
}
{ // manual choice overrides the country and is remembered
  const t = runRegion({ store: { pl_geo_country: "US" } });
  t.click("au");
  assert.equal(t.attrs["data-region"], "au");
  assert.equal(t.store.pl_props_region, "au");
  const again = runRegion({ store: t.store });
  assert.equal(again.attrs["data-region"], "au", "remembered on the next page");
  const fresh = runRegion({ store: { pl_props_region: "us" }, geoCountry: "AU" }); await fresh.geoDone;
  assert.equal(fresh.attrs["data-region"], "us", "a manual choice beats a detected country");
}
{ // geo unreachable: AU, nothing cached (asked again next visit)
  const t = runRegion({ fetchOk: false }); await t.geoDone;
  assert.equal(t.attrs["data-region"], "au"); assert.ok(!("pl_geo_country" in t.store));
}

// ---- player view: region-aware list, American odds, "No US price"
const pv = fs.readFileSync("props-cards.js", "utf8");
assert.match(pv, /it\.books_us/);
assert.match(pv, /No US price for this prop/);
assert.match(pv, /Prices · ' \+ \(region\(\) === "us" \? "US sportsbooks" : "AU bookies"\)/);

// ---- pages carry the toggle and the region script before the board
for (const f of ["functions/_shared/sport-props-page.js", "functions/props/nba.js"]) {
  const src = fs.readFileSync(f, "utf8");
  assert.ok(src.indexOf('<script src="/props-region.js"></script>') < src.indexOf('id="propsBoard"'), `${f}: region set before the board paints`);
  assert.match(src, /regionToggle\(\)/);
}
const css = fs.readFileSync("props.css", "utf8");
assert.match(css, /html\[data-region="us"\] \.rg-au \{ display: none !important; \}/);
assert.match(css, /html:not\(\[data-region="us"\]\) \.rg-us \{ display: none !important; \}/);
console.log("props-us-region: ok");
