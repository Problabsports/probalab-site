// Phone-first layout: green-first ordering, "Best value" wording, chance gauge, /today row parsing,
// match view tab sorting, props (predictions only), bottom tab bar, service worker privacy rules,
// and the desktop guard (every phone rule sits inside the phone media query).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../phone-core.js");
const SW = require("../sw.js");
const repo = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(repo, f), "utf8");

// ---------------------------------------------------------------- wording
assert.equal(P.LIGHT_LABEL.SUPER, "Best value");
assert.equal(P.lightChip("SUPER"), '<span class="chip SUPER pf-chip">Best value</span>');
for (const f of ["phone-core.js", "phone.js", "phone.css", "sw.js", "offline.html"]) {
  const src = read(f).replace(/var BANNED = [^\r\n]*\r?\n/, ""); // the ban list itself (CRLF-safe)
  assert.ok(!P.BANNED.test(src), `${f} has banned wording`);
}

// ---------------------------------------------------------------- green first
const g = (light, i, p = 0.6) => ({ light, i, p });
const sorted = P.sortGreenFirst([g("RED", 0), g("GREEN", 1), g("ORANGE", 2), g("SUPER", 3), g("GREEN", 4), g("", 5)]);
assert.deepEqual(sorted.map((x) => x.i), [3, 1, 4, 2, 0, 5]);
const top = P.topGreens([g("GREEN", 0, 0.7), g("RED", 1, 0.9), g("GREEN", 2, 0.8), g("SUPER", 3, 0.62), g("ORANGE", 4, 0.6)], 3);
assert.deepEqual(top.map((x) => x.i), [3, 2, 0]);
assert.equal(P.topGreens([g("ORANGE", 0)]).length, 0);

// ---------------------------------------------------------------- parsing the /today board
assert.deepEqual(P.splitPick("Boston Celtics 72%"), { side: "Boston Celtics", p: 0.72 });
assert.deepEqual(P.splitPick("soon"), { side: "", p: null });
assert.deepEqual(P.splitMatch("Utah Jazz @ Denver Nuggets"), { a: "Utah Jazz", b: "Denver Nuggets", sep: "@" });
assert.deepEqual(P.splitMatch("Arsenal v Chelsea"), { a: "Arsenal", b: "Chelsea", sep: "v" });
assert.equal(P.gameIdFromHref("/nba/utah-jazz-vs-denver-nuggets-prediction-2026-11-17-401810123"), "401810123");
assert.equal(P.gameIdFromHref("/nhl#game-2025020301"), "2025020301");
assert.equal(P.matchHref("nba", "/nba/a-vs-b-prediction-2026-11-17-401810123"), "/#game-401810123");
assert.equal(P.matchHref("nfl", "/nfl/a-vs-b-prediction-2026-11-17-401772"), "/#game-401772");
assert.equal(P.matchHref("nhl", "/nhl#game-77"), "/nhl/app#game-77");
assert.equal(P.matchHref("epl", "/epl#game-5"), "/epl/app#game-5");
assert.equal(P.matchHref("tennis", "/tennis"), "/tennis");

const row = P.rowFromParts({
  sport: "nba", whenText: " Tue 11:00am  AEDT ", matchText: "Utah Jazz @ Denver Nuggets", teams: ["Utah Jazz", "Denver Nuggets"],
  pickText: "Denver Nuggets 74%", chipClass: "chip SUPER", href: "/nba/x-prediction-2026-11-17-401810123",
  fairDec: "1.35", marketText: "70%", valueText: "+4.0%", valued: true, injuryText: "",
});
assert.equal(row.when, "Tue 11:00am AEDT");
assert.equal(row.side, "Denver Nuggets");
assert.equal(row.p, 0.74);
assert.equal(row.light, "SUPER");
assert.equal(row.phoneHref, "/#game-401810123");
assert.equal(row.fair, 1.35);
assert.equal(P.rowFromParts({ sport: "nhl", marketText: "—", valueText: "—", pickText: "x 60%", matchText: "A @ B" }).market, "");

