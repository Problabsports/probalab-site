// website/full-polish-and-gate: paused sports, CLV proof, free-board soft unlock.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { clvCoverage, clvProofPanel, renderResultsPage, trustStrip } from "../functions/_shared/record-pages.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

// ---------------------------------------------------------------- paused sports
for (const sp of ["tennis", "championship"]) {
  const src = read(`functions/${sp}/[[path]].js`);
  assert.match(src, /pausedSportPage\(ctx, "/, `${sp}: paused notice`);
  assert.match(src, /handleSportRecordRequest/, `${sp}: past results still redirect`);
}
const paused = read("functions/_shared/paused.js");
assert.match(paused, /noindex: true/);
assert.match(paused, /We're focusing on <b>NBA, NFL and NHL<\/b>/);
assert.doesNotMatch(read("functions/sitemap.xml.js"), /loc: "\/(tennis|championship)"/, "paused sports not in sitemap");

// ---------------------------------------------------------------- CLV coverage + proof panel
const rows = [
  { won: true, posted_price: 1.8, close_price: 1.7, vs_close: 0.05, light: "GREEN", sport: "nba" },
  { won: false, posted_price: 2.0, close_price: 2.1, vs_close: -0.05, light: "ORANGE", sport: "nba" },
  { won: true, posted_price: null, close_price: null, vs_close: null, light: "GREEN", sport: "nba" },
];
assert.deepEqual(clvCoverage(rows), { picks: 3, tracked: 2, pct: 66.6, beat: 1, mean: 0 });
assert.equal(clvCoverage([]).pct, null);
const almost = Array.from({ length: 2000 }, (_, i) => ({ won: true, posted_price: 2, close_price: 2, vs_close: i ? 0 : null }));
assert.equal(clvCoverage(almost).pct, 99.9, "floored, never rounded up to 100%");
const panel = clvProofPanel([{ sport: "nba", name: "NBA", rows }, { sport: "nfl", name: "NFL", rows: [] }]);
assert.match(panel, /<b>NBA<\/b>: 2 of 3 finished picks \(66\.6%\)/);
assert.doesNotMatch(panel, /<b>NFL<\/b>/, "no line for a sport with no finished picks");
assert.match(panel, /timestamped before the start/);
assert.match(panel, /65%\+<\/b> win chance/);
assert.match(panel, /longer than our fair price/);
assert.ok(!/pinnacle/i.test(panel), "no bookmaker names on public pages");
assert.match(trustStrip(), /href="\/results#proof"/);
const page = renderResultsPage([{ sport: "nba", name: "NBA", season: "2026–27", rows: rows.map((r, i) => ({ ...r, id: String(i), start_utc: "2026-11-0" + (i + 1) + "T00:00:00Z", home: "A", away: "B", pick: "A", pick_p: 0.7, score: "1–0", href: "/nba/x" })) }]);
assert.match(page, /id="proof"/);
// paused sports keep their rows on /results, unlinked
const pr = renderResultsPage([{ sport: "tennis", name: "Tennis", season: "2026", rows: [{ id: "t", sport: "tennis", start_utc: "2026-11-01T00:00:00Z", home: "A", away: "B", pick: "A", pick_p: 0.7, light: "GREEN", won: true, score: "", href: "/tennis#game-t" }] }], { sport: "all", light: "all" });
assert.doesNotMatch(pr, /href="\/tennis#game-t"/);

// ---------------------------------------------------------------- free-board soft unlock
const fb = read("free-board.js");
for (const s of [
  "Unlock today’s full NBA, NFL & NHL fair-odds board — 100% Free",
  "Enter your email once for instant full-board access on this device, our free Discord live-alert link, and ProbaLab recap updates.",
  "Board Unlocked — Join Free Discord for Live Alerts",
  'var KEY = "pl_free_unlocked";',
  "var FREE_PER_SPORT = 2;",
]) assert.ok(fb.includes(s), s);
// Only model numbers are blurred; team names (.m, .nm, .pf-teams) and times (.d, .time, .pf-time) never are.
const blurCss = fb.slice(fb.indexOf("var CSS = ["), fb.indexOf("].join"));
for (const keep of [".m,", ".nm", ".time", ".pf-time", ".pf-teams", ".d,"]) assert.ok(!blurCss.includes(keep), `does not blur ${keep}`);

// Load it in a tiny sandbox: PATH_OK, unlock flag, member session.
function load({ path = "/today", storage = {} } = {}) {
  const ls = { ...storage };
  const localStorage = {
    getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); },
    key: (i) => Object.keys(ls)[i] ?? null, get length() { return Object.keys(ls).length; },
  };
  const noop = () => {};
  const el = () => ({ setAttribute: noop, appendChild: noop, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, style: {} });
  const document = {
    readyState: "complete", head: el(), body: el(), documentElement: el(),
    createElement: el, querySelectorAll: () => [], addEventListener: noop,
  };
  const window = { localStorage, addEventListener: noop };
  const ctx = { window, document, location: { pathname: path }, MutationObserver: class { observe() {} disconnect() {} }, setTimeout, Promise, fetch: async () => ({ json: async () => ({ ok: true }) }) };
  vm.runInNewContext(fb, ctx);
  return { gate: window.PLGate, signup: window.PLSignup, ls };
}
let g = load();
for (const p of ["/", "/today", "/nba", "/nfl", "/nhl", "/epl", "/nhl/app", "/epl/app", "/nba/today"]) assert.ok(g.gate.PATH_OK.test(p), `gated: ${p}`);
for (const p of ["/results", "/nba/team/x", "/nba/a-vs-b-prediction-2026-11-28-1", "/members", "/props/nba", "/tennis"]) assert.ok(!g.gate.PATH_OK.test(p), `not gated: ${p}`);
assert.equal(g.gate.isUnlocked(), false);
assert.equal(load({ storage: { pl_free_unlocked: "1" } }).gate.isUnlocked(), true);
assert.equal(load({ storage: { "sb-zwdpsereqicvzbtfrrnd-auth-token": '{"access_token":"x"}' } }).gate.isUnlocked(), true, "member session skips the gate");
g.gate.unlock();
assert.equal(g.ls.pl_free_unlocked, "1");

// A successful sign-up unlocks; a failed one does not.
g = load();
const form = { email: { value: "a@b.co" }, website: { value: "" }, source: { value: "t" }, querySelector: () => null };
assert.equal((await g.signup.submit(form)).ok, true);
assert.equal(g.ls.pl_free_unlocked, "1");
g = load();
assert.equal((await g.signup.submit({ ...form, email: { value: "nope" } })).ok, false);
assert.equal(g.ls.pl_free_unlocked, undefined);

// Every page with a board loads the script.
assert.match(read("index.html"), /<script src="\/free-board\.js"><\/script>/);
assert.match(read("functions/_shared/site.js"), /<script src="\/free-board\.js"><\/script>/);

console.log("polish-gate tests passed");
