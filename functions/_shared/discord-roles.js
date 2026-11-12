// ProbaLab Members -> Discord "Premium" role, via the Discord REST API (no always-on bot).
// Members link their Discord account with OAuth2 "identify"; the Stripe webhook then adds or
// removes the role with the "ProbaLab Members" bot token.
//
// Off unless every setting below is present AND DISCORD_ROLE_SYNC is "on", so production
// does nothing until these are set in that environment:
//   DISCORD_BOT_TOKEN (secret), DISCORD_CLIENT_SECRET (secret),
//   DISCORD_CLIENT_ID, DISCORD_GUILD_ID, DISCORD_PREMIUM_ROLE_ID, DISCORD_ROLE_SYNC=on
// Never log or return token or secret values.
import { normalizeEmail, isValidEmail, supabaseAdmin, hexFromBuffer, timingSafeEqual } from "./membership.js";

const API = "https://discord.com/api/v10";
const SNOWFLAKE = /^\d{15,22}$/;
export const STATE_COOKIE = "pl_discord_state";
export const STATE_TTL_SEC = 600;
const AUDIT_REASON = "ProbaLab Members subscription";

export function discordConfig(env) {
  const e = env || {};
  return {
    botToken: String(e.DISCORD_BOT_TOKEN || ""),
    clientId: String(e.DISCORD_CLIENT_ID || "").trim(),
    clientSecret: String(e.DISCORD_CLIENT_SECRET || ""),
    guildId: String(e.DISCORD_GUILD_ID || "").trim(),
    roleId: String(e.DISCORD_PREMIUM_ROLE_ID || "").trim(),
    enabled: String(e.DISCORD_ROLE_SYNC || "").trim().toLowerCase() === "on",
  };
}

export function discordRoleSyncEnabled(env) {
  const c = discordConfig(env);
  return c.enabled && !!c.botToken && !!c.clientSecret
    && SNOWFLAKE.test(c.clientId) && SNOWFLAKE.test(c.guildId) && SNOWFLAKE.test(c.roleId);
}

// Exact URL registered under OAuth2 > Redirects. Same host the member started on, unless overridden.
export function redirectUri(request, env) {
  const fromEnv = String((env && env.DISCORD_REDIRECT_URI) || "").trim();
  if (fromEnv) return fromEnv;
  return `${new URL(request.url).origin}/api/discord/callback`;
}

