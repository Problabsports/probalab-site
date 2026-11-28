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

// ---------------------------------------------------------------- Resend welcome (same key + sender as members)
{
  const { resendConfigured, fromAddress, welcomeEmail, OK_MSG } = await import("../functions/api/subscribe.js");
  const { FROM_EMAIL } = await import("../functions/_shared/membership.js");
  const { DISCORD_INVITE_URL } = await import("../functions/_shared/discord.js");
  assert.equal(resendConfigured({}), false);
  assert.equal(resendConfigured({ RESEND_API_KEY: "k" }), true, "RESEND_API_KEY alone (members already use it)");
  assert.equal(fromAddress({}), FROM_EMAIL, "verified members sender by default");
  assert.equal(FROM_EMAIL, "ProbaLab Sports <hello@probalabsports.com>");
  const m = welcomeEmail("a@b.co", "https://probalabsports.com/api/unsubscribe?e=x&t=y");
  assert.ok(m.html.includes(DISCORD_INVITE_URL) && m.text.includes(DISCORD_INVITE_URL), "welcome has the Discord invite");
  assert.match(m.html, /Green<\/b> means our model gives the pick a 65%\+ win chance/);
  assert.match(m.html, /Best value<\/b> \(NBA only\)/);
  assert.ok(m.html.includes("https://probalabsports.com/api/unsubscribe?e=x&t=y") && m.text.includes("/api/unsubscribe?e=x&t=y"), "unsubscribe link in both parts");
  assert.match(m.html, /ProbaLab Sports · hello@probalabsports\.com/, "sender footer");
  assert.ok(!/pinnacle|Tue &|Tuesday|weekly/i.test(m.html + m.text), "no bookmaker names, no unscheduled newsletter promises");
  assert.ok(!/Tue|weekly/i.test(OK_MSG));

  // No key: no Resend call.
  calls.length = 0;
  let r = await json(await post({}, { email: "a@b.co" }));
  assert.equal(r.body.ok, true); assert.equal(r.body.message, OK_MSG);
  assert.ok(!calls.some((u) => u.includes("resend")));

  // With the key: one deferred call with List-Unsubscribe (+ one-click) headers; a Resend failure never fails sign-up.
  const realFetch = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (url, init) => (String(url).includes("api.resend.com")
    ? (calls.push(String(url)), sent = JSON.parse(init.body), new Response("{}", { status: 500 }))
    : realFetch(url, init));
  const run = async (host, email) => {
    calls.length = 0; sent = null;
    const waits = [];
    const res = await onRequestPost({
      env: { RESEND_API_KEY: "k", SUPABASE_SERVICE_ROLE_KEY: "service-secret" },
      waitUntil: (p) => waits.push(p),
      request: new Request(`https://${host}/api/subscribe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }),
    });
    for (const w of waits) await w;
    return { status: res.status, waits: waits.length };
  };
  let out = await run("probalabsports.com", "Fan@Example.com");
  assert.equal(out.status, 200, "Resend failure does not fail the sign-up");
  assert.equal(out.waits, 1, "welcome email is deferred with waitUntil");
  assert.ok(sent, "production: welcome sent");
  assert.equal(sent.from, FROM_EMAIL);
  assert.deepEqual(sent.to, ["Fan@Example.com"]);
  assert.match(sent.headers["List-Unsubscribe"], /^<https:\/\/probalabsports\.com\/api\/unsubscribe\?e=[\w-]+&t=[\w-]+>, <mailto:hello@probalabsports\.com\?subject=unsubscribe>$/);
  assert.equal(sent.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  // Preview hosts: only the test inbox gets mail (same rule as the members welcome).
  out = await run("website-full-polish-and-gate.probalab-site.pages.dev", "fan@example.com");
  assert.equal(sent, null, "preview: no mail to real sign-ups");
  globalThis.fetch = realFetch;

  // Existing email (edge function returns ok without saying so) → still ok, so the free board unlocks.
  r = await json(await post({}, { email: "already@there.co" }));
  assert.equal(r.body.ok, true);
}
console.log("subscribe resend tests passed");

// ---------------------------------------------------------------- /api/unsubscribe (HMAC link, GET page, POST + RFC 8058)
{
  const { unsubscribeUrl, verifyUnsubscribe } = await import("../functions/_shared/unsubscribe-token.js");
  const unsub = await import("../functions/api/unsubscribe.js");
  const env = { SUPABASE_SERVICE_ROLE_KEY: "service-secret" };
  const link = await unsubscribeUrl(env, "Fan@Example.com", "https://probalabsports.com");
  const u = new URL(link);
  assert.equal(u.pathname, "/api/unsubscribe");
  assert.equal(await verifyUnsubscribe(env, u.searchParams.get("e"), u.searchParams.get("t")), "fan@example.com");
  assert.equal(await verifyUnsubscribe({ SUPABASE_SERVICE_ROLE_KEY: "other" }, u.searchParams.get("e"), u.searchParams.get("t")), null, "wrong key");
  const other = new URL(await unsubscribeUrl(env, "someone@else.com"));
  assert.equal(await verifyUnsubscribe(env, other.searchParams.get("e"), u.searchParams.get("t")), null, "token bound to its email");
  assert.equal(await verifyUnsubscribe(env, "!!", "x"), null);

  const realFetch = globalThis.fetch;
  const patches = [];
  globalThis.fetch = async (url, init) => { patches.push({ url: String(url), init }); return new Response(null, { status: 204 }); };
  const ctx = (method, href, body) => ({ env, request: new Request(href, { method, body, headers: body ? { "content-type": "application/x-www-form-urlencoded" } : {} }) });

  // GET never unsubscribes (mail scanners prefetch links); it shows a confirm button.
  let res = await unsub.onRequestGet(ctx("GET", link));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /fan@example\.com/);
  assert.match(html, /<form method="post"/);
  assert.match(html, /noindex/);
  assert.equal(patches.length, 0);

  // Bad link: 400 page, nothing written.
  res = await unsub.onRequestGet(ctx("GET", "https://probalabsports.com/api/unsubscribe?e=abc&t=def"));
  assert.equal(res.status, 400);
  res = await unsub.onRequestPost(ctx("POST", "https://probalabsports.com/api/unsubscribe?e=abc&t=def", "List-Unsubscribe=One-Click"));
  assert.equal(res.status, 400);
  assert.equal(patches.length, 0);

  // RFC 8058 one-click POST: sets unsubscribed_at for that address (case-insensitive), plain 200.
  res = await unsub.onRequestPost(ctx("POST", link, "List-Unsubscribe=One-Click"));
  assert.equal(res.status, 200);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].init.method, "PATCH");
  assert.match(patches[0].url, /\/rest\/v1\/newsletter_signups\?email=ilike\.fan%40example\.com&unsubscribed_at=is\.null$/);
  assert.ok(JSON.parse(patches[0].init.body).unsubscribed_at);
  assert.equal(patches[0].init.headers.authorization, "Bearer service-secret");

  // Button POST from the page: confirmation page.
  res = await unsub.onRequestPost(ctx("POST", link, ""));
  assert.equal(res.status, 200);
  assert.match(await res.text(), /You(&#39;|')re unsubscribed/);

  // Wildcards in an address are escaped for ilike.
  const w = new URL(await unsubscribeUrl(env, "a_b%c@x.co"));
  patches.length = 0;
  await unsub.onRequestPost(ctx("POST", w.href, "List-Unsubscribe=One-Click"));
  assert.match(patches[0].url, /email=ilike\.a%5C_b%5C%25c%40x\.co/);
  globalThis.fetch = realFetch;
}
console.log("unsubscribe tests passed");
