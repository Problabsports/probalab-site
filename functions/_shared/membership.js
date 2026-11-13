// ProbaLab Members paid checkout helpers.
// Founding prices are offered only to the first FOUNDING_CAP successful founding subscriptions.
// Do not log or return secret values.

export const STRIPE_API_VERSION = "2026-09-30.endive";
export const PRODUCT_ID = "prod_VbLDaEEprs0Cel";
export const FOUNDING_CAP = 10;
export const OWNER_EMAILS = ["jwcobley@gmail.com"];
export const WELCOME_TEST_EMAIL = "jwcobley@gmail.com";
export const FROM_EMAIL = "ProbaLab Sports <hello@probalabsports.com>";
export const DISCORD_INVITE = "https://discord.gg/KPZ2BdfHuU";
export const DISCORD_LINK_URL = "https://probalabsports.com/members/discord";
export const LOGO_URL = "https://probalabsports.com/icon-192.png";
export const SUPABASE_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";

export const PRICES = {
  pl_founding_monthly: {
    id: "price_1Ua8YXJefFXwpgSuU20CcfKA",
    lookup_key: "pl_founding_monthly",
    tier: "founding",
    interval: "month",
    unit_amount: 2400,
    currency: "usd",
    label: "US$24/month",
  },
  pl_founding_yearly: {
    id: "price_1Ua8YZJefFXwpgSumM9wvLls",
    lookup_key: "pl_founding_yearly",
    tier: "founding",
    interval: "year",
    unit_amount: 24000,
    currency: "usd",
    label: "US$240/year",
  },
  pl_standard_monthly: {
    id: "price_1Ua8YbJefFXwpgSud9VkpB6Q",
    lookup_key: "pl_standard_monthly",
    tier: "standard",
    interval: "month",
    unit_amount: 3900,
    currency: "usd",
    label: "US$39/month",
  },
  pl_standard_yearly: {
    id: "price_1Ua8YdJefFXwpgSu7J58Ybn6",
    lookup_key: "pl_standard_yearly",
    tier: "standard",
    interval: "year",
    unit_amount: 39000,
    currency: "usd",
    label: "US$390/year",
  },
};

export const FOUNDING_PRICE_IDS = Object.values(PRICES)
  .filter((p) => p.tier === "founding")
  .map((p) => p.id);

export const PRICE_BY_ID = Object.fromEntries(Object.values(PRICES).map((p) => [p.id, p]));

const INCOMPLETE = new Set(["incomplete", "incomplete_expired"]);
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due", "paused"]);

