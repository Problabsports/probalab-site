// The Results page has no sign-up block (desktop and phone); other pages show "Join our Discord" in the footer.
import assert from "node:assert/strict";
import { renderResultsPage, renderLightsPage } from "../functions/_shared/record-pages.js";

const row = { sport: "nba", light: "GREEN", won: true, pick: "BOS", pick_p: 0.7, start_utc: "2026-11-10T00:00:00Z", posted_price: 1.5, home: "BOS", away: "NY" };
const html = renderResultsPage([{ sport: "nba", name: "NBA", rows: [row], season: "2026–27" }]);
assert.ok(html.includes("<h1>Results</h1>"));
assert.ok(!/class="signup|class="discord-join"|action="\/api\/subscribe"/.test(html), "no sign-up block on /results");
const lights = renderLightsPage();
assert.ok(/class="discord-join" id="newsletter"/.test(lights), "other pages show the footer Discord block");
assert.ok(!/action="\/api\/subscribe"/.test(lights), "no email form on other pages");
console.log("results-signup tests passed");
