import { readFileSync } from "node:fs";
import {
  discordRoleSyncEnabled, makeState, readState, setPremiumRole, syncDiscordRoleForEmail,
  redirectUri, authorizeUrl, stateCookie, readCookie,
} from "../functions/_shared/discord-roles.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }
async function rejects(p, msg) { try { await p; } catch { return; } throw new Error(msg); }

const BOT = "test-bot-token-not-real";
const ENV = {
  DISCORD_BOT_TOKEN: BOT,
  DISCORD_CLIENT_SECRET: "test-client-secret-not-real",
  DISCORD_CLIENT_ID: "111111111111111111",
  DISCORD_GUILD_ID: "222222222222222222",
  DISCORD_PREMIUM_ROLE_ID: "333333333333333333",
  DISCORD_ROLE_SYNC: "on",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
};
const USER = "444444444444444444";

// ---- enable gate ----
assert(discordRoleSyncEnabled(ENV), "enabled with full config");
assert(!discordRoleSyncEnabled({ ...ENV, DISCORD_ROLE_SYNC: "" }), "off without DISCORD_ROLE_SYNC=on");
assert(!discordRoleSyncEnabled({ ...ENV, DISCORD_ROLE_SYNC: "off" }), "off when set to off");
assert(!discordRoleSyncEnabled({ ...ENV, DISCORD_BOT_TOKEN: "" }), "off without bot token");
assert(!discordRoleSyncEnabled({ ...ENV, DISCORD_PREMIUM_ROLE_ID: "Premium" }), "role must be an id, not a name");
assert(!discordRoleSyncEnabled({}), "off with nothing set (production default)");

// ---- OAuth state ----
const t0 = Date.UTC(2026, 10, 13, 0, 0, 0);
const { state, nonce } = await makeState(ENV, " Member@Example.com ", t0);
const ok = await readState(ENV, state, nonce, t0 + 60_000);
assert(ok.email === "member@example.com", "state round-trips normalised email");
await rejects(readState(ENV, state, "other-nonce", t0), "cookie mismatch rejected");
await rejects(readState(ENV, state, "", t0), "missing cookie rejected");
await rejects(readState(ENV, state, nonce, t0 + 11 * 60_000), "expired state rejected");
await rejects(readState({ ...ENV, DISCORD_CLIENT_SECRET: "different" }, state, nonce, t0), "wrong key rejected");
const [body, sig] = state.split(".");
const forged = Buffer.from(JSON.stringify({ e: "attacker@example.com", n: nonce, x: 9e9 })).toString("base64url");
await rejects(readState(ENV, `${forged}.${sig}`, nonce, t0), "forged body rejected");
await rejects(readState(ENV, `${body}.${"0".repeat(64)}`, nonce, t0), "forged signature rejected");

const cookie = stateCookie(nonce);
assert(/HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=Lax/.test(cookie) && /Path=\/api\/discord/.test(cookie), "state cookie flags");
const req = new Request("https://preview-discord-role.probalab-site.pages.dev/api/discord/link", { headers: { cookie: `a=1; pl_discord_state=${nonce}` } });
assert(readCookie(req, "pl_discord_state") === nonce, "reads state cookie");
assert(redirectUri(req, ENV) === "https://preview-discord-role.probalab-site.pages.dev/api/discord/callback", "default redirect uses request origin");
assert(redirectUri(req, { ...ENV, DISCORD_REDIRECT_URI: "https://x.test/cb" }) === "https://x.test/cb", "redirect override");
const au = new URL(authorizeUrl(ENV, req, state));
assert(au.origin === "https://discord.com" && au.searchParams.get("scope") === "identify", "identify scope only");
assert(au.searchParams.get("client_id") === ENV.DISCORD_CLIENT_ID && au.searchParams.get("state") === state, "authorize params");
assert(!au.toString().includes(ENV.DISCORD_CLIENT_SECRET), "client secret never in authorize URL");

