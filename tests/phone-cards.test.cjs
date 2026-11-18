// Phone game cards everywhere: one shared card (the Home card) for Home, /today, /<sport>/today, the sport pages
// and the app lists; one small header per day; Injury watch as a chip that opens the note inline in the card.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../phone-core.js");
const L = require("../lights.js");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// ---------------------------------------------------------------- start day / time (AEDT)
assert.equal(P.timeLabel("2026-11-18T08:30:00Z"), "7:30pm AEDT");
assert.equal(P.dayLabel("2026-11-18T08:30:00Z"), "WED 18 NOV");
assert.equal(P.dayKey("2026-11-18T08:30:00Z"), "2026-11-18");
assert.equal(P.dayLabel("2026-11-18T13:30:00Z"), "THU 19 NOV", "after midnight in Sydney is the next day");
// tennis with no start time yet: the day is the ET calendar day, the time says TBC (same rule as /today)
assert.equal(P.timeLabel("2026-11-19T05:00:00Z", true), "Time TBC");
assert.equal(P.dayLabel("2026-11-19T05:00:00Z", true), "THU 19 NOV");
assert.equal(P.timeLabel("not a date"), "");

// ---------------------------------------------------------------- the card (same anatomy as the Home card)
const todayRow = P.rowFromParts({
  sport: "nba", whenText: "Wed 7:30pm AEDT", start: "2026-11-18T08:30:00Z", matchText: "Utah Jazz @ Denver Nuggets",
  teams: ["Utah Jazz", "Denver Nuggets"], pickText: "Denver Nuggets 74%", chipClass: "chip GREEN", bestValue: true,
  href: "/nba/utah-jazz-vs-denver-nuggets-prediction-2026-11-18-401810123",
  injuryText: "Murray is uncertain (GTD)…", injuryFull: "⚠️ Murray is uncertain (GTD). Light not changed by this.",
});
assert.equal(todayRow.time, "7:30pm AEDT");
assert.equal(todayRow.day, "WED 18 NOV");
assert.equal(todayRow.injury, "Murray is uncertain (GTD). Light not changed by this.", "the full note, same text as the desktop 'more'");
const card = P.cardHtml(todayRow);
const top = card.split('<span class="pf-card-top">')[1].split('<span class="pf-card-mid">')[0];
assert.match(top, /^<span class="pf-sport">NBA<\/span><span class="pf-time">7:30pm AEDT<\/span><span class="pf-lights">/, "sport tag + start time top left");
assert.match(top, /<span class="pf-lights"><span class="pf-lpill pf-l-GREEN">Green<\/span><span class="pf-bv">Best value<\/span><\/span>/, "light pill top right; green Best value shows Green + small tag");
assert.ok(!/WED|18 NOV/.test(card), "no date on the card");
assert.match(card, /<span class="pf-team">Utah Jazz<\/span><span class="pf-sep">@<\/span><span class="pf-team pf-picked">Denver Nuggets<span class="pf-tick" aria-hidden="true">●<\/span><\/span>/, "away @ home stacked, picked team bold + dot");
assert.match(card, /pf-gauge pf-g-GREEN[\s\S]*>74%</, "gauge on the right in the light colour");
assert.match(card, /<span class="pf-card-foot"><span class="pf-pick"><span class="pf-pick-lab">Our pick<\/span><b>Denver Nuggets<\/b><\/span><span class="pf-foot-r"><span class="chip GREEN pf-chip">Green<\/span><\/span><\/span>/, "bottom row: Our pick + light badge");
assert.match(card, /^<article class="pf-card pf-l-GREEN pf-has-inj"/, "border / glow in the light colour");
assert.match(card, /href="\/#game-401810123"/);
for (const l of ["GREEN", "SUPER", "ORANGE", "RED"]) {
  const c = P.cardHtml({ ...todayRow, light: l, bestValue: l === "SUPER" });
  assert.ok(c.includes(`<span class="pf-lpill pf-l-${l}">${L.label(l)}</span>`), `${l} pill label from lights.json`);
  assert.ok(c.includes(`<span class="chip ${l} pf-chip">${L.label(l)}</span>`), `${l} badge label from lights.json`);
}
assert.equal(L.label("SUPER"), "Best value");
assert.ok(!P.cardHtml({ ...todayRow, light: "SUPER", bestValue: true }).includes("pf-bv"), "the Best value light is the pill, no extra tag");
// floor rounding: the gauge shows the rounded-down chance, like the light
assert.match(P.cardHtml({ ...todayRow, p: 0.6499 }), />64%</);
// no pick yet
assert.match(P.cardHtml({ ...todayRow, side: "", p: null, light: "" }), /<b>Posted soon<\/b>[\s\S]*pf-card pf-l-none|pf-card pf-l-none[\s\S]*<b>Posted soon<\/b>/);

