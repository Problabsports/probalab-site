// GET /api/discord/callback — Discord OAuth2 ("identify") redirect target.
// Verifies the signed state against the HttpOnly cookie, saves the link, adds the Premium role
// if the membership is active, then sends the member back to /members/discord with a status.
import {
  STATE_COOKIE, discordRoleSyncEnabled, exchangeCode, isActiveMember, readCookie, readState,
  saveLink, stateCookie, syncDiscordRoleForEmail,
} from "../../_shared/discord-roles.js";

function back(request, status) {
  const to = new URL(`/members/discord?status=${encodeURIComponent(status)}`, request.url);
  return new Response(null, {
    status: 302,
    headers: { location: to.toString(), "cache-control": "no-store", "set-cookie": stateCookie("", 0) },
  });
}

export async function onRequestGet(ctx) {
  const env = ctx.env || {};
  const request = ctx.request;
  if (!discordRoleSyncEnabled(env)) return back(request, "disabled");
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return back(request, "cancelled");

  let email;
  try {
    ({ email } = await readState(env, url.searchParams.get("state"), readCookie(request, STATE_COOKIE)));
  } catch (err) {
    console.log("discord callback state rejected", err && err.message);
    return back(request, "expired");
  }

  try {
    if (!(await isActiveMember(env, email))) return back(request, "inactive");
    const discordUser = await exchangeCode(env, request, url.searchParams.get("code"));
    await saveLink(env, email, discordUser);
    const result = await syncDiscordRoleForEmail(env, email, true);
    return back(request, result.state === "granted" ? "linked" : (result.state || "error"));
  } catch (err) {
    console.log("discord callback failed", err && err.message);
    return back(request, "error");
  }
}