// ---- Discord REST calls (mocked fetch) ----
let calls = [];
function mockFetch(handler) {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const call = { url: String(url), method: init.method || "GET", headers: init.headers || {}, body: init.body };
    calls.push(call);
    return handler(call);
  };
}
const res = (status, obj) => new Response(obj == null ? null : JSON.stringify(obj), { status });
const rolePath = `/guilds/${ENV.DISCORD_GUILD_ID}/members/${USER}/roles/${ENV.DISCORD_PREMIUM_ROLE_ID}`;

mockFetch(() => res(204));
let r = await setPremiumRole(ENV, USER, true);
assert(r.state === "granted", "204 grant");
assert(calls[0].method === "PUT" && calls[0].url === `https://discord.com/api/v10${rolePath}`, "PUT role endpoint");
assert(calls[0].headers.authorization === `Bot ${BOT}`, "bot auth header");

mockFetch(() => res(204));
r = await setPremiumRole(ENV, USER, false);
assert(r.state === "removed" && calls[0].method === "DELETE", "DELETE on revoke");

mockFetch(() => res(404, { code: 10007, message: "Unknown Member" }));
assert((await setPremiumRole(ENV, USER, true)).state === "not_in_guild", "unknown member on grant");
assert((await setPremiumRole(ENV, USER, false)).state === "removed", "unknown member on revoke is fine");

mockFetch(() => res(403, { code: 50013, message: "Missing Permissions" }));
r = await setPremiumRole(ENV, USER, true);
assert(r.state === "error" && r.error === "discord 403 code 50013", "permission error reported without secrets");
assert(!JSON.stringify(r).includes(BOT), "no token in result");

mockFetch(() => res(204));
assert((await setPremiumRole(ENV, "not-an-id", true)).state === "error" && calls.length === 0, "bad id never calls Discord");

// ---- syncDiscordRoleForEmail (what the webhook calls) ----
mockFetch(() => res(204));
r = await syncDiscordRoleForEmail({}, "member@example.com", true);
assert(r.skipped === "disabled" && calls.length === 0, "disabled: no network calls at all");

mockFetch((c) => c.url.includes("member_discord_links") ? res(200, []) : res(204));
r = await syncDiscordRoleForEmail(ENV, "member@example.com", true);
assert(r.skipped === "not-linked" && !calls.some((c) => c.url.includes("discord.com")), "not linked: no Discord call");

mockFetch((c) => {
  if (c.url.includes("member_discord_links") && c.method === "GET") return res(200, [{ email: "member@example.com", discord_user_id: USER }]);
  if (c.url.includes("member_discord_links") && c.method === "PATCH") return res(204);
  return res(204);
});
r = await syncDiscordRoleForEmail(ENV, "Member@Example.com", false);
assert(r.state === "removed", "linked: role removed on revoke");
assert(calls.some((c) => c.method === "DELETE" && c.url.endsWith(rolePath)), "DELETE sent");
const patch = calls.find((c) => c.method === "PATCH");
assert(patch && JSON.parse(patch.body).role_state === "removed", "role_state recorded");
assert(calls[0].url.includes("email=eq.member%40example.com"), "lookup uses normalised email");

mockFetch(() => { throw new Error("network down"); });
r = await syncDiscordRoleForEmail(ENV, "member@example.com", true);
assert(r.state === "error", "never throws into the webhook");

// ---- source checks ----
const webhook = readFileSync(new URL("../functions/api/stripe-webhook.js", import.meta.url), "utf8");
assert(webhook.includes("syncDiscordRoleForEmail(env, email, true)"), "checkout grants role");
assert(webhook.includes("syncDiscordRoleForEmail(env, email, grant)"), "subscription changes sync role");
assert(!webhook.includes("DISCORD_WEBHOOK"), "no Discord webhook URLs in Stripe webhook");
for (const f of ["../functions/_shared/discord-roles.js", "../functions/api/discord/link.js", "../functions/api/discord/callback.js"]) {
  const src = readFileSync(new URL(f, import.meta.url), "utf8");
  for (const line of src.split("\n").filter((l) => l.includes("console.log"))) {
    assert(!/botToken|clientSecret|BOT_TOKEN|CLIENT_SECRET|access_token/.test(line), `no secrets logged in ${f}`);
  }
}

console.log("discord-roles tests passed");
