// The Results page has no newsletter signup (desktop and phone); other pages keep theirs.
import assert from "node:assert/strict";
import { renderResultsPage, renderLightsPage } from "../functions/_shared/record-pages.js";

const row = { sport: "nba", light: "GREEN", won: true, pick: "BOS", pick_p: 0.7, start_utc: "2026-11-10T00:00:00Z", posted_price: 1.5, home: "BOS", away: "NY" };
const html = renderResultsPage([{ sport: "nba", name: "NBA", rows: [row], season: "2026–27" }]);
assert.ok(html.includes("<h1>Results</h1>"));
assert.ok(!/class="signup/.test(html) && !/action="\/api\/subscribe"/.test(html), "no newsletter form on /results");
assert.ok(/action="\/api\/subscribe"/.test(renderLightsPage()), "other pages keep the footer newsletter");
console.log("results-signup tests passed");