// one shared card: a sport-page / app row draws the very same card
const hubRow = P.hubRowFromParts({
  sport: "nba", start: "2026-11-18T08:30:00Z", dayText: "Tue, 17 Nov", matchText: "Utah Jazz @ Denver Nuggets", pickText: "DEN 74%",
  chipClass: "chip GREEN", bestValue: true, href: "/#game-401810123", injury: true, injuryNote: "⚠️ Murray is uncertain (GTD). Light not changed by this.",
});
const strip = (h) => h.replace(/pf-inj-nba-401810123-\d+/g, "ID");
assert.equal(strip(P.cardHtml(hubRow)), strip(card), "same card markup from a /today row and a sport-page row");

// ---------------------------------------------------------------- one small header per day
const r = (o) => P.hubRowFromParts({ sport: "nhl", matchText: "A @ B", href: "#", ...o });
const day1g = r({ start: "2026-11-18T09:00:00Z", pickText: "A 70%", chipClass: "chip GREEN", id: "g1" });
const day1r = r({ start: "2026-11-18T08:00:00Z", pickText: "A 52%", chipClass: "chip RED", id: "r1" });
const day2o = r({ start: "2026-11-19T08:00:00Z", pickText: "A 60%", chipClass: "chip ORANGE", id: "o2" });
const list = P.cardListHtml([day2o, day1r, day1g], { sort: "asc", greenFirst: true });
assert.deepEqual(list.match(/<p class="pf-dayhead">[^<]*<\/p>/g), ['<p class="pf-dayhead">WED 18 NOV</p>', '<p class="pf-dayhead">THU 19 NOV</p>'], "one header per day, days in order");
const keys = list.match(/data-pf-key="nhl:(\w+)"/g).map((k) => k.slice(-3, -1));
assert.deepEqual(keys, ["g1", "r1", "o2"], "green first inside each day");
const res = P.cardListHtml([r({ start: "2026-11-16T08:00:00Z", id: "a" }), r({ start: "2026-11-17T08:00:00Z", id: "b" })], { sort: "desc" });
assert.ok(res.indexOf("TUE 17 NOV") < res.indexOf("MON 16 NOV"), "results: newest day first");
// rows with no start (an old cached page) fall back to the row's own day text
assert.match(P.cardListHtml([r({ dayText: "Sat, 21 Nov", pickText: "A 60%" })]), /<p class="pf-dayhead">Sat, 21 Nov<\/p>/);

// ---------------------------------------------------------------- Injury watch: chip on the card, note inline
const ih = P.cardHtml(hubRow);
assert.ok(!/<a [^>]*>(?:(?!<\/a>)[\s\S])*(Murray|<button)/.test(ih), "no note text and no button inside the card link");
const id = ih.match(/<span class="pf-inj-detail" id="([^"]+)" role="note" hidden>Murray is uncertain \(GTD\)\. Light not changed by this\.<\/span>/)[1];
assert.match(ih, new RegExp(`<button type="button" class="pf-injchip" data-pf-injtoggle aria-expanded="false" aria-controls="${id}">⚠️ Injury watch</button>`));
assert.match(ih, new RegExp(`<button type="button" class="pf-inj-more" data-pf-injtoggle aria-expanded="false" aria-controls="${id}"[^>]*>More</button>`));
assert.notEqual(P.cardHtml(hubRow).match(/id="(pf-inj-[^"]+)"/)[1], id, "every card gets its own note id");
assert.ok(!P.cardHtml({ ...hubRow, injury: "" }).includes("pf-injchip"), "no chip without an injury watch");
assert.ok(!/class="pf-inj"|Injury watch · /.test(card), "the old injury text block is gone from the card");