// ---- OAuth state: HMAC-signed {email, nonce, expiry}, nonce also held in an HttpOnly cookie ----

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function hmacHex(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hexFromBuffer(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
function stateSecret(env) {
  // Separate purpose string so the state signature can never be confused with anything Discord sees.
  return `probalab-discord-state:${discordConfig(env).clientSecret}`;
}

export async function makeState(env, email, nowMs = Date.now()) {
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = b64url(nonceBytes);
  const body = b64url(new TextEncoder().encode(JSON.stringify({
    e: normalizeEmail(email), n: nonce, x: Math.floor(nowMs / 1000) + STATE_TTL_SEC,
  })));
  const sig = await hmacHex(stateSecret(env), body);
  return { state: `${body}.${sig}`, nonce };
}

export async function readState(env, state, cookieNonce, nowMs = Date.now()) {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) throw new Error("bad state");
  if (!timingSafeEqual(await hmacHex(stateSecret(env), body), sig)) throw new Error("bad state signature");
  let data;
  try { data = JSON.parse(new TextDecoder().decode(b64urlDecode(body))); } catch { throw new Error("bad state"); }
  if (!data || !isValidEmail(data.e) || !data.n) throw new Error("bad state");
  if (Number(data.x) < Math.floor(nowMs / 1000)) throw new Error("state expired");
  if (!cookieNonce || !timingSafeEqual(String(cookieNonce), String(data.n))) throw new Error("state cookie mismatch");
  return { email: normalizeEmail(data.e) };
}

export function stateCookie(nonce, maxAge = STATE_TTL_SEC) {
  return `${STATE_COOKIE}=${nonce}; Path=/api/discord; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
export function readCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

export function authorizeUrl(env, request, state) {
  const c = discordConfig(env);
  const q = new URLSearchParams({
    response_type: "code",
    client_id: c.clientId,
    scope: "identify",
    redirect_uri: redirectUri(request, env),
    state,
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${q}`;
}

// ---- Discord API ----

async function discordFetch(env, method, path, init = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${API}${path}`, { method, ...init });
    if (res.status === 429 && attempt === 0) {
      let wait = 1;
      try { wait = Number((await res.json()).retry_after) || 1; } catch (_) { /* default */ }
      await new Promise((r) => setTimeout(r, Math.min(wait, 5) * 1000));
      continue;
    }
    return res;
  }
  throw new Error("discord rate limited");
}

export async function exchangeCode(env, request, code) {
  const c = discordConfig(env);
  const res = await discordFetch(env, "POST", "/oauth2/token", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: String(code || ""),
      redirect_uri: redirectUri(request, env),
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`discord token exchange ${res.status}`);
  const tok = await res.json();
  const me = await discordFetch(env, "GET", "/users/@me", {
    headers: { authorization: `Bearer ${tok.access_token}` },
  });
  if (!me.ok) throw new Error(`discord identify ${me.status}`);
  const user = await me.json();
  if (!user || !SNOWFLAKE.test(String(user.id))) throw new Error("discord identify: no user id");
  return { id: String(user.id), username: String(user.global_name || user.username || "").slice(0, 64) };
}

// Add or remove the Premium role. Result state: granted | removed | not_in_guild | error.
export async function setPremiumRole(env, discordUserId, grant) {
  const c = discordConfig(env);
  if (!SNOWFLAKE.test(String(discordUserId))) return { state: "error", error: "bad discord id" };
  const res = await discordFetch(env, grant ? "PUT" : "DELETE",
    `/guilds/${c.guildId}/members/${discordUserId}/roles/${c.roleId}`, {
      headers: { authorization: `Bot ${c.botToken}`, "x-audit-log-reason": AUDIT_REASON },
    });
  if (res.status === 204 || res.ok) return { state: grant ? "granted" : "removed" };
  let code = 0;
  try { code = Number((await res.json()).code) || 0; } catch (_) { /* no body */ }
  if (res.status === 404 && code === 10007) return { state: grant ? "not_in_guild" : "removed" };
  return { state: "error", error: `discord ${res.status}${code ? ` code ${code}` : ""}` };
}

// ---- Link storage (Supabase public.member_discord_links, service role only) ----

export async function getLinkByEmail(env, email) {
  const rows = await supabaseAdmin(env, "GET",
    `/rest/v1/member_discord_links?select=*&email=eq.${encodeURIComponent(normalizeEmail(email))}`);
  return (Array.isArray(rows) && rows[0]) || null;
}

async function recordRoleState(env, email, result) {
  await supabaseAdmin(env, "PATCH",
    `/rest/v1/member_discord_links?email=eq.${encodeURIComponent(normalizeEmail(email))}`,
    { role_state: result.state, role_synced_at: new Date().toISOString(), last_error: result.error || null },
    { prefer: "return=minimal" });
}

export async function isActiveMember(env, email) {
  const rows = await supabaseAdmin(env, "GET",
    `/rest/v1/member_allowlist?select=role&email=ilike.${encodeURIComponent(normalizeEmail(email))}`);
  return Array.isArray(rows) && rows.length > 0;
}

// Save a link. One Discord account maps to one membership email: re-linking moves it.
// If this email was linked to a different Discord account, that account loses the role.
export async function saveLink(env, email, discordUser) {
  const e = normalizeEmail(email);
  const previous = await getLinkByEmail(env, e);
  if (previous && previous.discord_user_id !== discordUser.id) {
    await setPremiumRole(env, previous.discord_user_id, false);
  }
  await supabaseAdmin(env, "DELETE",
    `/rest/v1/member_discord_links?discord_user_id=eq.${encodeURIComponent(discordUser.id)}&email=neq.${encodeURIComponent(e)}`);
  await supabaseAdmin(env, "POST", "/rest/v1/member_discord_links?on_conflict=email",
    { email: e, discord_user_id: discordUser.id, discord_username: discordUser.username || null,
      linked_at: new Date().toISOString(), role_state: null, role_synced_at: null, last_error: null },
    { prefer: "resolution=merge-duplicates,return=minimal" });
}

export async function deleteLink(env, email) {
  await supabaseAdmin(env, "DELETE",
    `/rest/v1/member_discord_links?email=eq.${encodeURIComponent(normalizeEmail(email))}`);
}

// Called from the Stripe webhook and the members page. Never throws: a Discord or storage
// failure must not break member access, the welcome email, or the webhook response.
export async function syncDiscordRoleForEmail(env, email, grant) {
  try {
    if (!discordRoleSyncEnabled(env)) return { skipped: "disabled" };
    const link = await getLinkByEmail(env, email);
    if (!link) return { skipped: "not-linked" };
    const result = await setPremiumRole(env, link.discord_user_id, !!grant);
    await recordRoleState(env, email, result);
    if (result.state === "error") console.log("discord role sync failed", result.error);
    return result;
  } catch (err) {
    console.log("discord role sync failed", err && err.message);
    return { state: "error", error: "sync failed" };
  }
}
