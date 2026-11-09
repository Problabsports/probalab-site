import { injuryOf, injuryBadge, injuryExcerpt, applyInjuryPreviewDemo } from "../functions/_shared/injury-warning.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }

assert(injuryOf({}) === null, "absent fields → null");
assert(injuryOf({ light: "ORANGE" }) === null, "no key → null");
assert(injuryOf({ injury_warning: false, injury_note: "x" }) === null, "false → null");
assert(injuryOf({ injury_warning: true, injury_note: "Barnes GTD" }).note === "Barnes GTD", "true+note");
assert(injuryOf({ injury_warning: true, injury_note: "⚠️ Barnes GTD" }).note === "Barnes GTD", "strips leading glyph");
assert(injuryOf({ injury_warning: true }).note.includes("uncertain"), "true empty note → fallback");

const badge = injuryBadge({ injury_warning: true, injury_note: "A & B are questionable" });
assert(badge.includes("Injury watch"), "label visible");
assert(badge.includes("A &amp; B are questionable"), "note inline escaped");
assert(!badge.includes("injury-watch-more"), "short note needs no more");

const long = "Key players uncertain: " + "Name (Questionable), ".repeat(8) + "Last (Out)";
const longBadge = injuryBadge({ injury_warning: true, injury_note: long });
assert(longBadge.includes("injury-watch-more"), "long note has more");
assert(longBadge.includes("data-injury-note="), "full note on more button");
assert(injuryBadge({ injury_warning: false }) === "", "no badge when false");

const ex = injuryExcerpt("short note");
assert(ex.more === false && ex.text === "short note", "excerpt short");

const games = [{ game_id: "401909955", light: "ORANGE" }, { game_id: "1" }];
applyInjuryPreviewDemo(games, "preview-injury-prominent.probalab-site.pages.dev");
assert(games[0].injury_warning === true, "demo sets TOR on prominent preview");
assert(!games[1].injury_warning, "demo skips others");

const live = [{ game_id: "401909955", injury_warning: false }];
applyInjuryPreviewDemo(live, "preview-injury-warning.probalab-site.pages.dev");
assert(live[0].injury_warning === false, "demo skipped when key present");

applyInjuryPreviewDemo([{ game_id: "401909955" }], "probalabsports.com");
// no throw; production host ignored

console.log("injury-warning.test.mjs: ok");
