// NBA props page: per-stat data, single-line rows, light marker, free-view gating, copy rules.
import assert from "node:assert/strict";
import fs from "node:fs";
import { statOf, preparePlayers, renderCards, renderPanels, lightOf, sortedGames, freePicks, hasStat, FREE_PER_GAME, STATS, loadBoard, realBoardFrom, statusLabel, isHiddenStatus, updatedLabel, boardStats, _resetBoardCache } from "../functions/_shared/nba-props.js";
import { chip } from "../functions/_shared/site.js";
import { onRequestGet as page } from "../functions/props/nba.js";
import { onRequestGet as api } from "../functions/api/props-nba.js";
import { onRequestGet as rawData } from "../functions/data/nba_points_props/[[path]].js";

const board = JSON.parse(fs.readFileSync(new URL("../data/nba_points_props/board.json", import.meta.url), "utf8"));
assert.equal(board.sample, true, "fixture is marked as sample");
assert.equal(board.games.length, 3);

// data shape: one block per stat; line = nearest half-point to the season average
assert.deepEqual(STATS.map(([id]) => id), ["points", "rebounds", "assists", "threes"]);
for (const p of board.games.flatMap((g) => g.players).filter((p) => p.status !== "Out")) {
  const s = p.stats.points;
  for (const k of ["season_avg", "line", "proj", "sigma", "p_over", "p_under"]) assert.ok(k in s, p.player + " has " + k);
  assert.equal(s.line % 1, 0.5, "half-point line");
  assert.ok(Math.abs(s.line - s.season_avg) <= 0.5, "line is the nearest half-point to the season average");
}
assert.ok(hasStat(board, "points"));
for (const st of ["rebounds", "assists", "threes"]) assert.ok(!hasStat(board, st));

// statOf: stronger side and legacy points shape
const s1 = statOf({ stats: { points: { season_avg: 20.2, line: 20.5, proj: 23, p_over: 0.64, p_under: 0.36 } } }, "points");
assert.equal(s1.side, "Over"); assert.equal(s1.p, 0.64);
const legacy = statOf({ proj_pts: 18, primary_line: { line: 18.5, p_over: 0.45, p_under: 0.55 } }, "points");
assert.equal(legacy.side, "Under"); assert.equal(legacy.line, 18.5);

// light: green 60%+, orange 55–59%, red under 55% (by the % shown)
assert.equal(lightOf(0.6), "GREEN");
assert.equal(lightOf(0.596), "GREEN");
assert.equal(lightOf(0.57), "ORANGE");
assert.equal(lightOf(0.548), "ORANGE");
assert.equal(lightOf(0.52), "RED");

// sort: strongest call first within each game; Out players without data are not listed
for (const g of board.games) {
  const a = preparePlayers(g.players);
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].s.p >= a[i].s.p);
  assert.ok(!a.some((p) => p.status === "Out"));
}
const order = sortedGames(board).map((g) => Date.parse(g.commence_syd));
assert.deepEqual(order, [...order].sort((a, b) => a - b));

