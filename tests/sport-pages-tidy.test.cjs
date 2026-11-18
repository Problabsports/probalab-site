// Phone sport pages (/nba, /nfl, /nhl, /epl, /championship, /tennis): the shared game card, Injury watch chip
// (note opens inline in the card), one date header per day, lights from lights.json, desktop guard.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../phone-core.js");
const L = require("../lights.js");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// ---------------------------------------------------------------- parsing a server row
const nba = P.hubRowFromParts({
  sport: "nba", dayText: "Tue, 17 Nov", matchText: "New York Knicks @ Toronto Raptors", pickText: "NY 61%",
  chipClass: "chip ORANGE", href: "/#game-401", injury: true,
  injuryNote: "Key players uncertain: Scottie Barnes (Questionable). Light not changed by this.",
});
assert.equal(nba.a, "New York Knicks");
assert.equal(nba.b, "Toronto Raptors");
assert.equal(nba.sep, "@");
assert.equal(nba.light, "ORANGE");
assert.equal(nba.p, 0.61);
assert.equal(nba.day, "Tue, 17 Nov");
assert.ok(nba.injury.startsWith("Key players uncertain: Scottie Barnes"));

const plain = P.hubRowFromParts({ sport: "epl", dayText: "Sat, 21 Nov", matchText: "Arsenal v Chelsea", pickText: "Arsenal 55%", chipClass: "chip GREEN", href: "/epl/app#game-5" });
assert.equal(plain.injury, "", "no chip without uncertain key players");
assert.equal(plain.sep, "v");

const done = P.hubRowFromParts({ sport: "nba", dayText: "Mon, 16 Nov", matchText: "A @ B", pickText: "B 70%", chipClass: "chip GREEN", href: "#", resultText: "✓ 101–110" });
assert.deepEqual(done.result, { won: true, text: "101–110" });

// NBA / NFL boards show a code for the pick: the row names (and highlights) the full team
assert.equal(nba.side, "New York Knicks");
for (const [code, a, b, want] of [["LAL", "LA Clippers", "Los Angeles Lakers", "Los Angeles Lakers"], ["LAC", "LA Clippers", "Los Angeles Lakers", "LA Clippers"],
  ["PHX", "Washington Wizards", "Phoenix Suns", "Phoenix Suns"], ["LAR", "Los Angeles Rams", "Los Angeles Chargers", "Los Angeles Rams"],
  ["JAX", "Jacksonville Jaguars", "Houston Texans", "Jacksonville Jaguars"], ["Draw", "Arsenal", "Chelsea", "Draw"]]) {
  assert.equal(P.resolveSide(code, a, b), want, code);
}

// ---------------------------------------------------------------- the row as the shared game card
const h = P.cardHtml(nba);
assert.ok(h.includes('class="pf-injchip"'), "injury chip on the card");
assert.ok(h.includes("⚠️ Injury watch"));
assert.match(h, /<span class="pf-inj-detail" id="[^"]+" role="note" hidden>Key players uncertain: Scottie Barnes/, "note inside the card, closed until tapped");
assert.ok(!/<a [^>]*>(?:(?!<\/a>)[\s\S])*Scottie Barnes/.test(h), "injury note text is not part of the card's link");
assert.ok(h.includes('class="pf-g-num" aria-hidden="true">61%<'), "chance gauge on the right");
assert.ok(h.includes(`<span class="chip ORANGE pf-chip">${L.label("ORANGE")}</span>`), "light badge label from lights.json");
assert.ok(h.includes(`<span class="pf-lpill pf-l-ORANGE">${L.label("ORANGE")}</span>`), "light pill label from lights.json");
assert.ok(!h.includes("Tue, 17 Nov"), "date not repeated on the card");
assert.ok(!/<a [^>]*>(?:(?!<\/a>)[\s\S])*<button/.test(h), "no button inside the link");
assert.ok(!P.cardHtml(plain).includes("pf-injchip"), "no chip when no injury");

// chances round down, like the lights
const floor = P.cardHtml(P.hubRowFromParts({ sport: "nhl", matchText: "A @ B", pickText: "A 54.9%", chipClass: "chip RED", href: "#" }));
assert.ok(floor.includes(">54%<"));

// results show on the card
assert.match(P.cardHtml(done), /<span class="pf-res pf-win">✓ 101–110<\/span>/);

// tennis: players, tournament under them
const ten = P.hubRowFromParts({ sport: "tennis", dayText: "Wed 18 Nov", matchText: "J Sinner v C Alcaraz", subText: "ATP Finals · Final", pickText: "J Sinner 72%", chipClass: "chip GREEN", href: "/tennis/app#game-1" });
assert.match(P.cardHtml(ten), /pf-team pf-picked">J Sinner.*<span class="pf-sep">v<\/span><span class="pf-team">C Alcaraz<\/span><span class="pf-sub">ATP Finals · Final<\/span>/s);

// ---------------------------------------------------------------- one date header per day
const rows = [
  { ...plain, day: "Sat, 21 Nov" }, { ...plain, day: "Sat, 21 Nov" }, { ...plain, day: "Sun, 22 Nov" },
];
assert.deepEqual(P.groupByDay(rows).map((g) => [g.day, g.rows.length]), [["Sat, 21 Nov", 2], ["Sun, 22 Nov", 1]]);
const list = P.cardListHtml(rows);
assert.equal((list.match(/class="pf-dayhead"/g) || []).length, 2);
assert.equal((list.match(/Sat, 21 Nov/g) || []).length, 1, "date shown once per day");

// ---------------------------------------------------------------- page wiring + desktop guard
const js = read("phone.js"), css = read("phone.css");
assert.ok(/nba\|nfl\|nhl\|epl\|tennis/.test(js) && /championship/.test(js), "all six sport pages wired");
assert.ok(!/hubRowHtml|hubListHtml|injurySheet/.test(js), "old compact rows and the injury bottom sheet are gone");
assert.ok(js.includes("Read more") && js.includes("pf-hublinks") && js.includes("pf-hub-green"));
const mq = css.indexOf("@media (max-width: 767.98px)");
for (const sel of [".pf-card {", ".pf-injchip {", ".pf-inj-detail {", ".pf-intro {", "pf-hub main p.pf-replaced", ".pf-cardsrc {"]) {
  const i = css.indexOf(sel);
  assert.ok(i > mq, `${sel} sits inside the phone media query`);
}
console.log("sport-pages-tidy ok");
