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