// ---------------------------------------------------------------- match card
const card = P.cardHtml(row);
assert.match(card, /class="pf-card pf-l-SUPER"/);
assert.match(card, /<span class="pf-bv">Best value<\/span>/);
assert.match(card, /href="\/#game-401810123"/);
assert.match(card, /Tue 11:00am AEDT/);
assert.match(card, /pf-team pf-picked">Denver Nuggets/);
assert.match(card, /aria-label="Chance 74%"/);
assert.ok(!/fair|units?\b|edge/i.test(card.replace(/aria-label="[^"]*"/g, "")), "cards show no fair price, units or edge");
for (const l of ["GREEN", "ORANGE", "RED"]) assert.match(P.cardHtml({ ...row, light: l }), new RegExp(`pf-card pf-l-${l}"`));
assert.ok(!/pf-bv/.test(P.cardHtml({ ...row, light: "GREEN" })));

// ---------------------------------------------------------------- chance gauge
const gauge = P.gaugeSvg(0.72, "GREEN", { size: 80 });
assert.match(gauge, /pf-g-GREEN/);
assert.match(gauge, />72%</);
const len = Math.PI * 40;
assert.match(gauge, new RegExp(`stroke-dasharray="${(0.72 * len).toFixed(2)} ${len.toFixed(2)}"`));
assert.match(P.gaugeSvg(null, ""), />–</);
assert.ok(!/pf-g-fill/.test(P.gaugeSvg(null, "")));
assert.match(P.gaugeSvg(1.4, "RED"), />100%</);

// ---------------------------------------------------------------- match view tabs
assert.equal(P.classifyPanel("Why the model leans this way"), "overview");
assert.equal(P.classifyPanel("BOS injury report"), "overview");
assert.equal(P.classifyPanel("Pick timeline"), "overview");
assert.equal(P.classifyPanel("Team comparison · 2025–26"), "stats");
assert.equal(P.classifyPanel("Boston Celtics · players"), "stats");
assert.equal(P.classifyPanel("Meetings this season"), "stats");
assert.equal(P.classifyPanel("BOS · total points in their games"), "stats");
assert.equal(P.classifyPanel("Form · last 10"), "form");
assert.equal(P.classifyPanel("The model's chances"), "overview");
assert.deepEqual(P.MATCH_TABS.map((t) => t[0]), ["overview", "stats", "form", "props"]);

// ---------------------------------------------------------------- props: predictions only
const props = P.sortProps([
  { player: "A", light: "RED", p: 0.52 }, { player: "B", light: "GREEN", p: 0.61 }, { player: "C", light: "GREEN", p: 0.7 }, { player: "D", light: "ORANGE", p: 0.57 },
]);
assert.deepEqual(props.map((r) => r.player), ["C", "B", "D", "A"]);
assert.ok(P.propsGameMatches(["Boston Celtics", "New York Knicks"], "Boston Celtics", "New York Knicks"));
assert.ok(P.propsGameMatches(["Los Angeles Clippers", "Utah Jazz"], "LA Clippers", "Utah Jazz"));
assert.ok(!P.propsGameMatches(["Boston Celtics", "New York Knicks"], "Boston Celtics", "Utah Jazz"));
const pr = P.propRowHtml({ player: "Sample", market: "Points", line: "25.5", call: "Over", p: 0.68, light: "GREEN" });
assert.match(pr, /Over 25\.5/);
assert.match(pr, />68%</);
assert.match(pr, /chip GREEN/);
assert.ok(!/\$|tip|unit|edge|fair/i.test(pr), "props rows carry no price, tip, units, edge or fair price");

// ---------------------------------------------------------------- bottom tab bar
assert.deepEqual(P.TAB_BAR.map((t) => t[0]), ["home", "today", "props", "results", "members"]);
assert.equal(P.activeTab("/", ""), "home");
assert.equal(P.activeTab("/", "#game-1"), "today");
assert.equal(P.activeTab("/", "#nba-record"), "");
assert.equal(P.activeTab("/today", ""), "today");
assert.equal(P.activeTab("/nhl/app", "#game-3"), "today");
assert.equal(P.activeTab("/props/nba", ""), "props");
assert.equal(P.activeTab("/props/results", ""), "results");
assert.equal(P.activeTab("/results", ""), "results");
assert.equal(P.activeTab("/members/tips/john", ""), "members");
assert.deepEqual(P.HOME_TILES.map((t) => t[2]), ["Today's games", "Tips", "Props", "Results", "Tipsters", "Account"]);

// ---------------------------------------------------------------- service worker: never stores member data
const O = "https://probalabsports.com";
const c = (u, mode = "no-cors", m = "GET") => SW.classify(m, O + u, mode, O);
assert.equal(c("/phone.css"), "shell");
assert.equal(c("/icon-192.png"), "shell");
assert.equal(c("/tennis.js?v=abc123"), "shell");
for (const u of ["/api/green-record", "/api/props-nba", "/data/nhl-picks.json", "/data/tipsters/probalab.json", "/members/tips/john.js", "/members", "/join"]) {
  assert.equal(c(u), "pass", u);
}
for (const u of ["/", "/today", "/members", "/members/tips/john", "/members/billing", "/join"]) assert.equal(c(u, "navigate"), "page", u); // network only
assert.equal(c("/phone.css", "no-cors", "POST"), "pass");
assert.equal(SW.classify("GET", "https://zwdpsereqicvzbtfrrnd.supabase.co/auth/v1/user", "cors", O), "pass");
assert.equal(c("/odds.js?member=1"), "pass");
assert.ok(SW.SHELL.every((u) => u === "/offline" || SW.classify("GET", O + u, "no-cors", O) === "shell"), "precache list is the offline page plus public static files only");
const swSrc = read("sw.js");
assert.ok(!/cache\.put\(|c\.put\(req/.test(swSrc.split('kind === "page"')[1].split('kind === "shell"')[0]), "pages are never cached");

assert.ok(SW.SHELL.includes("/offline") && !SW.SHELL.includes("/offline.html"), "precache the un-redirected offline URL");

// ---------------------------------------------------------------- manifest + icons
const man = JSON.parse(read("site.webmanifest"));
assert.equal(man.display, "standalone");
assert.equal(man.theme_color, "#07080f");
assert.equal(man.start_url, "/");
assert.ok(man.icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512"));
for (const i of man.icons) assert.ok(fs.existsSync(path.join(repo, i.src)), i.src);

// ---------------------------------------------------------------- desktop guard
// Outside the phone media query phone.css may only hide the phone-only elements.
const css = read("phone.css").replace(/\/\*[\s\S]*?\*\//g, "");
const mqAt = css.indexOf("@media (max-width: 767.98px)");
assert.ok(mqAt > 0);
assert.equal(css.slice(0, mqAt).trim(), ".pf-only { display: none !important; }");
let depth = 0, end = -1;
for (let i = css.indexOf("{", mqAt); i < css.length; i++) { if (css[i] === "{") depth++; else if (css[i] === "}" && --depth === 0) { end = i; break; } }
assert.equal(css.slice(end + 1).trim(), "", "nothing after the phone media query");
assert.equal(P.PHONE_MQ, "(max-width: 767.98px)");
// every rule inside the media query is scoped to html.pf (set by phone.js on phones only)
const inner = css.slice(css.indexOf("{", mqAt) + 1, end);
const selectors = inner.replace(/@keyframes[^{]*\{[^{}]*(\{[^}]*\}[^{}]*)*\}/g, "").replace(/@media[^{]*\{/g, "").match(/[^{}]+(?=\{)/g).map((s) => s.trim()).filter(Boolean);
for (const sel of selectors) for (const part of sel.split(",")) assert.match(part.trim(), /^html\.pf/, `unscoped selector: ${part.trim()}`);
// phone files load on every page template
for (const f of ["index.html", "404.html", "contact.html", "privacy.html", "terms.html", "functions/_shared/site.js"]) {
  const s = read(f);
  assert.ok(s.includes('href="/phone.css"') && s.includes('src="/phone-core.js"') && s.includes('src="/phone.js"'), f);
}

// ---------------------------------------------------------------- round 3: stacked keys, props scale, Today sport chips
const rowsOf = (sp, o) => P.gameKeyRows(sp, o).map((r) => `${r.label}:${r.range}`);
assert.deepEqual(rowsOf("nba", { best: true }), ["Best value:NBA value flag: the price beats our fair price", "Green:65%+", "Orange:Lean · 55–65%", "Red:Coin flip · under 55%"]);
assert.deepEqual(rowsOf("nfl", { best: true }).slice(0, 1), ["Green:65%+"], "Best value is NBA only");
assert.deepEqual(rowsOf("nhl"), ["Green:65%+", "Orange:Lean · 55–65%", "Red:Coin flip · under 55%"]);
assert.equal(rowsOf("epl")[0], "Green:55%+");
assert.equal(rowsOf("championship")[0], "Green:55%+");
assert.equal(rowsOf("tennis")[0], "Green:70%+");
assert.deepEqual(rowsOf("all", { best: true, injury: true }).map((r) => r.split(":")[0]), ["Best value", "Green", "Orange", "Red", "Injury watch"]);
assert.match(P.gameKeyRows("all")[0].rangeHtml, /65%\+ NBA, NFL, NHL.*55%\+ Premier League, Championship.*70%\+ Tennis/);
// props have their own scale, and it never appears in a game key
assert.deepEqual(P.propsKeyRows().map((r) => `${r.label}:${r.range}`), ["Green:60%+", "Orange:55-59%", "Red:under 55%"]);
for (const sp of ["nba", "nfl", "nhl", "epl", "championship", "tennis", "all"]) {
  const html = P.stackedKeyHtml(P.gameKeyRows(sp, { best: true, injury: true }));
  assert.ok(!/60%\+|55[-–]59%/.test(html), `game key ${sp} shows no props range`);
}
const pk = P.stackedKeyHtml(P.propsKeyRows(), { title: "Props scale", sub: "Props use their own scale, because player stats swing more than match results." });
assert.match(pk, /<p class="pf-lkey-title">Props scale<\/p><p class="pf-lkey-sub">Props use their own scale, because player stats swing more than match results\.<\/p>/);
assert.equal((pk.match(/<li /g) || []).length, 3, "one line per light");
assert.match(P.stackedKeyHtml(P.gameKeyRows("nba", { injury: true })), /pf-lkey-warn/);
// Today sport chips: every sport, counts under the current light, dimmed 0
assert.deepEqual(P.TODAY_SPORTS.map((s) => s[1]), ["NBA", "NFL", "NHL", "Premier League", "Championship", "Tennis"]);
const board = [{ sport: "nba", light: "GREEN" }, { sport: "nba", light: "RED" }, { sport: "nba", light: "SUPER" }, { sport: "nhl", light: "ORANGE" }];
const cg = P.sportCounts(board, "green");
assert.deepEqual([cg.all.shown, cg.nba.shown, cg.nhl.shown, cg.nhl.total, cg.nfl.total], [2, 2, 0, 1, 0]);
assert.equal(P.sportCounts(board, "all").nba.shown, 3);
const chipsHtml = P.sportChipsHtml(cg, "all", "green");
assert.match(chipsHtml, /href="\/today\?sport=nba">NBA<span class="pf-sc-n">2<\/span>/);
assert.match(chipsHtml, /pf-sc-dim" data-pf-sport="nfl">NFL<span class="pf-sc-n">0<\/span>/);
for (const name of ["All", "NBA", "NFL", "NHL", "Premier League", "Championship", "Tennis"]) assert.ok(chipsHtml.includes(`>${name}<span`), name);
assert.match(P.sportChipsHtml(P.sportCounts(board, "orange", { nfl: false }), "all", "orange"), /NFL<\/a>/, "a sport that failed to load shows no count and stays a link");
assert.equal(P.todayHref("nhl", "all"), "/today?sport=nhl&light=all");
assert.equal(P.todayHref("all", "green"), "/today");
const nfl0 = P.noGamesText("nfl", cg, "green", "2026-11-20T01:15:00Z");
assert.equal(nfl0.text, "No NFL games in the next 24 hours.");
assert.equal(nfl0.next, "Next: Fri 20 Nov, 12:15pm AEDT");
assert.equal(P.noGamesText("nfl", cg, "green", null).next, "");
const nhl0 = P.noGamesText("nhl", cg, "green");
assert.equal(nhl0.text, "No green NHL picks in the next 24 hours.");
assert.equal(nhl0.more, "1 NHL game at other lights");
assert.equal(nhl0.href, "/today?sport=nhl&light=all");
assert.equal(P.noGamesText("tennis", cg, "green").text, "No Tennis matches in the next 24 hours.");
const now = Date.parse("2026-11-17T00:00:00Z");
assert.deepEqual(P.nextStart("nfl", { games: [{ start_utc: "2026-11-21T01:00:00Z", status: "pre" }, { start_utc: "2026-11-20T01:00:00Z", status: "pre" }, { start_utc: "2026-11-10T01:00:00Z", status: "post" }] }, now), { iso: "2026-11-20T01:00:00.000Z", tbc: false });
assert.equal(P.nextStart("epl", [{ kickoff_utc: "2026-11-22T15:00:00Z" }], now).iso, "2026-11-22T15:00:00.000Z");
assert.equal(P.nextStart("nhl", { games: [{ puck_drop_utc: "2026-11-18T00:00:00Z" }] }, now).iso, "2026-11-18T00:00:00.000Z");
assert.deepEqual(P.nextStart("tennis", { matches: [{ start_utc: "2026-11-19T05:00:00Z", status: "pre", time_tbc: true }] }, now), { iso: "2026-11-19T05:00:00.000Z", tbc: true });
assert.equal(P.nextStart("nba", { games: [] }, now), null);
assert.match(P.sydneyWhen("2026-11-19T05:00:00Z", true), /time TBC$/);
assert.deepEqual(Object.keys(P.NEXT_SOURCE), ["nba", "nfl", "nhl", "epl", "championship", "tennis"]);
for (const u of Object.values(P.NEXT_SOURCE)) assert.match(u, /^\/(api\/feed\?sport=|data\/[a-z]+-picks\.json$)/, "next-game dates come from the files /today already reads");

console.log("phone-first tests passed");
