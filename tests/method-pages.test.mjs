import assert from "node:assert/strict";
import { renderHowItWorksPage, renderBacktestPage } from "../functions/_shared/method-pages.js";
import { renderLightsPage, renderResultsPage } from "../functions/_shared/record-pages.js";

const how = renderHowItWorksPage();
assert.match(how, /<h1>How it works<\/h1>/);
assert.match(how, /href="\/lights"/);
assert.match(how, /href="\/backtest"/);
assert.match(how, /href="\/results"/);
assert.match(how, /NBA/);
assert.match(how, /NFL/);
assert.match(how, /NHL/);
assert.match(how, /Premier League/);
assert.match(how, /Championship/);
assert.match(how, /Tennis/);
assert.match(how, /held back/);
assert.match(how, /stays orange/);
assert.match(how, /timestamped/);
assert.match(how, /not a guarantee|not guarantees|not betting advice/i);
assert.match(how, /18\+/);

const bt = renderBacktestPage();
assert.match(bt, /Backtest — not live results/);
assert.match(bt, /not the live record/i);
assert.match(bt, /href="\/results"/);
assert.match(bt, /href="\/results\.csv"/);
assert.doesNotMatch(bt, /fold(?:ed)? into the live green/i);
assert.match(bt, /1,322/); // NBA 2025-26 games
assert.match(bt, /536 of 697/);
assert.match(bt, /162 Super games/);
assert.match(bt, /592 of 919/);
assert.match(bt, /2,414 of 4,192/);
assert.match(bt, /609 of 867/);
assert.match(bt, /602 of 1,140/);
assert.match(bt, /274 of 406/);
assert.match(bt, /1,294 of 2,760/);
assert.match(bt, /19,669 of 30,189/);
assert.match(bt, /8,017 of 10,225/);
assert.match(bt, /48\.7%/); // EPL 2025-26 loss year
assert.match(bt, /53\.9%/); // NHL 2025-26 weaker year
assert.match(bt, /Coming when we have a trustworthy priced sample|units are not reported/i);
assert.match(bt, /18\+/);
// Must not present the NHL JSON's 60% green counts as 65%+ greens
assert.doesNotMatch(bt, /652\/|1,710|3,005 green/);

const lights = renderLightsPage();
assert.match(lights, /keeps its normal confidence light/);
assert.match(lights, /stays orange/);
assert.doesNotMatch(lights, /shown as green instead/);
assert.match(lights, /href="\/how-it-works"/);
assert.match(lights, /href="\/backtest"/);

const results = renderResultsPage([], { sport: "all", light: "green" });
assert.match(results, /href="\/backtest"/);
assert.match(results, /href="\/how-it-works"/);

console.log("Method pages: assertions passed");
