// POST /api/subscribe — newsletter sign-up. Accepts JSON (site JS) or a plain form post (no JS).
// Guards: Cloudflare Turnstile (fail closed), honeypot field `website`, email checks + IP throttle in Supabase.
// After those pass: consent backup in Supabase, then beehiiv with double opt-in (confirm-your-email).
// Existing beehiiv subscribers are not re-blasted a welcome email (send_welcome_email stays false).
const TARGET = "https://zwdpsereqicvzbtfrrnd.supabase.co/functions/v1/probalab-subscribe";
const BEEHIIV = "https://api.beehiiv.com/v2/publications";
const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const EXPECTED_ACTION = "subscribe";
const CONFIRM_MSG = "Check your inbox to confirm your email. You're not on the list until you click the link.";
const TURNSTILE_ERR = "Please complete the security check and try again.";

function hostnameAllowed(hostname, allowCsv) {
  const allowed = String(allowCsv || "").split(",").map((h) => h.trim()).filter(Boolean);
  if (!hostname || !allowed.length) return false;
  if (allowed.includes(hostname)) return true;
  // Branch previews: foo.probalab-site.pages.dev when parent host is listed.
  return allowed.some((a) => hostname === a || hostname.endsWith("." + a));
}

async function verifyTurnstile(env, token, ip) {
  const secret = env.TURNSTILE_SECRET;
  const allowCsv = env.TURNSTILE_HOSTNAMES || "";
  if (!secret || !String(allowCsv).trim()) return { ok: false };
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
    !hostnameAllowed(result.hostname, allowCsv)
  ) {
    return { ok: false };
  }
  return { ok: true };
}

function htmlPage(ok, msg) {
  const title = ok ? "Check your inbox" : "Not quite";
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

  // Honeypot: bots that fill the hidden field get a fake success and never reach beehiiv / Turnstile.
  if (website) {
    const out = { ok: true };
    if (!isForm) return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    return new Response(htmlPage(true, "Thanks, you're on the list. Watch your inbox for our predictions and results twice a week."), {
      status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const turned = await verifyTurnstile(env, token, ip);
  if (!turned.ok) {
    const out = { ok: false, error: TURNSTILE_ERR };
    if (!isForm) return new Response(JSON.stringify(out), { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    return new Response(htmlPage(false, TURNSTILE_ERR), {
      status: 403, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  let res, out;
  try {
    res = await fetch(env.SUBSCRIBE_URL || TARGET, {
      method: "POST",
      headers: { "content-type": "application/json", "x-client-ip": ip },
      body: JSON.stringify({ email, website: "", source: String(body.source ?? "") }),
    });
    out = await res.json();
  } catch {
    res = { status: 502 };
    out = { ok: false, error: "Something went wrong. Please try again." };
  }

  if (out.ok) {
    if (!env.BEEHIIV_API_KEY || !env.BEEHIIV_PUBLICATION_ID) {
      // Preview without beehiiv still shows the confirm UX so the form copy can be checked.
      out = { ...out, mode: "preview", pending_confirm: true, message: CONFIRM_MSG };
    } else {
      try {
        const b = await fetch(`${BEEHIIV}/${env.BEEHIIV_PUBLICATION_ID}/subscriptions`, {
          method: "POST",
          headers: { authorization: `Bearer ${env.BEEHIIV_API_KEY}`, "content-type": "application/json" },
          body: JSON.stringify({
            email,
            reactivate_existing: true,
            send_welcome_email: false,
            double_opt_override: "on",
            utm_source: "probalabsports",
            utm_medium: "website",
          }),
        });
        if (b.ok) {
          out = { ...out, mode: "beehiiv", pending_confirm: true, message: CONFIRM_MSG };
        } else {
          out = { ...out, mode: "backup-only", pending_confirm: true, message: CONFIRM_MSG };
          console.log("beehiiv subscribe failed", b.status);
        }
      } catch {
        out = { ...out, mode: "backup-only", pending_confirm: true, message: CONFIRM_MSG };
        console.log("beehiiv subscribe error");
      }
    }
  }

  if (!isForm) {
    return new Response(JSON.stringify(out), {
      status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  const msg = out.ok
    ? (out.message || CONFIRM_MSG)
    : (out.error || "Something went wrong.");
  return new Response(htmlPage(!!out.ok, msg), {
    status: out.ok ? 200 : res.status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
