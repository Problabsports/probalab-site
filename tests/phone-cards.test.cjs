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

// ---------------------------------------------------------------- wiring: every phone game list uses the card
const js = read("phone.js");
assert.match(js, /P\.cardListHtml\(rows, \{ sort: "asc", greenFirst: true \}\)/, "/today");
assert.match(js, /P\.cardListHtml\(top, \{ sort: "asc" \}\)/, "Home");
assert.match(js, /gameLists\(sport, main, \{ mergeDays: sport !== "nfl" \}\)/, "sport pages");
assert.match(js, /\\\/\(nba\|nfl\)\\\/today/, "/nba/today and /nfl/today");
assert.match(js, /appLists\(\)/, "app lists");
assert.match(js, /closest\("\[data-pf-injtoggle\]"\)[\s\S]{0,80}P\.setInjuryOpen\(b\.closest\("\.pf-card"\)\)/, "chip / More toggle the note in their card");
assert.ok(!/P\.cardHtml\(/.test(js), "phone.js draws cards only through the shared list");
assert.match(js, /start: li\.getAttribute\("data-start"\)/);
// the server rows carry their start time (attributes only: the desktop rows look the same)
assert.match(read("functions/today.js"), /startAttrs\(g\)/);
assert.match(read("functions/_shared/site.js"), /data-start="\$\{esc\(g\.start_utc\)\}"/);
assert.match(read("functions/_shared/sport-hubs.js"), /data-start="\$\{esc\(g\.start_utc\)\}"\$\{g\.time_tbc \? ` data-tbc="1"` : ""\}/);
assert.match(read("hidden-sports.js"), /data-start="\$\{esc\(g\.start_utc\)\}"/);
assert.equal((read("index.html").match(/data-start="\$\{esc\(g\.start_utc\)\}"/g) || []).length, 2, "app card and no-pick card");

// desktop guard: every card / list rule sits inside the phone media query (the generic guard is in phone-first)
const css = read("phone.css");
const mq = css.indexOf("@media (max-width: 767.98px)");
for (const sel of [".pf-cardlist {", ".pf-cardsrc {", ".pf-lpill {", ".pf-card-inj {", ".pf-inj-detail[hidden]", ".pf-dayhead {"]) {
  const i = css.indexOf(sel);
  assert.ok(i > mq, `${sel} sits inside the phone media query`);
}

(async () => {
  const site = await import("../functions/_shared/site.js");
  const li = site.gameRow({ path: "/nba/a-b-1", start_utc: "2026-11-18T08:30:00Z", away_name: "A", home_name: "B", pick: "B", pick_p: 0.7, light: "GREEN", status: "pre" });
  assert.match(li, /^<li class=""\s*data-start="2026-11-18T08:30:00Z"><a href="\/nba\/a-b-1">/);
  console.log("phone-cards tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
