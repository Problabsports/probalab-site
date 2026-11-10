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
  const subject = "Welcome to ProbaLab Members";
  const opening = founding
    ? `Thanks for joining ProbaLab Members as a founding member. Your founding price of ${priceLabel} (US$24/month or US$240/year) stays locked for as long as you remain subscribed.`
    : `Thanks for joining ProbaLab Members. Your price is ${priceLabel}.`;
  const discordStepText = `One last step: get your Discord access 🔓

Join our Discord here: ${DISCORD_INVITE}

Then send a message in #how-to (or DM @teamjwc) with the email you used to join. We'll upgrade you to Member, usually within a few hours, and the tip channels will unlock.`;
  const text = `${opening}

${discordStepText}

Here's how to get started:

1. Join the members Discord: ${DISCORD_INVITE}
   Start in #how-to. The pinned posts cover channels, alerts, lights, results, and billing.

2. Open the members desks: https://probalabsports.com/members
   You will see John, ProbaLab, and Sniper. Sniper alerts are in #sniper-tips.

3. The members newsletter goes out Tuesday and Friday, and is also posted in #premium-news.

There are no guaranteed winners. Every pick, including losses, stays on the public record: https://probalabsports.com/results

Manage or cancel any time: ${portal}

John
ProbaLab Sports

18+. Gamble responsibly. If gambling is causing you harm, call Gambling Help on 1800 858 858 or visit gamblinghelponline.org.au.`;

  const html = `<p>${escapeHtml(opening)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="padding:16px 18px;border:1px solid #1a9bb8;border-left:4px solid #1a9bb8;background:#f3fbfd;">
      <p style="margin:0 0 10px;font-weight:700;font-size:16px;color:#0b1220;">One last step: get your Discord access 🔓</p>
      <p style="margin:0 0 10px;color:#0b1220;">Join our Discord here: <a href="${DISCORD_INVITE}" style="color:#0b6e84;">${DISCORD_INVITE}</a></p>
      <p style="margin:0;color:#0b1220;">Then send a message in #how-to (or DM @teamjwc) with the email you used to join. We'll upgrade you to Member, usually within a few hours, and the tip channels will unlock.</p>
    </td>
  </tr>
</table>
<p>Here's how to get started:</p>
<ol>
<li>Join the members Discord: <a href="${DISCORD_INVITE}">${DISCORD_INVITE}</a><br>
Start in #how-to. The pinned posts cover channels, alerts, lights, results, and billing.</li>
<li>Open the members desks: <a href="https://probalabsports.com/members">https://probalabsports.com/members</a><br>
You will see John, ProbaLab, and Sniper. Sniper alerts are in #sniper-tips.</li>
<li>The members newsletter goes out Tuesday and Friday, and is also posted in #premium-news.</li>
</ol>
<p>There are no guaranteed winners. Every pick, including losses, stays on the public record: <a href="https://probalabsports.com/results">https://probalabsports.com/results</a></p>
<p>Manage or cancel any time: <a href="${escapeAttr(portal)}">${escapeHtml(portal)}</a></p>
<p>John<br>ProbaLab Sports</p>
<p>18+. Gamble responsibly. If gambling is causing you harm, call Gambling Help on 1800 858 858 or visit <a href="https://www.gamblinghelponline.org.au">gamblinghelponline.org.au</a>.</p>`;
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
