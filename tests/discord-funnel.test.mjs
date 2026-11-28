// Every sign-up spot is a "Join our Discord" block. The one exception is the home page (index.html):
// a free email + Discord callout right under Today's top pick posts to /api/subscribe (Turnstile on submit).
// Static pages and server-rendered pages stay Discord-only.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { DISCORD_INVITE_URL, DISCORD_JOIN_LINE, discordJoin } from "../functions/_shared/discord.js";
import { shell, signupMain, signupForm, renderHeader } from "../functions/_shared/site.js";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const LINE = "Free picks, results and the weekly newsletter in our Discord.";
const BAD = [/action="\/api\/subscribe"/, /api\/subscribe/, /cf-turnstile/, /challenges\.cloudflare\.com\/turnstile/, /data-signup/, /type="email"[^>]*name="email"[^>]*placeholder="you@example\.com"[\s\S]{0,400}data-signup/, /data-nl\b/];

assert.equal(DISCORD_INVITE_URL, "https://discord.gg/B8Q2hH26hV");
assert.equal(DISCORD_JOIN_LINE, LINE);

function checkBlock(html, where, { allowHomeSignup = false } = {}) {
  assert.ok(html.includes('class="discord-join'), `${where}: has Discord block`);
  assert.ok(html.includes(`href="${DISCORD_INVITE_URL}"`), `${where}: links the invite`);
  assert.ok(html.includes(">Join our Discord<"), `${where}: button text`);
  assert.ok(html.includes(LINE), `${where}: short line`);
  assert.ok(/18\+/.test(html), `${where}: 18+ note`);
  if (allowHomeSignup) return;
  for (const re of BAD) assert.ok(!re.test(html), `${where}: no email sign-up (${re})`);
}

const b = discordJoin("x", { id: "newsletter" });
checkBlock(b, "discordJoin");
assert.match(b, /id="newsletter"/);
assert.match(b, /target="_blank" rel="noopener noreferrer"/);
assert.doesNotMatch(discordJoin("x"), /id="newsletter"/);
assert.equal(signupMain("game"), discordJoin("game"));
assert.equal(signupForm("faq"), discordJoin("faq", { id: "newsletter" }));
assert.doesNotMatch(renderHeader("/"), />Newsletter</);

const page = shell({ title: "T", description: "D", path: "/faq", body: "<p>x</p>" });
checkBlock(page, "shell footer");
assert.equal((page.match(/discord-join-btn/g) || []).length, 1, "one join button in shell footer");
assert.doesNotMatch(page, /discord-cta-footer/, "no duplicate footer Discord link next to the block");
const noSignup = shell({ title: "T", description: "D", path: "/members", body: "", signup: false });
for (const re of BAD) assert.ok(!re.test(noSignup), `signup:false page: ${re}`);

for (const f of ["404.html", "contact.html", "privacy.html", "terms.html"]) checkBlock(read(f), f);
const idx = read("index.html");
checkBlock(idx, "index.html", { allowHomeSignup: true });
assert.equal((idx.match(/data-discord-join="home-hero"/g) || []).length, 0, "home hero Discord block moved into the top-pick callout");
assert.equal((idx.match(/id="newsletter"/g) || []).length, 1, "index footer block keeps #newsletter anchor");
// Home callout: one builder, slotted under the top pick in the skeleton and in renderHome.
assert.equal((idx.match(/<div id="homeSignupSlot"><\/div>/g) || []).length, 2, "signup slot under top pick (skeleton + renderHome)");
assert.match(idx, /Get daily \+EV alerts, full Closing Line Value recaps & early Founding Member access free/);
assert.match(idx, /fetch\("\/api\/subscribe"/);
assert.match(idx, /turnstile\/v0\/api\.js\?render=explicit/, "Turnstile loads lazily, explicit render");
assert.doesNotMatch(idx, /<script[^>]+challenges\.cloudflare\.com/, "no eager Turnstile script tag");
assert.match(idx, /Join our free Discord/);
assert.ok(read("phone.js").includes('PL_homeSignupHtml("phone-home")'), "phone home shows the callout under top greens");

const faq = read("functions/faq.js");
assert.ok(faq.includes("DISCORD_INVITE_URL") && !faq.includes("signup form"), "FAQ points to Discord");
assert.ok(!read("site-nav.js").includes("data-nl"), "Newsletter tab handler removed");

// beehiiv code stays in the repo, unused.
assert.ok(existsSync(new URL("functions/api/subscribe.js", root)), "subscribe endpoint kept");
assert.ok(read("functions/api/subscribe.js").includes("beehiiv"), "beehiiv code kept");

console.log("discord-funnel tests passed");