// free view: top FREE_PER_GAME by projection, at least one per team; others are placeholders
const free = renderCards(board, { full: false });
for (const g of board.games) {
  const all = preparePlayers(g.players);
  const picks = [...freePicks(all, [g.away, g.home])];
  assert.equal(picks.length, FREE_PER_GAME);
  assert.ok(picks.some((p) => p.team === g.away) && picks.some((p) => p.team === g.home), "one from each team");
  const byProj = all.slice().sort((a, b) => b.s.proj - a.s.proj);
  assert.ok(picks.includes(byProj[0]), "top projection is free");
  all.forEach((x) => assert.equal(free.includes(x.player), picks.includes(x), (picks.includes(x) ? "free shows " : "free hides ") + x.player));
}
const lop = preparePlayers([["A1", "A", 30], ["A2", "A", 28], ["A3", "A", 26], ["B1", "B", 10]].map(([player, team, proj]) => ({ player, team, stats: { points: { season_avg: proj, line: proj + 0.5, proj, p_over: 0.48, p_under: 0.52 } } })));
assert.deepEqual([...freePicks(lop, ["A", "B"])].map((p) => p.player).sort(), ["A1", "A2", "B1"]);
assert.ok(free.includes('<a class="btn pp-join" href="/join">Join members</a>'), "primary Join members button");
assert.ok(free.includes('<a class="btn pp-signin" href="/members?next=%2Fprops%2Fnba#memberSignIn">Members sign in</a>'), "secondary sign-in button returns to /props/nba");
assert.ok(/more predictions? in this game\.<\/p><div class="pp-cta">/.test(free), "count line above the buttons");
assert.ok(!/Sign in<\/a>, then come back/.test(free), "inline sign-in text link removed");
const full = renderCards(board, { full: true });
board.games.flatMap((g) => g.players).filter((p) => p.status !== "Out").forEach((x) => assert.ok(full.includes(x.player)));
assert.ok(!full.includes("Join members") && !full.includes("Members sign in"));