export function isOwnerEmail(email) {
  return OWNER_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export function isProtectedRole(role) {
  const r = String(role || "").trim().toLowerCase();
  return r === "owner" || r === "admin";
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  const e = normalizeEmail(email);
  return e.length > 3 && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function countsTowardFoundingCap(subscription) {
  if (!subscription) return false;
  const status = String(subscription.status || "");
  if (INCOMPLETE.has(status)) return false;
  const items = (subscription.items && subscription.items.data) || subscription.items || [];
  const ids = items.map((it) => (it.price && (it.price.id || it.price)) || it.price_id || it).filter(Boolean);
  const lookups = items.map((it) => (it.price && it.price.lookup_key) || it.lookup_key).filter(Boolean);
  if (ids.some((id) => FOUNDING_PRICE_IDS.includes(id))) return true;
  if (lookups.some((k) => k === "pl_founding_monthly" || k === "pl_founding_yearly")) return true;
  const meta = subscription.metadata || {};
  return meta.tier === "founding" || meta.plan === "founding";
}

export function foundingSlotsRemaining(used, cap = FOUNDING_CAP) {
  const n = Number(used) || 0;
  return Math.max(0, cap - n);
}

export function offerFromUsedCount(used, cap = FOUNDING_CAP) {
  const foundingOpen = foundingSlotsRemaining(used, cap) > 0;
  const tier = foundingOpen ? "founding" : "standard";
  const monthly = PRICES[foundingOpen ? "pl_founding_monthly" : "pl_standard_monthly"];
  const yearly = PRICES[foundingOpen ? "pl_founding_yearly" : "pl_standard_yearly"];
  return {
    tier,
    foundingOpen,
    foundingUsed: Number(used) || 0,
    foundingCap: cap,
    foundingRemaining: foundingSlotsRemaining(used, cap),
    monthly,
    yearly,
  };
}

export function priceForInterval(offer, interval) {
  const iv = interval === "year" || interval === "yearly" ? "year" : "month";
  return iv === "year" ? offer.yearly : offer.monthly;
}

export function isSubscriptionAccessActive(status) {
  return ACTIVE_STATUSES.has(String(status || ""));
}

export function publicOrigin(request, env) {
  const fromEnv = String((env && env.MEMBERSHIP_PUBLIC_URL) || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  try {
    const u = new URL(request.url);
    if (u.hostname && u.hostname !== "localhost") return u.origin;
  } catch (_) { /* fall through */ }
  return "https://probalabsports.com";
}

export function isPreviewHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h.endsWith(".pages.dev") || h === "localhost" || h === "127.0.0.1";
}

export function isProductionHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "probalabsports.com" || h === "www.probalabsports.com";
}

export function shouldSendWelcomeTo(email, hostname, env) {
  const to = normalizeEmail(email);
  if (!isValidEmail(to)) return false;
  const mode = String((env && env.WELCOME_EMAIL_MODE) || "").toLowerCase();
  if (mode === "test" || isPreviewHost(hostname) || !isProductionHost(hostname)) {
    return to === WELCOME_TEST_EMAIL;
  }
  return true;
}

export function randomSuffix(n = 8) {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => letters[b % letters.length]).join("");
}

export function jsonResponse(body, status = 200, extraHeaders) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  return new Response(JSON.stringify(body), { status, headers });
}

export function stripeKey(env) {
  return String((env && (env.STRIPE_RESTRICTED_KEY || env.STRIPE_SECRET_KEY)) || "");
}

export async function stripeRequest(env, method, path, params, { idempotencyKey } = {}) {
  const key = stripeKey(env);
  if (!key) throw new Error("missing Stripe key");
  const url = path.startsWith("http") ? path : `https://api.stripe.com/v1${path}`;
  const headers = {
    authorization: `Bearer ${key}`,
    "stripe-version": STRIPE_API_VERSION,
  };
  let body;
  if (params && method !== "GET") {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = encodeStripeParams(params);
  }
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  const getUrl = method === "GET" && params ? `${url}?${encodeStripeParams(params)}` : url;
  const res = await fetch(getUrl, { method, headers, body });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Stripe ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.stripe = data && data.error;
    throw err;
  }
  return data;
}

// Encode nested objects/arrays the way Stripe's form API expects.
export function encodeStripeParams(params, prefix) {
  const parts = [];
  const add = (key, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => add(`${key}[${i}]`, v));
      return;
    }
    if (typeof value === "object") {
      Object.keys(value).forEach((k) => add(`${key}[${k}]`, value[k]));
      return;
    }
    if (typeof value === "boolean") {
      parts.push(`${encodeURIComponent(key)}=${value ? "true" : "false"}`);
      return;
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };
  if (prefix) add(prefix, params);
  else Object.keys(params || {}).forEach((k) => add(k, params[k]));
  return parts.join("&");
}

export async function countFoundingSubscriptions(env) {
  let used = 0;
  for (const priceId of FOUNDING_PRICE_IDS) {
    let startingAfter;
    for (let i = 0; i < 20; i++) {
      const params = { price: priceId, status: "all", limit: 100 };
      if (startingAfter) params.starting_after = startingAfter;
      const page = await stripeRequest(env, "GET", "/subscriptions", params);
      const rows = page.data || [];
      for (const sub of rows) {
        if (countsTowardFoundingCap(sub)) used += 1;
      }
      if (!page.has_more || !rows.length) break;
      startingAfter = rows[rows.length - 1].id;
    }
  }
  return used;
}

export async function currentOffer(env) {
  const used = await countFoundingSubscriptions(env);
  return offerFromUsedCount(used, FOUNDING_CAP);
}

