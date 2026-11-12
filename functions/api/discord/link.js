// POST /api/discord/link — signed-in member's Discord link actions.
// Body: { action: "status" | "start" | "sync" | "unlink" }. Requires the member's Supabase
// access token as "Authorization: Bearer ...". Never trusts an email from the body.
import { jsonResponse, isValidEmail, normalizeEmail, SUPABASE_URL } from "../../_shared/membership.js";
import {
  authorizeUrl, deleteLink, discordRoleSyncEnabled, getLinkByEmail, isActiveMember,
  makeState, setPremiumRole, stateCookie, syncDiscordRoleForEmail,
} from "../../_shared/discord-roles.js";

const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";

async function signedInEmail(request, env) {
  const m = (request.headers.get("authorization") || "").match(/^Bearer\s+(\S+)/i);
  if (!m) return "";
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: String(env.SUPABASE_ANON_KEY || SUPABASE_ANON), authorization: `Bearer ${m[1]}` },
  });
  if (!res.ok) return "";
  const user = await res.json();
  const email = normalizeEmail(user && user.email);
  return isValidEmail(email) ? email : "";
}

function publicLink(link) {
  if (!link) return null;
  return {
    discord_username: link.discord_username || null,
    role_state: link.role_state || null,
    role_synced_at: link.role_synced_at || null,
  };
}

export async function onRequestPost(ctx) {
  const env = ctx.env || {};
  if (!discordRoleSyncEnabled(env)) {
    return jsonResponse({ ok: false, enabled: false, error: "Discord linking is not switched on yet." }, 503);
  }
  const email = await signedInEmail(ctx.request, env);
  if (!email) return jsonResponse({ ok: false, error: "Please sign in first." }, 401);
  let body = {};
  try { body = await ctx.request.json(); } catch { body = {}; }
  const action = String(body.action || "status");

  try {
    const active = await isActiveMember(env, email);
    if (action === "status") {
      return jsonResponse({ ok: true, enabled: true, email, active, link: publicLink(await getLinkByEmail(env, email)) });
    }
    if (action === "start") {
      if (!active) return jsonResponse({ ok: false, error: "Linking Discord needs an active membership." }, 403);
      const { state, nonce } = await makeState(env, email);
      return jsonResponse({ ok: true, url: authorizeUrl(env, ctx.request, state) }, 200, { "set-cookie": stateCookie(nonce) });
    }
    if (action === "sync") {
      const link = await getLinkByEmail(env, email);
      if (!link) return jsonResponse({ ok: false, error: "Link your Discord account first." }, 400);
      const result = await syncDiscordRoleForEmail(env, email, active);
      return jsonResponse({ ok: result.state !== "error", active, link: publicLink(await getLinkByEmail(env, email)) });
    }
    if (action === "unlink") {
      const link = await getLinkByEmail(env, email);
      if (link) {
        await setPremiumRole(env, link.discord_user_id, false);
        await deleteLink(env, email);
      }
      return jsonResponse({ ok: true, active, link: null });
    }
    return jsonResponse({ ok: false, error: "Unknown action." }, 400);
  } catch (err) {
    console.log("discord link failed", action, err && err.message);
    return jsonResponse({ ok: false, error: "Something went wrong. Please try again." }, 502);
  }
}

export async function onRequestGet() {
  return jsonResponse({ ok: false, error: "Use POST" }, 405);
}
