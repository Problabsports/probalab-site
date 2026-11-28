// POST /api/subscribe — free newsletter / free-board sign-up. Accepts JSON (site JS) or a plain form post (no JS).
// Single source of truth: Supabase `newsletter_signups`, written by the `probalab-subscribe` edge function
// (email format check, 5 sign-ups per IP per hour, salted IP hash, consent text; an existing email returns ok
// without revealing that it exists, so a returning visitor can still unlock the free board).
// Guards here: honeypot field `website`, and Cloudflare Turnstile when it is configured. TURNSTILE_SECRET set → a
// valid token is required (fail closed; no token = blocked, so bots can't skip it). TURNSTILE_SECRET missing →
// Turnstile is skipped and the honeypot + Supabase throttle guard the form, so a missing key never blocks visitors.
// TURNSTILE_HOSTNAMES is optional: when set, the token's hostname must match.
// Optional welcome email via Resend: only when RESEND_API_KEY and RESEND_FROM_EMAIL are set. It runs after the
// response (ctx.waitUntil) and never blocks or fails the sign-up.
import { DISCORD_INVITE_URL } from "../_shared/discord.js";

const TARGET = "https://zwdpsereqicvzbtfrrnd.supabase.co/functions/v1/probalab-subscribe";
const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const RESEND_URL = "https://api.resend.com/emails";
const EXPECTED_ACTION = "subscribe";
export const OK_MSG = "You're in. The full free board is unlocked on this device, and the Tue & Fri recaps will come to your inbox.";
const TURNSTILE_ERR = "Please complete the security check and try again.";

function hostnameAllowed(hostname, allowCsv) {
  const allowed = String(allowCsv || "").split(",").map((h) => h.trim()).filter(Boolean);
  if (!hostname || !allowed.length) return false;
  if (allowed.includes(hostname)) return true;
  // Branch previews: foo.probalab-site.pages.dev when parent host is listed.
  return allowed.some((a) => hostname === a || hostname.endsWith("." + a));
}

export function turnstileConfigured(env) {
  return !!String(env?.TURNSTILE_SECRET || "").trim();
}

export async function verifyTurnstile(env, token, ip) {
  const secret = String(env.TURNSTILE_SECRET || "").trim();
  const allowCsv = env.TURNSTILE_HOSTNAMES || "";
  if (!secret) return { ok: false };
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return { ok: false };
  let result;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const r = await fetch(TURNSTILE_VERIFY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { ok: false };
    result = await r.json();
  } catch {
    return { ok: false };
  }
  if (
    !result ||
    result.success !== true ||
    result.action !== EXPECTED_ACTION ||
    (String(allowCsv).trim() && !hostnameAllowed(result.hostname, allowCsv))
  ) {
    return { ok: false };
  }
  return { ok: true };
}

export function resendConfigured(env) {
  return !!(String(env?.RESEND_API_KEY || "").trim() && String(env?.RESEND_FROM_EMAIL || "").trim());
}

/** Welcome email: Discord invite + what Green and Best value mean. Plain, inline-styled HTML. */
export function welcomeEmail(to) {
  const subject = "You're in: your free ProbaLab board + Discord link";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#07080f;color:#e8ecf5;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07080f"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f1220;border:1px solid #2a3150;border-radius:12px">
<tr><td style="padding:24px">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#19e3ff">ProbaLab</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#ffffff">You're in. The full free board is unlocked.</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Every NBA, NFL and NHL win chance and fair price is now open on the device you signed up on. Our free Tue &amp; Fri recaps will land here, with the week's results and how our posted prices compared with the closing line.</p>
<p style="margin:0 0 20px"><a href="${DISCORD_INVITE_URL}" style="display:inline-block;background:#19e3ff;color:#07080f;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:8px">Join our free Discord for live alerts</a></p>
<h2 style="margin:0 0 8px;font-size:16px;color:#ffffff">How to read the lights</h2>
<p style="margin:0 0 8px;font-size:14px;line-height:1.5"><b style="color:#2fd7a0">Green</b> means our model gives the pick a 65%+ win chance (NBA, NFL and NHL). These are the model's stronger calls, and the green record is kept in public, losses included.</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.5"><b style="color:#b56cff">Best value</b> (NBA only) is a value flag, not a stronger green: the best available price is longer than our fair price (1 ÷ our win chance), so the bet is +EV against our number. A green pick can also carry a Best value tag.</p>
<p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:#8a96ab">Every pick is timestamped before the start and kept on the record: <a href="https://probalabsports.com/results" style="color:#19e3ff">probalabsports.com/results</a></p>
<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#8a96ab">Predictions for entertainment, not advice. 18+. Gamble responsibly. To stop these emails, reply with "unsubscribe".</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    "You're in. The full free board is unlocked.",
    "",
    "Every NBA, NFL and NHL win chance and fair price is now open on the device you signed up on. Free Tue & Fri recaps will land here.",
    "",
    `Join our free Discord for live alerts: ${DISCORD_INVITE_URL}`,
    "",
    "Green: our model gives the pick a 65%+ win chance (NBA, NFL, NHL).",
    "Best value (NBA only): the best available price is longer than our fair price (1 / our win chance), so it is +EV against our number. A value flag, not a stronger green.",
    "",
    "Every result: https://probalabsports.com/results",
    "Predictions for entertainment, not advice. 18+. Reply \"unsubscribe\" to stop these emails.",
  ].join("\n");
  return { to, subject, html, text };
}

