// Light-filter message is sport-aware: NBA (and the all-sports board) say "Green + Best value",
// every other sport says "Green picks". Best value is NBA-only, so no other sport mentions it,
// and the word "Super" never appears in a public filter message.
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderFilterBar, emptyFilterMessage, greenViewLabel, greenFilterNote } from "../functions/_shared/game-filters.js";

const note = (html) => (html.match(/<p class="small filter-note">([^<]*)<\/p>/) || [])[1];
const OTHERS = ["nfl", "nhl", "epl", "championship", "tennis"];

assert.equal(greenViewLabel("nba"), "Green + Best value");
assert.equal(greenViewLabel("all"), "Green + Best value");
for (const s of OTHERS) assert.equal(greenViewLabel(s), "Green picks", s);

// sport pages (lean hubs pass the page sport; filters.sport stays "all")
const nba = renderFilterBar({ sport: "all", light: "green" }, { basePath: "/nba", showSport: false, sport: "nba" });
assert.equal(note(nba), "Showing Green + Best value. Choose All lights to see every colour.");
for (const s of OTHERS) {
  const html = renderFilterBar({ sport: "all", light: "green" }, { basePath: `/${s}`, showSport: false, showSuper: false, sport: s });
  assert.equal(note(html), "Showing Green picks. Choose All lights to see every colour.", s);
  assert.ok(!/Best value|NBA|Super/.test(note(html)), `${s}: no Best value / NBA / Super in the note`);
  // /nfl/today style: the sport comes in on filters
  assert.equal(note(renderFilterBar({ sport: s, light: "green" }, { basePath: `/${s}/today`, showSport: false })), greenFilterNote(s));
  const empty = emptyFilterMessage({ sport: "all", light: "orange" }, { basePath: `/${s}`, sport: s });
  assert.ok(empty.includes(">Green picks</a>") && !empty.includes("Best value"), `${s}: empty-state link`);
}
assert.ok(emptyFilterMessage({ sport: "nba", light: "red" }, { basePath: "/nba" }).includes(">Green + Best value</a>"));

// no "Super" in any public filter message, anywhere it is written
const files = ["functions/_shared/game-filters.js", "functions/_shared/record-pages.js", "index.html", "hidden-sports.js", "tennis.js"];
for (const f of files) {
  const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  // visible words only: template expressions (code such as a showSuper flag) are not shown to anyone
  const text = src.replace(/\$\{[^{}]*\}/g, "");
  for (const m of text.matchAll(/Showing [^.<`"]*/g)) assert.ok(!/Super/.test(m[0]), `${f}: "${m[0]}"`);
  assert.ok(!/plus NBA Super/.test(src), `${f}: old wording`);
}
console.log("filter-note-wording ok");