// rows: Player | Market | Line | Prediction | Chance | light chip (the Today page component) at the row edge
assert.match(full, /<th[^>]*>Player<\/th><th[^>]*>Market<\/th><th[^>]*>Line<\/th><th[^>]*>Prediction<\/th><th[^>]*>Chance<\/th>/);
assert.ok(!/>Minutes<|Proj min|O \d+% \/|pp-line|pp-side|projection|>Avg</i.test(full), "no minutes, projection or average columns");
const rows = full.match(/<tr class="pp-row lt-[\s\S]*?<\/tr>/g);
assert.equal(rows.length, board.games.flatMap((g) => g.players).filter((p) => p.status !== "Out").length);
for (const r of rows) {
  const call = r.match(/<td class="call">(Over|Under)<\/td>\s*<td class="num pct">(\d+)%<\/td>/);
  assert.ok(call, "prediction + chance cells: " + r);
  const light = lightOf(Number(call[2]) / 100);
  assert.ok(r.startsWith(`<tr class="pp-row lt-${light}"`), "row border follows the light");
  assert.ok(r.includes('<td class="mk">Points</td>'), "market cell");
  assert.ok(r.trimEnd().endsWith(`<td class="lt">${chip(light)}</td>\n    </tr>`), "light chip is the last cell");
  assert.ok(r.includes(`data-light="${light}"`), "row carries its light for the colour toggles");
}

// order: green first, then chance high to low, within every game card
for (const card of full.split('<section class="panel pp-game"').slice(1)) {
  const ps = [...card.matchAll(/data-light="(\w+)" data-p="([\d.]+)"/g)].map((m) => [["GREEN", "ORANGE", "RED"].indexOf(m[1]), Number(m[2])]);
  for (let i = 1; i < ps.length; i++) assert.ok(ps[i - 1][0] < ps[i][0] || (ps[i - 1][0] === ps[i][0] && ps[i - 1][1] >= ps[i][1]), "green first, then chance");
}
const panels = renderPanels(board, { full: false });
assert.ok(!panels.includes("Coming soon") && !panels.includes("pp-panel-"), "one board, no per-market tabs");

// injury watch for GTD / Questionable
assert.ok(full.includes("⚠️ GTD") && full.includes("⚠️ Questionable") && full.includes("Minutes uncertain"));

// copy rules
for (const h of [free, full]) {
  assert.ok(!/1\.49|best value|bet this|units?\b|\brecord\b|bookie/i.test(h.replace(/data-[a-z-]+="[^"]*"/g, "")), "no banned copy");
  assert.ok(!/\bmodel\b|nearest|method/i.test(h), "no method wording in the cards");
}

// routes with a fake ASSETS binding, a fixed clock and a stubbed fetch (no network).
// Supabase snapshot: snap.row is the row returned, snap.fail makes the read error.
const NOW = Date.parse("2026-11-15T12:00:00+11:00"); // before the sample games tip off
const snap = { row: null, fail: false, reads: 0 };
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  const auth = new Headers(init.headers || {}).get("authorization") || "";
  const j = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (url.includes("/rest/v1/tips_page_snapshot")) {
    snap.reads++;
    assert.ok(url.includes("id=eq.nba-props") && url.includes("select=payload,generated_at"));
    assert.equal(auth, "Bearer test-service-key", "snapshot read uses the server key");
    if (snap.fail) return j({ message: "boom" }, 500);
    return j(snap.row ? [snap.row] : []);
  }
  if (url.includes("/auth/v1/user")) return auth === "Bearer member-token" ? j({ email: "member@example.test" }) : j({ msg: "bad jwt" }, 401);
  if (url.includes("/rest/v1/member_allowlist")) return j(auth === "Bearer member-token" ? [{ role: "member" }] : []);
  throw new Error("unexpected fetch in test: " + url);
};
const ctx = (url, headers = {}, params = {}, now = NOW) => ({
  request: new Request(url, { headers }),
  params,
  now,
  env: {
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    ASSETS: { fetch: async () => new Response(fs.readFileSync(new URL("../data/nba_points_props/board.json", import.meta.url)), { headers: { "content-type": "application/json" } }) },
  },
});
const setSnap = (row, fail = false) => { snap.row = row; snap.fail = fail; _resetBoardCache(); };
setSnap(null);
const pr = await page(ctx("https://x.test/props/nba"));
const ph = await pr.text();
assert.equal(pr.status, 200);
assert.ok(ph.includes("Sample data"));
assert.ok(ph.includes('name="robots" content="noindex"'), "sample board is noindex");
for (const id of ["ppGame", "ppTeam", "ppMarket", "ppLights"]) assert.ok(ph.includes(`id="${id}"`), "filter " + id);
assert.ok(ph.includes("Predictions only, not betting advice."));
assert.ok(!ph.includes('id="pp-tab-hits"'), "no Hit rates tab without game logs");
const visible = ph.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ");
const pageCopy = visible.split("NBA player props")[2].split("Gamble responsibly")[0];
assert.ok(!/\bmodel\b|nearest|projecting|minutes column|method|how we|bookie/i.test(pageCopy), "no method wording on the page");
assert.ok(!/1\.49/.test(ph));
assert.equal((await api(ctx("https://x.test/api/props-nba"))).status, 401, "API needs a member token");
assert.equal((await rawData(ctx("https://x.test/data/nba_points_props/board.json", {}, { path: ["board.json"] }))).status, 404, "raw board hidden from the public");
// ---------------------------------------------------------------- real board from Supabase
const P = (player, team, status, stats) => ({ player, team, status, notes: "", stats });
const blk = (proj, over = 0.62) => ({ season_avg: proj - 1, line: proj - 0.5, proj, sigma: 5, p_over: over, p_under: 1 - over });
const GEN = "2026-11-15T07:31:00+11:00";
const realPayload = {
  sport: "nba", kind: "predictions", sample: false, tips: false, stats_available: ["points", "rebounds"],
  generated_at: GEN, timezone: "Australia/Sydney", counts: {},
  games: [
    { event_id: "e1", game: "Away One @ Home One", home: "Home One", away: "Away One", commence_syd: "2026-11-15T11:00:00+11:00", commence_utc: "2026-11-15T00:00:00Z",
      players: [
        P("Realname Alpha", "Away One", "Active", { points: blk(30), rebounds: blk(9) }),
        P("Realname Bravo", "Away One", "Day-To-Day", { points: blk(28) }),
        P("Realname Charlie", "Away One", "", { points: blk(26) }),
        P("Realname Delta", "Home One", "Questionable", { points: blk(12), rebounds: blk(4) }),
        P("Realname Echo", "Home One", "Probable", { points: blk(10) }),
        P("Realname Foxtrot", "Home One", "Out", {}),
        P("Realname Golf", "Home One", "Doubtful", {}),
        P("Realname Hotel", "Away One", "Suspension", {}),
      ] },
    { event_id: "e2", game: "Away Two @ Home Two", home: "Home Two", away: "Away Two", commence_syd: "2026-11-15T13:00:00+11:00", commence_utc: "2026-11-15T02:00:00Z",
      players: [
        P("Realname India", "Away Two", "Active", { points: blk(22) }),
        P("Realname Juliet", "Away Two", "Active", { points: blk(21) }),
        P("Realname Kilo", "Home Two", "Active", { points: blk(20) }),
        P("Realname Lima", "Home Two", "Active", { points: blk(19) }),
        P("Realname Mike", "Home Two", "Active", { points: blk(18) }),
      ] },
    // tipped off at 06:00 Sydney, 6h before NOW: hidden
    { event_id: "e3", game: "Old Away @ Old Home", home: "Old Home", away: "Old Away", commence_syd: "2026-11-15T06:00:00+11:00", commence_utc: "2026-11-14T19:00:00Z",
      players: [P("Realname Oldgame", "Old Away", "Active", { points: blk(25) })] },
  ],
  injured: [{ player: "Realname Foxtrot", team: "Home One", status: "Out" }],
};
const row = (payload, generated_at = payload.generated_at) => ({ payload, generated_at });
const REAL_NAMES = realPayload.games.flatMap((g) => g.players.map((p) => p.player));

// freshness / sample rules
assert.ok(realBoardFrom(row(realPayload), NOW), "fresh real board is used");
assert.equal(realBoardFrom(row(realPayload), Date.parse(GEN) + 36 * 3600e3), null, "36h old is stale");
assert.equal(realBoardFrom(row({ ...realPayload, sample: true }), NOW), null, "sample:true is never real");
assert.equal(realBoardFrom(row({ ...realPayload, games: [] }), NOW), null, "no games is not real");
assert.equal(realBoardFrom(null, NOW), null);

setSnap(row(realPayload));
let b = await loadBoard(ctx("https://x.test/props/nba"));
assert.equal(b.sample, false, "fresh real board used");
assert.deepEqual(b.games.map((g) => g.event_id), ["e1", "e2"], "game 3h+ past tip-off hidden");
const before = snap.reads;
await loadBoard(ctx("https://x.test/props/nba"));
assert.equal(snap.reads, before, "row cached for 60s");
await loadBoard(ctx("https://x.test/props/nba", {}, {}, NOW + 61e3));
assert.equal(snap.reads, before + 1, "re-read after 60s");

setSnap(row({ ...realPayload, generated_at: "2026-11-13T20:00:00+11:00" }));
b = await loadBoard(ctx("https://x.test/props/nba"));
assert.equal(b.sample, true, "board older than 36h falls back to the sample");

setSnap(null, true);
const logs = []; const log0 = console.log; console.log = (...a) => logs.push(a.join(" "));
b = await loadBoard(ctx("https://x.test/props/nba"));
console.log = log0;
assert.equal(b.sample, true, "Supabase error falls back to the sample");
assert.ok(logs.length === 1 && !logs[0].includes("test-service-key"), "short log line, no key");

setSnap(row({ ...realPayload, sample: true }));
b = await loadBoard(ctx("https://x.test/props/nba"));
assert.equal(b.sample, true);
assert.ok(b.games.every((g) => String(g.event_id).startsWith("sample-")), "sample:true row ignored, fixture used");

// every game past tip-off + 3h: empty panel, not the sample
setSnap(row(realPayload));
const late = Date.parse("2026-11-15T17:00:00+11:00");
const lateHtml = await (await page(ctx("https://x.test/props/nba", {}, {}, late))).text();
assert.ok(lateHtml.includes("No player props on the board yet. Check back closer to tip-off."));
assert.ok(!lateHtml.includes("Sample data") && !/Realname|Marcus Vale/.test(lateHtml), "no sample, no players");

// status mapping
assert.equal(statusLabel({ status: "Active" }), "");
assert.equal(statusLabel({ status: "" }), "");
assert.equal(statusLabel({ status: "Day-To-Day" }), "Day-to-day");
assert.equal(statusLabel({ status: "Questionable" }), "Questionable");
assert.equal(statusLabel({ status: "Probable" }), "Probable");
for (const st of ["Doubtful", "Out", "Suspension"]) { assert.ok(isHiddenStatus({ status: st })); assert.equal(statusLabel({ status: st }), ""); }
assert.ok(!isHiddenStatus({ status: "Questionable" }));

// real page: free view only
setSnap(row(realPayload));
const rp = await page(ctx("https://x.test/props/nba"));
const rh = await rp.text();
assert.equal(rp.status, 200);
assert.ok(!rh.includes("Sample data"), "no sample badge on the real board");
assert.ok(!rh.includes('content="noindex'), "real board is indexable");
assert.ok(rh.includes("Updated 7:31 am AEDT"), "updated time in Sydney short zone");
assert.ok(rh.includes("Sunday 15 November") && rh.includes(">2 games<") && rh.includes(">10 players<"), "strip counts from the real board");
for (const g of realPayload.games.slice(0, 2)) {
  const shown = g.players.filter((p) => rh.includes(p.player));
  assert.equal(shown.length, 3, "exactly 3 real players per game in " + g.game);
  assert.ok(shown.some((p) => p.team === g.home) && shown.some((p) => p.team === g.away), "one per team");
}
assert.deepEqual(REAL_NAMES.filter((n) => rh.includes(n)).sort(), ["Realname Alpha", "Realname Bravo", "Realname Delta", "Realname India", "Realname Juliet", "Realname Kilo"], "no other names anywhere in the HTML");
assert.ok(!/"stats"|p_over|season_avg|"payload"/.test(rh), "no inline board JSON");
assert.ok(rh.includes("⚠️ Day-to-day") && rh.includes("⚠️ Questionable") && rh.includes("Minutes uncertain"));
assert.ok(rh.includes('id="ppMemberNote"') && /id="ppMemberNote"[\s\S]*?Join members<\/a><a class="btn pp-signin"[^>]*>Members sign in<\/a>/.test(rh), "top line has both buttons");
assert.ok(!/>Sign in<\/a>/.test(rh.split('id="ppMemberNote"')[1].split("Gamble responsibly")[0]), "no small Sign in text links on the board");
const reb = (rh.match(/<tr class="pp-row[^"]*"[^>]*data-market="rebounds"[\s\S]*?<\/tr>/g) || []).join("");
assert.ok(reb.includes("Realname Alpha") && reb.includes("Realname Delta"), "rebounds rows live from data");
assert.ok(!reb.includes("Realname Bravo"), "player without a rebounds block has no rebounds row");
const mk = rh.match(/<select id="ppMarket">[\s\S]*?<\/select>/)[0];
assert.ok(mk.includes('value="points"') && mk.includes('value="rebounds"') && !mk.includes('value="assists"') && !mk.includes('value="threes"'), "market filter lists markets with data only");
const gm = rh.match(/<select id="ppGame">[\s\S]*?<\/select>/)[0];
assert.ok(gm.includes('value="e1"') && gm.includes('value="e2"') && !gm.includes('value="e3"'), "game filter lists today's games");

// API: 401 without a session, full board with one
assert.equal((await api(ctx("https://x.test/api/props-nba"))).status, 401);
assert.equal((await api(ctx("https://x.test/api/props-nba", { authorization: "Bearer nope" }))).status, 401);
const ok = await api(ctx("https://x.test/api/props-nba", { authorization: "Bearer member-token" }));
assert.equal(ok.status, 200);
assert.equal(ok.headers.get("cache-control"), "private, no-store");
const at = JSON.stringify(await ok.json());
for (const n of ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "India", "Juliet", "Kilo", "Lima", "Mike"]) assert.ok(at.includes("Realname " + n), "member sees " + n);
for (const n of ["Foxtrot", "Golf", "Hotel", "Oldgame"]) assert.ok(!at.includes("Realname " + n), "hidden: " + n);
assert.ok(!at.includes("Join members"));

// /join: sign-in link near the top of the form, props in the members copy
const { onRequestGet: joinPage } = await import("../functions/join.js");
const jh = await (await joinPage({ request: new Request("https://x.test/join"), env: {} })).text();
assert.ok(/<form id="joinForm"[\s\S]{0,200}Already a member\? <a href="\/members#memberSignIn">Sign in<\/a>/.test(jh), "join: sign-in link at the top of the form");
assert.ok(jh.includes("Members get the John, ProbaLab and Sniper desks, every NBA player prop projection, live tip alerts in Discord, and the members newsletter."));

// light toggles: the Today page chips (.game-filters.lights .gf-btn), all on by default, no "Greens only"
const lightsNav = rh.match(/<nav class="game-filters lights" id="ppLights"[\s\S]*?<\/nav>/);
assert.ok(lightsNav, "Today-style light chips on the page");
for (const c of ["GREEN", "ORANGE", "RED"]) assert.ok(lightsNav[0].includes(`class="gf-btn ${c} on" data-light="${c}" aria-pressed="true"`), c + " toggle on by default");
assert.ok(!/Greens only|ppGreens/.test(rh));
const clientSrc = fs.readFileSync(new URL("../props-nba.js", import.meta.url), "utf8");
assert.ok(/#ppLights \.gf-btn/.test(clientSrc) && /data-light/.test(clientSrc) && /locked\.hidden = filtering/.test(clientSrc), "client filters by light and keeps locked rows hidden while filtering");

// members lobby: Player Props card after the three member desks, NEW badge, no W–L / units
const propsFn = lobbySrcFor("propsCard");
function lobbySrcFor(name) { const src = fs.readFileSync(new URL("../members-lobby.js", import.meta.url), "utf8"); return src.slice(src.indexOf("function " + name), src.indexOf("\n  }\n", src.indexOf("function " + name))); }
assert.ok(propsFn.includes('href="/props/nba"') && propsFn.includes('<span class="badge taken">New</span>') && propsFn.includes('<p class="tipster-focus">NBA</p>'));
assert.ok(propsFn.includes("Every NBA player: points, rebounds, assists and threes, with the line, our projection and the call. Updated every morning."));
assert.ok(propsFn.includes("Open props →") && !/W–L|units|stat-grid/i.test(propsFn), "no W-L or units on the props card");
const lobbyAll = fs.readFileSync(new URL("../members-lobby.js", import.meta.url), "utf8");
const deskOrder = ['id: "john"', 'id: "sniper"', 'id: "probalab"', "+ propsCard()", 'name: "NFL Totals"'].map((k) => lobbyAll.indexOf(k));
assert.ok(deskOrder.every((i) => i > 0) && deskOrder.every((v, i) => i === 0 || v > deskOrder[i - 1]), "desk order unchanged; props card after the three desks, before owner-only desks");

// members-lobby next= guard: same-site paths only
const lobbySrc = fs.readFileSync(new URL("../members-lobby.js", import.meta.url), "utf8");
const guard = new RegExp(lobbySrc.match(/return \/(\^.*?\$)\/\.test\(n\)/)[1]);
for (const okp of ["/props/nba", "/today"]) assert.ok(guard.test(okp), "next ok: " + okp);
for (const badp of ["//evil.test", "https://evil.test", "/\\evil.test", "javascript:alert(1)", "/a?b", ""]) assert.ok(!guard.test(badp), "next blocked: " + badp);
assert.ok(!/"payload"|p_over|injured/.test(at), "API sends the rendered board, not the raw row");

// banned strings never in the page or the API
for (const t of [rh, at, ph, lateHtml]) for (const w of ["service_role", "test-service-key", "1.49", "Best value", "paper units"]) assert.ok(!t.includes(w), "no " + w);
assert.equal(updatedLabel("2026-07-01T07:30:00+10:00"), "7:30 am AEST");
assert.equal(boardStats({ games: [] }).games, 0);

globalThis.fetch = realFetch;
console.log("nba-props: ok");