// tap the chip: opens; tap again: closes; the card's More does the same
function fakeCard() {
  const cls = (list) => ({ list: new Set(list), contains(c) { return this.list.has(c); }, toggle(c, on) { if (on) this.list.add(c); else this.list.delete(c); } });
  const btn = (c) => ({ attrs: { "aria-expanded": "false" }, textContent: c === "pf-inj-more" ? "More" : "⚠️ Injury watch", classList: cls([c]), setAttribute(k, v) { this.attrs[k] = String(v); } });
  const chip = btn("pf-injchip"), more = btn("pf-inj-more"), detail = { hidden: true };
  return {
    chip, more, detail, classList: cls(["pf-card"]),
    querySelector(sel) { return sel === ".pf-inj-detail" ? detail : null; },
    querySelectorAll(sel) { return sel === "[data-pf-injtoggle]" ? [chip, more] : []; },
  };
}
const fc = fakeCard();
assert.equal(P.setInjuryOpen(fc), true, "chip tap opens");
assert.equal(fc.detail.hidden, false);
assert.equal(fc.chip.attrs["aria-expanded"], "true");
assert.equal(fc.more.attrs["aria-expanded"], "true");
assert.equal(fc.more.textContent, "Less");
assert.ok(fc.classList.contains("pf-inj-open"));
assert.equal(fc.chip.textContent, "⚠️ Injury watch", "the chip keeps its label");
assert.equal(P.setInjuryOpen(fc), false, "tap again closes");
assert.equal(fc.detail.hidden, true);
assert.equal(fc.chip.attrs["aria-expanded"], "false");
assert.equal(fc.more.textContent, "More");
assert.ok(!fc.classList.contains("pf-inj-open"));
assert.equal(P.setInjuryOpen(fc, true), true);
assert.equal(P.setInjuryOpen(fc, true), true, "an explicit open stays open");
assert.equal(P.setInjuryOpen({ querySelector: () => null }), false, "a card with no injury watch is left alone");

// ---------------------------------------------------------------- hard rule: one card, every sport, every list
// The card's markup skeleton (tags + classes, text and attribute values removed) is identical for every sport,
// for every kind of list row, and for a sport that doesn't exist yet.
const skeleton = (h) => h.replace(/>[^<]+</g, "><").replace(/ (?:href|aria-label|aria-controls|id|data-pf-key|style|stroke-dasharray|width|height|d|viewBox|pathLength)="[^"]*"/g, "")
  .replace(/pf-(?:l|g)-(?:GREEN|SUPER|ORANGE|RED|none)/g, "pf-L");
const rowFor = (sport, extra = {}) => P.hubRowFromParts({ sport, start: "2026-11-18T08:30:00Z", matchText: sport === "epl" || sport === "championship" || sport === "tennis" ? "A v B" : "A @ B",
  pickText: "A 66%", chipClass: "chip GREEN", href: "/x#game-1", injury: true, injuryNote: "Key player uncertain.", ...extra });
