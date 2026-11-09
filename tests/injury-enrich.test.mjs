
import { buildInjuryNote, applyInjuryEnrichment, INJURY_SPORT_RULES } from "../functions/_shared/injury-enrich.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const note = buildInjuryNote([
  { player: "Josh Allen", status: "Questionable", pos: "QB" },
  { player: "Stefon Diggs", status: "Out", pos: "WR" },
]);
assert(note.includes("Josh Allen (Questionable)"), "note player");
assert(note.includes("Light not changed by this"), "closing line");
assert(note.startsWith("⚠️ Key players uncertain:"), "prefix");

const inj = {
  byTeam: {
    "buffalo bills": [
      { player: "Josh Allen", pos: "QB", status: "Questionable" },
      { player: "Practice Squad Guy", pos: "WR", status: "Out" },
      { player: "IR Wideout", pos: "WR", status: "Injured reserve" },
      { player: "Backup CB", pos: "CB", status: "Out" },
      { player: "Suspended Edge", pos: "DE", status: "Suspended" },
    ],
    "miami dolphins": [
      { player: "Tua Tagovailoa", pos: "QB", status: "Out" },
      { player: "IR Back", pos: "RB", status: "Injured reserve" },
    ],
  },
};
const games = [
  { game_id: "1", home: "MIA", away: "BUF", home_name: "Miami Dolphins", away_name: "Buffalo Bills", status: "pre", light: "GREEN" },
];
applyInjuryEnrichment("nfl", games, inj);
assert(games[0].injury_warning === true, "flagged");
assert(games[0].injury_note.includes("Josh Allen"), "QB included");
assert(games[0].injury_note.includes("Tua Tagovailoa"), "opp QB included");
assert(games[0].injury_note.includes("Practice Squad Guy"), "WR Out included");
assert(!games[0].injury_note.includes("IR Wideout"), "IR WR excluded");
assert(!games[0].injury_note.includes("IR Back"), "IR RB excluded");
assert(!games[0].injury_note.includes("Backup CB"), "CB not skill/OL");
assert(!games[0].injury_note.includes("Suspended"), "suspended excluded");
assert(games[0].light === "GREEN", "light unchanged");
assert(INJURY_SPORT_RULES.tennis.includes("SKIPPED"), "tennis skipped");

// feed-owned fields not overwritten
const owned = [{ game_id: "2", injury_warning: false, injury_note: "", status: "pre", home_name: "Buffalo Bills", away_name: "Miami Dolphins" }];
applyInjuryEnrichment("nfl", owned, inj);
assert(owned[0].injury_warning === false, "feed owns false");

console.log("injury-enrich.test.mjs: ok");