/** Fire-and-forget welcome email. Never throws; returns true when Resend accepted it. */
export async function sendWelcome(env, to) {
  if (!resendConfigured(env)) return false;
  const from = String(env.RESEND_FROM_EMAIL).trim();
  const mail = welcomeEmail(to);
  try {
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${String(env.RESEND_API_KEY).trim()}`, "content-type": "application/json" },
      body: JSON.stringify({
        from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text,
        headers: { "List-Unsubscribe": `<mailto:${from.replace(/^.*<|>.*$/g, "")}?subject=unsubscribe>` },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) console.log("resend welcome failed", r.status);
    return r.ok;
  } catch {
    console.log("resend welcome error");
    return false;
  }
}

function htmlPage(ok, msg) {
  const title = ok ? "You're in" : "Not quite";
  const safe = String(msg || "").replace(/</g, "&lt;");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Newsletter | ProbaLab</title><link rel="stylesheet" href="/page.css"><main class="wrap"><h1>${title}</h1><section class="panel"><p>${safe}</p><p><a href="/">Back to ProbaLab</a></p></section></main>`;
}

export async function onRequestPost(ctx) {
  const req = ctx.request, env = ctx.env || {}, ct = req.headers.get("content-type") || "";
  const isForm = !ct.includes("application/json");
  let body;
  try {
    if (isForm) {
      const f = await req.formData();
      body = {
        email: f.get("email"),
        website: f.get("website"),
        source: f.get("source"),
        "cf-turnstile-response": f.get("cf-turnstile-response"),
      };
    } else body = await req.json();
  } catch { body = {}; }

  const email = String(body.email ?? "").trim();
  const website = String(body.website ?? "");
  const token = body["cf-turnstile-response"] ?? body.turnstileToken ?? "";
  const ip = req.headers.get("cf-connecting-ip") || "";
  const reply = (out, status) => (!isForm
    ? new Response(JSON.stringify(out), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } })
    : new Response(htmlPage(!!out.ok, out.ok ? (out.message || OK_MSG) : (out.error || "Something went wrong.")), {
      status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    }));

  // Honeypot: bots that fill the hidden field get a fake success and never reach Supabase / Turnstile / Resend.
  if (website) return reply({ ok: true, message: OK_MSG }, 200);

  const turned = turnstileConfigured(env) ? await verifyTurnstile(env, token, ip) : { ok: true, skipped: true };
  if (!turned.ok) return reply({ ok: false, error: TURNSTILE_ERR }, 403);

  let status, out;
  try {
    const res = await fetch(env.SUBSCRIBE_URL || TARGET, {
      method: "POST",
      headers: { "content-type": "application/json", "x-client-ip": ip },
      body: JSON.stringify({ email, website: "", source: String(body.source ?? "") }),
    });
    status = res.status;
    out = await res.json();
  } catch {
    status = 502;
    out = { ok: false, error: "Something went wrong. Please try again." };
  }

  if (out && out.ok) {
    // Non-blocking: the visitor gets their answer now; the welcome email goes out after the response.
    if (resendConfigured(env)) {
      const p = sendWelcome(env, email);
      if (ctx.waitUntil) ctx.waitUntil(p); else await p;
    }
    return reply({ ok: true, message: OK_MSG }, 200);
  }
  return reply({ ok: false, error: (out && out.error) || "Something went wrong. Please try again." }, status >= 400 ? status : 500);
}
