// "Join the free Discord" line + button: one shared component (discordCta) placed under the props board
// (/props/nba, /props/nfl, /props/nhl), under the pre-game preview on game pages (and the app's game view via
// /api/preview), and under the green record on /results and /props/results. One line plus the button, no popup.
import assert from "node:assert/strict";
import fs from "node:fs";
import { DISCORD_INVITE_URL, DISCORD_CTA_LABEL, DISCORD_CTA_LINES, discordCta } from "../functions/_shared/discord.js";
import { gamesOf, renderGame } from "../functions/_shared/site.js";
import { renderResultsPage } from "../functions/_shared/record-pages.js";
import { resultsFrom, renderBody } from "../functions/_shared/props-results.js";
import { onRequestGet as nbaPage } from "../functions/props/nba.js";
import { onRequestGet as nflPage } from "../functions/props/nfl.js";
import { onRequestGet as nhlPage } from "../functions/props/nhl.js";

const INVITE = "https://discord.gg/B8Q2hH26hV";
const LINES = {
  props: "Chat props and get the daily player of the day in Discord",
  game: "Talk about this game in Discord",
  results: "Get every pick live in Discord - free",
};
assert.equal(DISCORD_INVITE_URL, INVITE);
assert.equal(DISCORD_CTA_LABEL, "Join the free Discord");
assert.deepEqual(DISCORD_CTA_LINES, LINES);

// ---- the component
for (const [kind, line] of Object.entries(LINES)) {
  const h = discordCta(kind);
  assert.ok(h.includes(`data-discord-cta="${kind}"`), `${kind}: tagged`);
  assert.ok(h.includes(`<p class="discord-cta-line-text">${line}</p>`), `${kind}: one line of text`);
  assert.ok(h.includes(`<a class="discord-join-btn" href="${INVITE}" target="_blank" rel="noopener noreferrer">`), `${kind}: same button as Join our Discord, new tab`);
  assert.ok(h.includes(">Join the free Discord<"), `${kind}: button label`);
  assert.equal((h.match(/<a /g) || []).length, 1, `${kind}: one button`);
  assert.equal((h.match(/<p /g) || []).length, 1, `${kind}: one line`);
  assert.doesNotMatch(h, /<script|dialog|popup|modal|onclick/i, `${kind}: no popup`);
}
assert.equal(discordCta("nope"), "", "unknown spot renders nothing");
assert.match(discordCta("x", { line: "a < b" }), /a &lt; b/, "custom line is escaped");

// ---- CSS: phone stacked, desktop one row
const css = fs.readFileSync(new URL("../page.css", import.meta.url), "utf8");
assert.match(css, /\.discord-cta-line \{[^}]*flex-direction: column/);
assert.match(css, /@media \(min-width: 768px\) \{\s*\.discord-cta-line \{[^}]*flex-direction: row/);

const count = (h, kind) => (h.match(new RegExp(`data-discord-cta="${kind}"`, "g")) || []).length;
const order = (h, ...needles) => {
  let at = -1;
  for (const n of needles) { const i = h.indexOf(n, at + 1); assert.ok(i > at, `"${n}" comes after the previous item`); at = i; }
};

// ---- game page: under the pre-game preview
const soon = new Date(Date.now() + 6 * 3600e3).toISOString();
const feed = { season: 2027, games: [
  { season: 2027, status: "pre", game_id: "9101", start_utc: soon, home: "LAC", away: "DEN", pick: "LAC", pick_p: 0.72, light: "GREEN", won: null },
  { season: 2027, status: "post", game_id: "9001", start_utc: "2026-11-10T00:00:00Z", first_posted: "2026-11-09T00:00:00Z", home: "BOS", away: "NY", pick: "BOS", pick_p: 0.7, light: "GREEN", won: true, home_score: 110, away_score: 99 },
] };
const data = gamesOf("nba", feed);
for (const g of data.games) {
  const page = renderGame(g, data.games, {});
  assert.equal(count(page, "game"), 1, `game ${g.game_id}: one game CTA`);
  order(page, g.status === "post" ? "<h2>Our pre-game preview</h2>" : "<h2>Preview</h2>", 'data-discord-cta="game"', g.status === "post" ? "Probabilities come from" : 'class="discord-join"');
  assert.ok(page.includes(LINES.game));
}

// ---- /results: under the green record, above the trust strip
const row = { sport: "nba", light: "GREEN", won: true, pick: "BOS", pick_p: 0.7, start_utc: "2026-11-10T00:00:00Z", posted_price: 1.5, home: "BOS", away: "NY" };
const results = renderResultsPage([{ sport: "nba", name: "NBA", rows: [row], season: "2026–27" }]);
assert.equal(count(results, "results"), 1);
order(results, "<h2>Green results</h2>", "</section>", 'data-discord-cta="results"', 'class="trust-strip"');
assert.equal(count(renderResultsPage([{ sport: "nba", name: "NBA", rows: [], season: "2026–27" }]), "results"), 0, "no record yet, no CTA");

// ---- /props/results: under the headline green record
const prow = { date: "2026-11-13", game: "Away @ Home", player: "Player A", stat: "points", line: 20.5, call: "Over", pct: 0.62, light: "green", actual: 24, result: "W" };
const pb = renderBody(resultsFrom({ payload: { sports: { nba: { rows: [prow] } } } }));
assert.equal(count(pb, "results"), 1);
order(pb, 'id="prHero"', "</section>", 'data-discord-cta="results"', 'class="game-filter-bar pr-filters"');

// ---- props pages: under the board (sample boards, no Supabase row)
globalThis.fetch = async (input) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("/rest/v1/")) return new Response("[]", { headers: { "content-type": "application/json" } });
  throw new Error("unexpected fetch " + url);
};
const file = (p) => fs.readFileSync(new URL(`../data/${p}/board.json`, import.meta.url));
const ctx = (path, dir) => ({
  request: new Request("https://x.test" + path), params: {}, now: Date.parse("2026-11-20T02:00:00Z"),
  env: { SUPABASE_SERVICE_ROLE_KEY: "k", ASSETS: { fetch: async () => new Response(file(dir), { headers: { "content-type": "application/json" } }) } },
});
for (const [path, page, dir] of [["/props/nba", nbaPage, "nba_points_props"], ["/props/nfl", nflPage, "nfl_props"], ["/props/nhl", nhlPage, "nhl_props"]]) {
  const h = await (await page(ctx(path, dir))).text();
  assert.equal(count(h, "props"), 1, `${path}: one props CTA`);
  order(h, 'id="propsBoard"', 'id="ppNone"', 'data-discord-cta="props"');
  assert.ok(h.includes(LINES.props), `${path}: props line`);
}

console.log("discord-cta-line tests passed");
