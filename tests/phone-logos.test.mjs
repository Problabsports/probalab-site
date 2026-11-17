// Phone match view logos: every NBA, NHL, Premier League and Championship team the site uses has a
// local logo file at the path phone-core.js builds; missing files fall back to a round badge.
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { NBA_TEAMS, slug } from "../functions/_shared/site.js";
const require = createRequire(import.meta.url);
const P = require("../phone-core.js");

const has = (src) => fs.existsSync(new URL(".." + src, import.meta.url));
const names = (file) => {
  let d = JSON.parse(fs.readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8"));
  d = Array.isArray(d) ? d : d.games ?? [];
  return [...new Set(d.flatMap((g) => [g.home, g.away]).filter(Boolean))];
};
const NHL = Object.values(JSON.parse(fs.readFileSync(new URL("../functions/today.js", import.meta.url), "utf8").match(/const NHLN = (\{[^}]+\})/)[1].replace(/(\w+):/g, '"$1":')));

const missing = [];
for (const [sport, list] of [["nba", Object.values(NBA_TEAMS)], ["nhl", NHL], ["epl", names("epl-picks.json")], ["championship", names("championship-picks.json")]]) {
  assert.ok(list.length >= 20, `${sport} team list`);
  for (const n of list) {
    const src = P.logoSrc(sport, n);
    assert.equal(P.teamSlug(n), slug(n), `slug matches the server for ${n}`);
    if (!has(src)) missing.push(src);
    assert.match(P.teamColor(sport, n), /^#[0-9a-f]{6}$/i, `${sport} colour for ${n}`);
  }
}
assert.deepEqual(missing, [], "every team has a local logo");
assert.equal(fs.readdirSync(new URL("../img/logos/nfl", import.meta.url)).length, 32);
assert.equal(fs.readdirSync(new URL("../img/logos/championship", import.meta.url)).length, 24);

// logo markup: local file only, never a remote URL
const html = P.logoHtml("nba", "LA Clippers", "LAC", 60);
assert.match(html, /src="\/img\/logos\/nba\/la-clippers\.png"/);
assert.match(html, /data-pf-logo="nba\|LA Clippers\|LAC"/);
assert.ok(!/https?:/.test(html));
// fallback: round badge with the abbreviation in the team colour (tennis has no logos)
const badge = P.badgeHtml("nba", "Utah Jazz", "UTAH", 56);
assert.match(badge, /class="pf-badge"/);
assert.match(badge, />UTAH</);
assert.match(badge, /--pf-tc:#[0-9a-f]{6}/i);
assert.equal(P.logoSrc("tennis", "Jannik Sinner"), "");
assert.match(P.logoHtml("tennis", "Jannik Sinner"), /pf-badge/);
assert.equal(P.teamAbbr("Queens Park Rangers"), "QPR");
assert.equal(P.teamAbbr("Burnley"), "BUR");
assert.equal(P.teamAbbr("x", "lac"), "LAC");
// phone.css: the crest box becomes a round logo holder, the badge is round
const css = fs.readFileSync(new URL("../phone.css", import.meta.url), "utf8");
assert.match(css, /\.pf-badge \{[^}]*border-radius: 50%/);
console.log("phone-logos tests passed");
