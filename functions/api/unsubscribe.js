// /api/unsubscribe?e=<b64url email>&t=<hmac> — newsletter unsubscribe (functions/_shared/unsubscribe-token.js).
// GET: confirmation page with one button (mail scanners prefetch GET links, so GET never unsubscribes).
// POST: unsubscribes. Works for the page's button (form post) and for RFC 8058 one-click from mail apps
// (body "List-Unsubscribe=One-Click", sent because the welcome email carries List-Unsubscribe-Post).
// Effect: newsletter_signups.unsubscribed_at = now() for that address (case-insensitive). A new sign-up later
// clears it again (probalab-subscribe edge function). Unknown addresses get the same answer (no account probing).
import { verifyUnsubscribe } from "../_shared/unsubscribe-token.js";
import { supabaseAdmin } from "../_shared/membership.js";
import { esc } from "../_shared/site.js";

function page(title, inner, status = 200) {
  return new Response(`<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} | ProbaLab</title><link rel="stylesheet" href="/page.css"></head>
<body><main class="wrap" style="max-width:560px;padding-top:40px"><p class="eyebrow">// ProbaLab Sports</p><h1>${esc(title)}</h1>
<section class="panel">${inner}</section><p class="small"><a href="/">Back to ProbaLab</a></p></main></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" },
  });
}
const BAD = () => page("Link not valid", "<p>This unsubscribe link is incomplete or has expired. Reply to any ProbaLab email with \"unsubscribe\" and we'll take you off the list.</p>", 400);

async function params(ctx) {
  const url = new URL(ctx.request.url);
  return { e: url.searchParams.get("e") || "", t: url.searchParams.get("t") || "" };
}

export async function markUnsubscribed(env, email) {
  const like = email.replace(/[%_\\]/g, (c) => "\\" + c);
  await supabaseAdmin(env, "PATCH", `/rest/v1/newsletter_signups?email=ilike.${encodeURIComponent(like)}&unsubscribed_at=is.null`,
    { unsubscribed_at: new Date().toISOString() }, { prefer: "return=minimal" });
}

export async function onRequestGet(ctx) {
  const { e, t } = await params(ctx);
  const email = await verifyUnsubscribe(ctx.env, e, t);
  if (!email) return BAD();
  return page("Unsubscribe", `<p>Stop ProbaLab emails to <b>${esc(email)}</b>?</p>
<form method="post" action="/api/unsubscribe?e=${esc(encodeURIComponent(e))}&amp;t=${esc(encodeURIComponent(t))}">
<button class="btn" type="submit">Unsubscribe</button></form>
<p class="small">Your free board stays unlocked on your device. You can sign up again any time.</p>`);
}

export async function onRequestPost(ctx) {
  const { e, t } = await params(ctx);
  const email = await verifyUnsubscribe(ctx.env, e, t);
  const oneClick = /List-Unsubscribe=One-Click/i.test(await ctx.request.clone().text().catch(() => ""));
  if (!email) return oneClick ? new Response("invalid", { status: 400 }) : BAD();
  try {
    await markUnsubscribed(ctx.env, email);
  } catch (err) {
    console.log("unsubscribe failed", String(err && err.message || err).slice(0, 120));
    return oneClick ? new Response("error", { status: 500 })
      : page("Something went wrong", "<p>We couldn't update your preferences just now. Please try again in a minute, or reply \"unsubscribe\" to any ProbaLab email.</p>", 500);
  }
  if (oneClick) return new Response("ok", { status: 200, headers: { "cache-control": "no-store" } });
  return page("You're unsubscribed", `<p><b>${esc(email)}</b> won't get ProbaLab emails any more.</p><p class="small">Changed your mind? Sign up again on the <a href="/">home page</a>.</p>`);
}
