// /api/subscribe: Turnstile is required only when TURNSTILE_SECRET is configured.
// No secret → real visitors are never blocked (honeypot + Supabase throttle still apply).
// Secret set → a missing or bad token is rejected (bots can't skip it by leaving the token out).
import assert from "node:assert/strict";
import { onRequestPost, turnstileConfigured } from "../functions/api/subscribe.js";

const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push(String(url));
  if (String(url).includes("siteverify")) {
    const tok = new URLSearchParams(init.body).get("response");
    const ok = tok === "good";
    return new Response(JSON.stringify({ success: ok, action: "subscribe", hostname: "probalabsports.com" }), { status: 200 });
  }
  if (String(url).includes("probalab-subscribe")) return new Response(JSON.stringify({ ok: true }), { status: 200 });
  throw new Error("unexpected fetch " + url);
};

const post = (env, body) => onRequestPost({
  env,
  request: new Request("https://probalabsports.com/api/subscribe", {
    method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "1.2.3.4" }, body: JSON.stringify(body),
  }),
});
const json = async (r) => ({ status: r.status, body: await r.json() });

assert.equal(turnstileConfigured({}), false);
assert.equal(turnstileConfigured({ TURNSTILE_SECRET: "  " }), false);
assert.equal(turnstileConfigured({ TURNSTILE_SECRET: "s" }), true);

// No keys at all: a real visitor with no token gets through to Supabase.
calls.length = 0;
let r = await json(await post({}, { email: "a@b.co", source: "home-top-pick" }));
assert.equal(r.status, 200); assert.equal(r.body.ok, true);
assert.ok(!calls.some((u) => u.includes("siteverify")), "no Turnstile call when unconfigured");
assert.ok(calls.some((u) => u.includes("probalab-subscribe")));

// Secret set, no token: blocked before Supabase.
calls.length = 0;
r = await json(await post({ TURNSTILE_SECRET: "s" }, { email: "a@b.co" }));
assert.equal(r.status, 403);
assert.ok(!calls.some((u) => u.includes("probalab-subscribe")));

// Secret set, bad token: blocked. Good token: through (hostnames optional, and matched when set).
r = await json(await post({ TURNSTILE_SECRET: "s" }, { email: "a@b.co", "cf-turnstile-response": "bad" }));
assert.equal(r.status, 403);
r = await json(await post({ TURNSTILE_SECRET: "s" }, { email: "a@b.co", "cf-turnstile-response": "good" }));
assert.equal(r.status, 200);
r = await json(await post({ TURNSTILE_SECRET: "s", TURNSTILE_HOSTNAMES: "probalabsports.com" }, { email: "a@b.co", "cf-turnstile-response": "good" }));
assert.equal(r.status, 200);
r = await json(await post({ TURNSTILE_SECRET: "s", TURNSTILE_HOSTNAMES: "other.com" }, { email: "a@b.co", "cf-turnstile-response": "good" }));
assert.equal(r.status, 403, "wrong hostname rejected");

// Honeypot: fake success, nothing sent anywhere.
calls.length = 0;
r = await json(await post({}, { email: "a@b.co", website: "spam" }));
assert.equal(r.body.ok, true); assert.equal(calls.length, 0);

console.log("subscribe-turnstile tests passed");

// ---------------------------------------------------------------- Resend welcome (optional, non-blocking)
{
  const { resendConfigured, welcomeEmail, OK_MSG } = await import("../functions/api/subscribe.js");
  const { DISCORD_INVITE_URL } = await import("../functions/_shared/discord.js");
  assert.equal(resendConfigured({}), false);
  assert.equal(resendConfigured({ RESEND_API_KEY: "k" }), false, "needs both key and from");
  assert.equal(resendConfigured({ RESEND_API_KEY: "k", RESEND_FROM_EMAIL: "ProbaLab <hi@probalabsports.com>" }), true);
  const m = welcomeEmail("a@b.co");
  assert.ok(m.html.includes(DISCORD_INVITE_URL) && m.text.includes(DISCORD_INVITE_URL), "welcome has the Discord invite");
  assert.match(m.html, /Green<\/b> means our model gives the pick a 65%\+ win chance/);
  assert.match(m.html, /Best value<\/b> \(NBA only\)/);
  assert.ok(!/pinnacle/i.test(m.html + m.text), "no bookmaker names in public copy");

  // No Resend keys: no Resend call. With keys: one call, after the response (waitUntil), and a Resend failure
  // never fails the sign-up.
  calls.length = 0;
  let r = await json(await post({}, { email: "a@b.co" }));
  assert.equal(r.body.ok, true); assert.equal(r.body.message, OK_MSG);
  assert.ok(!calls.some((u) => u.includes("resend")));

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).includes("api.resend.com") ? (calls.push(String(url)), new Response("{}", { status: 500 })) : realFetch(url, init));
  calls.length = 0;
  const waits = [];
  const res = await onRequestPost({
    env: { RESEND_API_KEY: "k", RESEND_FROM_EMAIL: "ProbaLab <hi@probalabsports.com>" },
    waitUntil: (p) => waits.push(p),
    request: new Request("https://probalabsports.com/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "a@b.co" }) }),
  });
  assert.equal(res.status, 200, "Resend failure does not fail the sign-up");
  assert.equal(waits.length, 1, "welcome email is deferred with waitUntil");
  assert.equal(await waits[0], false);
  assert.ok(calls.some((u) => u.includes("api.resend.com/emails")));
  globalThis.fetch = realFetch;

  // Existing email (edge function returns ok without saying so) → still ok, so the free board unlocks.
  r = await json(await post({}, { email: "already@there.co" }));
  assert.equal(r.body.ok, true);
}
console.log("subscribe resend tests passed");