const base = skeleton(P.cardHtml(rowFor("nba")));
for (const sp of ["nfl", "nhl", "epl", "championship", "tennis", "cricket"]) assert.equal(skeleton(P.cardHtml(rowFor(sp))), base, `${sp}: same card as NBA`);
assert.equal(skeleton(P.cardHtml({ ...todayRow, side: todayRow.a, bestValue: false })), base, "a /today row draws the same card");
assert.match(P.cardHtml(rowFor("cricket")), /<span class="pf-sport">CRICKET<\/span>/, "a new sport gets the card with no code change");
// only the data differs: NFL lists group by week (from data-group), everything else by day; same header element
const wk = (start, w) => rowFor("nfl", { start, group: `Week ${w}`, groupKey: String(w).padStart(3, "0") });
const nflList = P.cardListHtml([wk("2026-11-30T18:00:00Z", 13), wk("2026-11-23T18:00:00Z", 12), wk("2026-11-24T01:15:00Z", 12)], { sort: "asc" });
assert.deepEqual(nflList.match(/<p class="pf-dayhead">[^<]*<\/p>/g), ['<p class="pf-dayhead">Week 12</p>', '<p class="pf-dayhead">Week 13</p>']);
assert.match(nflList, /<span class="pf-time">Tue 24 Nov, 5:00am AEDT<\/span>/, "grouped by week, the card's time carries its day");
assert.equal(skeleton(P.cardHtml(wk("2026-11-23T18:00:00Z", 12))), base, "NFL week rows: same card");
assert.deepEqual(P.cardListHtml([wk("2026-11-23T18:00:00Z", 12)], { by: "day" }).match(/pf-dayhead">[^<]*/g), ['pf-dayhead">TUE 24 NOV'], "Home (mixed sports) groups by day");
// a row with no match view to open (tennis app) is the same card, not a link
const noLink = P.cardHtml(rowFor("tennis", { href: "" }));
assert.match(noLink, /<span class="pf-card-link" role="group"/);
assert.equal(skeleton(noLink).replace('<span class="pf-card-link" role="group">', '<a class="pf-card-link">').replace(/<\/span><span class="pf-card-inj">/, '</a><span class="pf-card-inj">'), base);

// ---------------------------------------------------------------- the phone data contract on every game row
(async () => {
  const PR = await import("../functions/_shared/phone-row.js");
  assert.equal(PR.phoneAttrs({ start_utc: "2026-11-18T08:30:00Z" }, "nba"), ' data-sport="nba" data-start="2026-11-18T08:30:00Z"');
  assert.equal(PR.phoneAttrs({ start_utc: "2026-11-23T18:00:00Z", week: 12 }, "nfl"), ' data-sport="nfl" data-start="2026-11-23T18:00:00Z" data-group="Week 12" data-group-key="012"');
  assert.match(PR.phoneAttrs({ start_utc: "2026-11-19T05:00:00Z", time_tbc: true }, "tennis"), / data-tbc="1"$/);
  assert.equal(PR.phoneAttrs({ start_utc: "2026-11-18T08:30:00Z" }, "cricket"), ' data-sport="cricket" data-start="2026-11-18T08:30:00Z"', "a new sport works by default");
  assert.equal(PR.matchText({ home_name: "Arsenal", away_name: "Chelsea" }, "epl"), "Arsenal v Chelsea");
  assert.equal(PR.matchText({ home_name: "B", away_name: "A" }, "nhl"), "A @ B");
  const site = await import("../functions/_shared/site.js");
  const li = site.gameRow({ sport: "nfl", week: 12, path: "/nfl/a-b-1", start_utc: "2026-11-23T18:00:00Z", away_name: "A", home_name: "B", pick: "B", pick_p: 0.7, light: "GREEN", status: "pre" });
  assert.match(li, /^<li class=""\s*data-sport="nfl" data-start="2026-11-23T18:00:00Z" data-group="Week 12" data-group-key="012"><a href="\/nfl\/a-b-1">/);
  console.log("phone-cards tests passed");
})().catch((e) => { console.error(e); process.exit(1); });

// every game row renderer emits the contract (server rows and the app rows)
for (const [f, re] of [["functions/_shared/site.js", /\$\{phoneAttrs\(g, g\.sport\)\}><a href/], ["functions/_shared/sport-hubs.js", /<li id="game-\$\{esc\(g\.game_id\)\}"\$\{phoneAttrs\(g, g\.sport\)\}>/],
  ["functions/today.js", /\$\{phoneAttrs\(g, g\.sport\)\}/], ["functions/_shared/teams.js", /<li\$\{phone\}><a href/], ["tennis.js", /<div class="tn-row"\$\{phone\}>/],
  ["hidden-sports.js", /data-sport="\$\{esc\(HS\)\}" data-start=/]]) assert.match(read(f), re, f);
assert.equal((read("index.html").match(/data-sport="\$\{g\.sport === "NFL" \? "nfl" : "nba"\}" data-start=/g) || []).length, 2, "NBA / NFL app cards");

// ---------------------------------------------------------------- wiring: no per-sport phone layouts
const js = read("phone.js");
assert.match(js, /P\.cardListHtml\(rows, \{ sort: "asc", greenFirst: true \}\)/, "/today");
assert.match(js, /P\.cardListHtml\(top, \{ sort: "asc", by: "day" \}\)/, "Home");
assert.match(js, /gameLists\(main\)/, "sport pages");
assert.match(js, /gameLists\(\$\("main"\)\)/, "every other server page with game rows (/<sport>/today, team, game, record pages)");
assert.match(js, /\$\$\("\[data-sport\]\[data-start\]", mainEl\)/, "app lists, every sport");
assert.match(js, /closest\("\[data-pf-injtoggle\]"\)[\s\S]{0,80}P\.setInjuryOpen\(b\.closest\("\.pf-card"\)\)/, "chip / More toggle the note in their card");
assert.ok(!/P\.cardHtml\(/.test(js), "phone.js draws cards only through the shared list");
assert.match(js, /txt\(\$\("span\.r", el\)\)/, "result comes from the row's span.r, never an app card's away team box (div.team.r)");
const listCode = js.slice(js.indexOf("// ---- every game list → the shared game card".replace("---- ", "------------------------------------------------------------------ ")), js.indexOf("// ------------------------------------------------------------------ stacked lights keys"));
assert.ok(listCode.length > 1000, "list code found");
assert.ok(!/["'](nba|nfl|nhl|epl|championship|tennis)["']|nba\||\|nfl/.test(listCode), "no sport names in the list code");
assert.ok(!/(nba|nfl|nhl|epl|championship|tennis)\|/.test(js.slice(js.indexOf("// Game lists find themselves"), js.indexOf("appLists(); //"))), "no sport list in the game-list wiring (the props pages list players, not games)");

// desktop guard: every card / list rule sits inside the phone media query (the generic guard is in phone-first)
const css = read("phone.css");
const mq = css.indexOf("@media (max-width: 767.98px)");
for (const sel of [".pf-cardlist {", ".pf-cardsrc {", ".pf-lpill {", ".pf-card-inj {", ".pf-inj-detail[hidden]", ".pf-dayhead {"]) {
  const i = css.indexOf(sel);
  assert.ok(i > mq, `${sel} sits inside the phone media query`);
}

