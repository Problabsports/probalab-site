// Email newsletter sign-up is retired: every sign-up spot is a "Join our Discord" block.
// No page posts to /api/subscribe or loads Turnstile; the beehiiv endpoint file is kept (unused).
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

function checkBlock(html, where) {
  assert.ok(html.includes('class="discord-join'), `${where}: has Discord block`);
  assert.ok(html.includes(`href="${DISCORD_INVITE_URL}"`), `${where}: links the invite`);
  assert.ok(html.includes(">Join our Discord<"), `${where}: button text`);
  assert.ok(html.includes(LINE), `${where}: short line`);
  assert.ok(/18\+/.test(html), `${where}: 18+ note`);
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

for (const f of ["index.html", "404.html", "contact.html", "privacy.html", "terms.html"]) checkBlock(read(f), f);
const idx = read("index.html");
assert.equal((idx.match(/data-discord-join="home-hero"/g) || []).length, 2, "both home hero copies swapped");
assert.equal((idx.match(/id="newsletter"/g) || []).length, 1, "index footer block keeps #newsletter anchor");

const faq = read("functions/faq.js");
assert.ok(faq.includes("DISCORD_INVITE_URL") && !faq.includes("signup form"), "FAQ points to Discord");
assert.ok(!read("site-nav.js").includes("data-nl"), "Newsletter tab handler removed");

// beehiiv code stays in the repo, unused.
assert.ok(existsSync(new URL("functions/api/subscribe.js", root)), "subscribe endpoint kept");
assert.ok(read("functions/api/subscribe.js").includes("beehiiv"), "beehiiv code kept");

console.log("discord-funnel tests passed");
