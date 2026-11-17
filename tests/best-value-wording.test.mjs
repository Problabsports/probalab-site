// Best value (NBA Super) wording on How the lights work (/lights) and How it works (/how-it-works):
// the plain sentence is shown, and no cap or limit on the price gap is mentioned.
import assert from "node:assert/strict";
import { renderHowItWorksPage } from "../functions/_shared/method-pages.js";
import { renderLightsPage } from "../functions/_shared/record-pages.js";

const SENTENCE = "Best value is an NBA pick where the bookmaker&#39;s price beats our fair price.";
const plain = (h) => h.replace(/&#39;|&rsquo;|’/g, "'");
for (const [name, html] of [["/lights", renderLightsPage()], ["/how-it-works", renderHowItWorksPage()]]) {
  const body = typeof html === "string" ? html : String(html);
  assert.ok(plain(body).includes(plain(SENTENCE)), `${name} has the Best value sentence`);
  assert.ok(!/cap on how large|how large that gap|price cap|\bcapped\b|\(with a cap|a cap\b/i.test(body), `${name} mentions no cap`);
  assert.ok(!/\blimit\b/i.test(plain(body).match(/Super is different[^<]*/)?.[0] ?? ""), `${name} mentions no limit in the Super paragraph`);
}
console.log("best-value-wording tests passed");