export async function findCustomerByEmail(env, email) {
  const q = `email:'${normalizeEmail(email).replace(/'/g, "\\'")}'`;
  try {
    const found = await stripeRequest(env, "GET", "/customers/search", { query: q, limit: 5 });
    const rows = found.data || [];
    return rows[0] || null;
  } catch (_) {
    const listed = await stripeRequest(env, "GET", "/customers", { email: normalizeEmail(email), limit: 5 });
    return (listed.data || [])[0] || null;
  }
}

export function nextMemberRole(existingRole, grant) {
  if (isProtectedRole(existingRole)) return String(existingRole).trim().toLowerCase();
  if (grant) return "member";
  return null;
}

export function fillWelcomeEmail({ price, portalLink, founding = true }) {
  const priceLabel = price || (founding ? "US$24/month" : "US$39/month");
  const portal = portalLink || "https://probalabsports.com/members/billing";
  const membersUrl = "https://probalabsports.com/members";
  const resultsUrl = "https://probalabsports.com/results";
  const subject = "You're in! Welcome to ProbaLab Members 🎉";
  const headline = "You're now an official ProbaLab member 🎉";
  const opening = founding
    ? `You're one of the first 10 founding members, and your price of ${priceLabel} is locked for life. Your desks, tips and Discord are ready — here's how to get in.`
    : `Your membership is live, and your price is ${priceLabel}. Your desks, tips and Discord are ready — here's how to get in.`;
  const discordStepText = `One last step: get your Discord access 🔓

Join our Discord here: ${DISCORD_INVITE}

Then link your Discord account here: ${DISCORD_LINK_URL}

Sign in with the email you used to join and press Link Discord. You get the Premium role straight away, and the tip channels unlock.`;
  const text = `${headline}

${opening}

${discordStepText}

Here's how to get started:

1. Join the members Discord and link your account: ${DISCORD_LINK_URL}
   Start in #how-to. The pinned posts cover channels, alerts, lights, results, and billing.

2. Open the members desks: ${membersUrl}
   You will see John, ProbaLab, and Sniper. Sniper alerts are in #sniper-tips.

3. The members newsletter goes out Tuesday and Friday, and is also posted in #premium-news.

There are no guaranteed winners. Every pick, including losses, stays on the public record: ${resultsUrl}

Manage or cancel any time: ${portal}

John
ProbaLab Sports

18+. Gamble responsibly. If gambling is causing you harm, call Gambling Help on 1800 858 858 or visit gamblinghelponline.org.au.`;

  const btn = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" bgcolor="#19e3ff" style="background-color:#19e3ff;border-radius:2px;">
      <a href="${escapeAttr(href)}" style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;color:#07080f;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .email-bg, .email-card { background-color: #07080f !important; }
  .email-header { background-color: #10131f !important; }
  .email-ink { color: #e8ecf8 !important; }
  .email-muted { color: #8b93b0 !important; }
  .email-accent { color: #19e3ff !important; }
  .email-discord { background-color: #161a2a !important; }
  .email-bar { background-color: #19e3ff !important; }
  .email-btn { background-color: #19e3ff !important; color: #07080f !important; }
}
@media (prefers-color-scheme: light) {
  .email-bg, .email-card { background-color: #07080f !important; }
  .email-header { background-color: #10131f !important; }
  .email-ink { color: #e8ecf8 !important; }
  .email-muted { color: #8b93b0 !important; }
  .email-accent { color: #19e3ff !important; }
  .email-discord { background-color: #161a2a !important; }
  .email-bar { background-color: #19e3ff !important; }
  .email-btn { background-color: #19e3ff !important; color: #07080f !important; }
}
</style>
</head>
<body class="email-bg" bgcolor="#07080f" style="margin:0;padding:0;background-color:#07080f;color:#e8ecf8;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ProbaLab Members access is ready.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-bg" bgcolor="#07080f" style="margin:0;padding:0;background-color:#07080f;width:100%;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-card" bgcolor="#07080f" style="width:100%;max-width:600px;background-color:#07080f;">
          <tr>
            <td class="email-header" bgcolor="#10131f" style="background-color:#10131f;padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:12px;">
                    <a href="https://probalabsports.com" style="text-decoration:none;">
                      <img src="${LOGO_URL}" width="48" height="48" alt="ProbaLab" style="display:block;border:0;width:48px;height:48px;">
                    </a>
                  </td>
                  <td valign="middle" class="email-ink" style="font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:24px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#e8ecf8;">
                    <a href="https://probalabsports.com" style="text-decoration:none;color:#e8ecf8;">Proba<span class="email-accent" style="color:#19e3ff;">Lab</span></a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#e8ecf8;">
              <p class="email-ink" style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#e8ecf8;">${escapeHtml(headline)}</p>
              <p class="email-ink" style="margin:0 0 20px;color:#e8ecf8;">${escapeHtml(opening)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="email-bar" width="4" bgcolor="#19e3ff" style="background-color:#19e3ff;width:4px;font-size:0;line-height:0;">&nbsp;</td>
                  <td class="email-discord" bgcolor="#161a2a" style="background-color:#161a2a;padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#e8ecf8;">
                    <p class="email-ink" style="margin:0 0 10px;font-weight:700;font-size:16px;color:#e8ecf8;">One last step: get your Discord access 🔓</p>
                    <p class="email-ink" style="margin:0 0 14px;color:#e8ecf8;">Join our Discord, then link your Discord account on the members site. Sign in with the email you used to join and press Link Discord. You get the Premium role straight away, and the tip channels unlock.</p>
                    ${btn(DISCORD_INVITE, "Join Discord")}
                    <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
                    ${btn(DISCORD_LINK_URL, "Link Discord")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#e8ecf8;">
              <p class="email-ink" style="margin:0 0 12px;font-weight:700;color:#e8ecf8;">Here's how to get started:</p>
              <p class="email-ink" style="margin:0 0 6px;color:#e8ecf8;">1. Join the members Discord and link your account. Start in #how-to. The pinned posts cover channels, alerts, lights, results, and billing.</p>
              <p class="email-ink" style="margin:0 0 16px;color:#e8ecf8;">2. Open the members desks. You will see John, ProbaLab, and Sniper. Sniper alerts are in #sniper-tips.</p>
              ${btn(membersUrl, "Open members desks")}
              <p class="email-ink" style="margin:16px 0 0;color:#e8ecf8;">3. The members newsletter goes out Tuesday and Friday, and is also posted in #premium-news.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#e8ecf8;">
              <p class="email-ink" style="margin:0 0 12px;color:#e8ecf8;">There are no guaranteed winners. Every pick, including losses, stays on the public record: <a class="email-accent" href="${resultsUrl}" style="color:#19e3ff;">${resultsUrl}</a></p>
              <p class="email-ink" style="margin:0 0 16px;color:#e8ecf8;">Manage or cancel any time: <a class="email-accent" href="${escapeAttr(portal)}" style="color:#19e3ff;">${escapeHtml(portal)}</a></p>
              <p class="email-ink" style="margin:0 0 16px;color:#e8ecf8;">John<br>ProbaLab Sports</p>
              <p class="email-muted" style="margin:0;font-size:13px;line-height:1.5;color:#8b93b0;">18+. Gamble responsibly. If gambling is causing you harm, call Gambling Help on 1800 858 858 or visit <a class="email-accent" href="https://www.gamblinghelponline.org.au" style="color:#19e3ff;">gamblinghelponline.org.au</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/`/g, "&#96;");
}

export async function verifyStripeSignature(payload, header, secret, toleranceSec = 300) {
  if (!secret) throw new Error("missing webhook secret");
  const raw = String(header || "");
  const items = {};
  raw.split(",").forEach((part) => {
    const i = part.indexOf("=");
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!items[k]) items[k] = [];
    items[k].push(v);
  });
  const timestamp = items.t && items.t[0];
  const v1s = items.v1 || [];
  if (!timestamp || !v1s.length) throw new Error("invalid stripe-signature");
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) throw new Error("invalid stripe-signature timestamp");
  const age = Math.abs(Date.now() / 1000 - ts);
  if (age > toleranceSec) throw new Error("stripe-signature expired");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const computed = hexFromBuffer(sigBuf);
  const ok = v1s.some((candidate) => timingSafeEqual(computed, candidate));
  if (!ok) throw new Error("stripe-signature mismatch");
  return true;
}

export function hexFromBuffer(buf) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a, b) {
  const left = String(a);
  const right = String(b);
  const len = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function supabaseAdmin(env, method, path, body, extraHeaders) {
  const service = String((env && env.SUPABASE_SERVICE_ROLE_KEY) || "");
  if (!service) throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
  const headers = {
    apikey: service,
    authorization: `Bearer ${service}`,
    "content-type": "application/json",
    ...extraHeaders,
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const msg = (data && data.message) || (data && data.error_description) || (data && data.msg) || text || `Supabase ${res.status}`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function readAllowlistRole(env, email) {
  const e = normalizeEmail(email);
  const rows = await supabaseAdmin(
    env,
    "GET",
    `/rest/v1/member_allowlist?select=email,role&email=ilike.${encodeURIComponent(e)}`,
  );
  return (Array.isArray(rows) && rows[0] && rows[0].role) || null;
}

export async function setMemberAccess(env, { email, grant }) {
  const e = normalizeEmail(email);
  if (!isValidEmail(e)) throw new Error("invalid email");
  const existing = await readAllowlistRole(env, e);
  if (!grant) {
    if (isProtectedRole(existing) || isOwnerEmail(e)) return { ok: true, skipped: "protected", role: existing };
    await supabaseAdmin(
      env,
      "DELETE",
      `/rest/v1/member_allowlist?email=ilike.${encodeURIComponent(e)}`,
    );
    return { ok: true, granted: false, email: e };
  }
  const role = nextMemberRole(existing, true);
  await supabaseAdmin(
    env,
    "POST",
    "/rest/v1/member_allowlist",
    { email: e, role },
    { prefer: "resolution=merge-duplicates,return=minimal" },
  );
  await ensureAuthUser(env, e);
  return { ok: true, granted: true, email: e, role };
}

export async function ensureAuthUser(env, email) {
  const e = normalizeEmail(email);
  const existing = await supabaseAdmin(env, "GET", `/auth/v1/admin/users?page=1&per_page=200`);
  const users = (existing && existing.users) || existing || [];
  let user = (Array.isArray(users) ? users : []).find((u) => normalizeEmail(u.email) === e);
  if (!user) {
    const created = await supabaseAdmin(env, "POST", "/auth/v1/admin/users", {
      email: e,
      email_confirm: true,
      user_metadata: { role: "member", source: "stripe_checkout" },
    });
    user = created && (created.user || created);
  } else if (!user.email_confirmed_at) {
    await supabaseAdmin(env, "PUT", `/auth/v1/admin/users/${user.id}`, { email_confirm: true });
  }
  return user;
}

export async function setAuthPassword(env, email, password) {
  if (!password || String(password).length < 12) throw new Error("password too short");
  const user = await ensureAuthUser(env, email);
  if (!user || !user.id) throw new Error("could not create sign-in");
  await supabaseAdmin(env, "PUT", `/auth/v1/admin/users/${user.id}`, {
    password,
    email_confirm: true,
  });
  return user;
}

export async function sendWelcomeEmail(env, { to, price, portalLink, founding, idempotencyKey, hostname }) {
  if (!shouldSendWelcomeTo(to, hostname, env)) {
    return { ok: true, skipped: "test-recipient-only" };
  }
  const apiKey = String((env && env.RESEND_API_KEY) || "");
  if (!apiKey) throw new Error("missing RESEND_API_KEY");
  const mail = fillWelcomeEmail({ price, portalLink, founding });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "idempotency-key": String(idempotencyKey).slice(0, 256) } : {}),
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [normalizeEmail(to)],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = (data.error && data.error.message) || data.message || `Resend ${res.status}`;
    throw new Error(msg);
  }
  return { ok: true, id: data.id };
}

export const DEFAULT_OWNER_SIGNUP_EMAIL = "jwcobley@gmail.com";

export function ownerSignupAddress(env) {
  const fromEnv = normalizeEmail((env && env.OWNER_SIGNUP_EMAIL) || "");
  return isValidEmail(fromEnv) ? fromEnv : DEFAULT_OWNER_SIGNUP_EMAIL;
}

export function shouldSendOwnerSignupEmail(hostname, env) {
  if (env && String(env.OWNER_SIGNUP_EMAIL_MODE || "").toLowerCase() === "off") return false;
  return isProductionHost(hostname);
}

export function formatAedtTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(d);
  return formatted.replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
}

export function describeMemberPlan(price, founding = false) {
  const tier = (price && price.tier) || (founding ? "founding" : "standard");
  const interval = (price && price.interval) === "year" ? "yearly" : "monthly";
  const label = (price && price.label) || (tier === "founding"
    ? (interval === "yearly" ? "US$240/year" : "US$24/month")
    : (interval === "yearly" ? "US$390/year" : "US$39/month"));
  const tierName = tier === "founding" ? "Founding" : "Standard";
  return `${tierName} ${interval} (${label})`;
}

export function fillOwnerSignupEmail({
  memberEmail,
  price,
  founding = false,
  signedUpAt,
  foundingRemaining,
  foundingCap = FOUNDING_CAP,
  test = false,
} = {}) {
  const email = normalizeEmail(memberEmail) || "(email missing)";
  const plan = describeMemberPlan(price, founding);
  const when = formatAedtTime(signedUpAt || new Date()) || "time unavailable";
  const cap = Number(foundingCap) || FOUNDING_CAP;
  const spots = (foundingRemaining == null || foundingRemaining === "")
    ? "could not be counted (cap is " + cap + ")"
    : `${Number(foundingRemaining)} of ${cap}`;
  const subjectCore = "Someone signed up as a ProbaLab member";
  const subject = test ? `[TEST] ${subjectCore}` : subjectCore;
  const text = [
    "Someone signed up as a ProbaLab member.",
    "",
    `Email: ${email}`,
    `Plan: ${plan}`,
    `Time: ${when}`,
    `Founding spots left: ${spots}`,
    "",
    "No Discord action needed: they link their account on the members Discord page and get the Premium role automatically.",
  ].join("\n");
  const html = `<p>Someone signed up as a ProbaLab member.</p>
<p>Email: ${escapeHtml(email)}<br>
Plan: ${escapeHtml(plan)}<br>
Time: ${escapeHtml(when)}<br>
Founding spots left: ${escapeHtml(String(spots))}</p>
<p>No Discord action needed: they link their account on the members Discord page and get the Premium role automatically.</p>`;
  return { subject, text, html };
}

export async function sendOwnerSignupEmail(env, {
  memberEmail,
  price,
  founding,
  signedUpAt,
  foundingRemaining,
  idempotencyKey,
  hostname,
  test = false,
} = {}) {
  if (!test && !shouldSendOwnerSignupEmail(hostname, env)) {
    return { ok: true, skipped: "production-only" };
  }
  const to = ownerSignupAddress(env);
  if (!isValidEmail(to)) return { ok: true, skipped: "no-owner-address" };
  const apiKey = String((env && env.RESEND_API_KEY) || "");
  if (!apiKey) throw new Error("missing RESEND_API_KEY");
  let remaining = foundingRemaining;
  if (remaining == null) {
    try {
      const offer = await currentOffer(env);
      remaining = offer.foundingRemaining;
    } catch (_) {
      remaining = null;
    }
  }
  const mail = fillOwnerSignupEmail({
    memberEmail,
    price,
    founding,
    signedUpAt,
    foundingRemaining: remaining,
    test,
  });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": String(idempotencyKey).slice(0, 256) } : {}),
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = (data.error && data.error.message) || data.message || `Resend ${res.status}`;
    throw new Error(msg);
  }
  return { ok: true, id: data.id };
}

// Never throws: a failure must not break member access or the welcome email.
export async function notifyOwnerOfSignup(env, details) {
  try {
    return await sendOwnerSignupEmail(env, details);
  } catch (err) {
    console.log("owner signup email failed", err && err.message);
    return { ok: false, error: (err && err.message) || "send failed" };
  }
}
