import { readFileSync } from "node:fs";
import { onRequestPost, onRequestGet } from "../functions/api/discord/interactions.js";
import {
  verifyDiscordSignature, discordAskEnabled, discordAskConfig, planInteraction,
  extractQuestion, isPremiumMember, channelAllowed, guardrailMessage, sanitizeReply,
  fallbackAnswer, buildContextText, lightLabel, formatPct, consumeRateLimit,
  rateLimitMessage, mentionsHiddenDesk, ALLOWED_SNAPSHOT_IDS, hexToBytes,
  INTERACTION, RESPONSE, FLAG_EPHEMERAL, TAG_JOHN,
} from "../functions/_shared/discord-ask.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function memoryCache() {
  const map = new Map();
  return {
    async match(req) {
      const v = map.get(String(req.url));
      return v == null ? undefined : new Response(String(v));
    },
    async put(req, res) {
      map.set(String(req.url), await res.text());
    },
  };
}

const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const publicKeyHex = bytesToHex(new Uint8Array(await crypto.subtle.exportKey("raw", publicKey)));

async function sign(timestamp, raw) {
  const sig = await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(`${timestamp}${raw}`));
  return bytesToHex(new Uint8Array(sig));
}

const CHANNEL_CHAT = "555555555555555555";
const CHANNEL_Q = "666666666666666666";
const CHANNEL_OTHER = "777777777777777777";
const ROLE = "333333333333333333";
const USER = "444444444444444444";
const APP = "1570608256567476334";

const ENV = {
  DISCORD_ASK_ENABLED: "on",
  DISCORD_CHAT_APP_ID: APP,
  DISCORD_CHAT_PUBLIC_KEY: publicKeyHex,
  DISCORD_PREMIUM_ROLE_ID: ROLE,
  DISCORD_ASK_CHANNEL_IDS: `${CHANNEL_CHAT},${CHANNEL_Q}`,
};

assert(discordAskEnabled(ENV), "enabled with full config");
assert(!discordAskEnabled({ ...ENV, DISCORD_ASK_ENABLED: "" }), "off without DISCORD_ASK_ENABLED=on");
assert(!discordAskEnabled({ ...ENV, DISCORD_CHAT_PUBLIC_KEY: "" }), "off without public key");
assert(!discordAskEnabled({ ...ENV, DISCORD_CHAT_APP_ID: "not-an-id" }), "off with bad app id");
assert(discordAskConfig({}).channelIds.length === 0, "empty allowlist when unset");
assert(hexToBytes("afb11be3be9aa79e176f54d9da78cb76c758c46a20d88e234f1ee919fc604f53").length === 32, "John's public key is 32 bytes");

// ---- signatures ----
const ts = "1730000000";
const pingRaw = JSON.stringify({ type: 1 });
assert(await verifyDiscordSignature(publicKeyHex, await sign(ts, pingRaw), ts, pingRaw), "valid signature");
assert(!(await verifyDiscordSignature(publicKeyHex, await sign(ts, pingRaw), "0", pingRaw)), "wrong timestamp");
assert(!(await verifyDiscordSignature(publicKeyHex, "00".repeat(64), ts, pingRaw)), "wrong signature");
assert(!(await verifyDiscordSignature("ab", await sign(ts, pingRaw), ts, pingRaw)), "short public key rejected");
assert(!(await verifyDiscordSignature("", await sign(ts, pingRaw), ts, pingRaw)), "missing public key rejected");

async function signedRequest(raw, env = ENV, extraHeaders = {}) {
  const timestamp = "1730000001";
  const signature = await sign(timestamp, raw);
  return onRequestPost({
    env,
    request: new Request("https://preview-discord-ask.probalab-site.pages.dev/api/discord/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature-ed25519": signature,
        "x-signature-timestamp": timestamp,
        ...extraHeaders,
      },
      body: raw,
    }),
    waitUntil() {},
  });
}

const pingRes = await signedRequest(pingRaw);
assert(pingRes.status === 200 && (await pingRes.json()).type === RESPONSE.PONG, "PING returns PONG");

const bad = await onRequestPost({
  env: ENV,
  request: new Request("https://preview-discord-ask.probalab-site.pages.dev/api/discord/interactions", {
    method: "POST",
    headers: { "x-signature-ed25519": "00".repeat(64), "x-signature-timestamp": ts },
    body: pingRaw,
  }),
  waitUntil() {},
});
assert(bad.status === 401, "invalid signature is 401");
assert(!(await bad.text()).toLowerCase().includes("token"), "401 body has no secrets");

const getRes = await onRequestGet();
assert(getRes.status === 405, "GET is 405");

// ---- questions and roles ----
const slash = {
  type: INTERACTION.APPLICATION_COMMAND,
  guild_id: "999999999999999999",
  channel_id: CHANNEL_CHAT,
  application_id: APP,
  token: "interaction-token-not-real",
  member: { user: { id: USER }, roles: [ROLE] },
  data: { type: 1, name: "ask", options: [{ name: "question", type: 3, value: "What about the Blazers tonight?" }] },
};
assert(extractQuestion(slash) === "What about the Blazers tonight?", "slash question");
assert(isPremiumMember(slash, ROLE), "premium role present");
assert(!isPremiumMember({ ...slash, member: { user: { id: USER }, roles: [] } }, ROLE), "no role is not premium");
assert(channelAllowed(slash, [CHANNEL_CHAT, CHANNEL_Q]), "allowlisted channel");
assert(!channelAllowed({ ...slash, channel_id: CHANNEL_OTHER }, [CHANNEL_CHAT, CHANNEL_Q]), "other channel blocked");

const ctxMenu = {
  ...slash,
  data: {
    type: 3,
    name: "Ask ProbaLab",
    target_id: "888888888888888888",
    resolved: { messages: { "888888888888888888": { content: "why is Portland orange?" } } },
  },
};
assert(extractQuestion(ctxMenu) === "why is Portland orange?", "message command uses message text");
assert(extractQuestion({ data: { type: 3, name: "Ask ProbaLab", target_id: "1", resolved: { messages: { 1: { content: "" } } } } }) === "", "empty message");

// ---- planInteraction ----
const off = await planInteraction({ ...ENV, DISCORD_ASK_ENABLED: "off" }, slash, new Request("https://preview-discord-ask.probalab-site.pages.dev/x"));
assert(off.response.type === RESPONSE.CHANNEL_MESSAGE && off.response.data.flags === FLAG_EPHEMERAL, "disabled is ephemeral");
assert(/not switched on/.test(off.response.data.content), "disabled copy");
assert(!off.job, "disabled does not follow up");

const cache = memoryCache();
const blocked = await planInteraction(ENV, { ...slash, channel_id: CHANNEL_OTHER }, new Request("https://x.test/x"), { cache });
assert(/#general-chat and #questions/.test(blocked.response.data.content) && blocked.response.data.flags === FLAG_EPHEMERAL, "wrong channel");
assert(!blocked.job, "wrong channel has no follow-up");

const noList = await planInteraction({ ...ENV, DISCORD_ASK_CHANNEL_IDS: "" }, slash, new Request("https://x.test/x"), { cache });
assert(/allowlist is not set/.test(noList.response.data.content), "empty allowlist");

const planned = await planInteraction(ENV, slash, new Request("https://x.test/x"), { cache, nowMs: Date.UTC(2026, 10, 13, 1, 0, 0) });
assert(planned.response.type === RESPONSE.DEFERRED_CHANNEL_MESSAGE, "allowed /ask is deferred");
assert(planned.job && planned.job.question.includes("Blazers") && planned.job.premium === true, "job carries question and premium");
assert(planned.job.token === "interaction-token-not-real" && planned.job.appId === APP, "job has follow-up coordinates");

const freeUser = { ...slash, member: { user: { id: "111111111111111111" }, roles: [] } };
const freePlan = await planInteraction(ENV, freeUser, new Request("https://x.test/x"), { cache, nowMs: Date.UTC(2026, 10, 13, 1, 0, 0) });
assert(freePlan.job && freePlan.job.premium === false, "no premium role is not gated as premium");

// ---- rate limit (cache fallback, no Supabase table required) ----
const rlCache = memoryCache();
const t0 = Date.UTC(2026, 10, 13, 2, 10, 0);
for (let i = 0; i < 5; i++) {
  const r = await consumeRateLimit({}, USER, t0, rlCache);
  assert(r.ok, `hour hit ${i + 1} allowed`);
}
const sixth = await consumeRateLimit({}, USER, t0, rlCache);
assert(!sixth.ok && sixth.reason === "hour", "6th question in an hour is blocked");
assert(/five questions in an hour/.test(rateLimitMessage(sixth)), "hour cap copy");
const laterHour = await consumeRateLimit({}, USER, t0 + 60 * 60 * 1000, rlCache);
assert(laterHour.ok, "new hour resets the cap");

const dayCache = memoryCache();
const day0 = Date.UTC(2026, 10, 12, 13, 0, 0); // 13 Nov 2026 00:00 AEDT
let n = 0;
for (let h = 0; h < 6; h++) {
  for (let i = 0; i < 5; i++) {
    n += 1;
    const r = await consumeRateLimit({}, "121212121212121212", day0 + h * 60 * 60 * 1000 + i * 1000, dayCache);
    assert(r.ok, `day hit ${n} allowed`);
  }
}
const day31 = await consumeRateLimit({}, "121212121212121212", day0 + 6 * 60 * 60 * 1000, dayCache);
assert(!day31.ok && day31.reason === "day", "31st question in a Sydney day is blocked");
assert(/30 questions/.test(rateLimitMessage(day31)), "day cap copy");

// ---- lights, style, guardrails ----
assert(lightLabel("SUPER") === "Best value", "SUPER is Best value");
assert(lightLabel("GREEN") === "Green", "GREEN label");
assert(formatPct(0.64) === "64%" && formatPct(64) === "64%", "pct accepts fraction or percent");

assert(/can't place bets/i.test(guardrailMessage("can you place a bet on Betfair for me")), "no bet placing");
assert(/units/.test(guardrailMessage("how much should I stake $200")), "no dollar staking");
assert(/no guaranteed winners/i.test(guardrailMessage("is this a guaranteed winner lock it in")), "no guarantees");
assert(!guardrailMessage("What about the Blazers tonight?"), "on-topic question is allowed");

assert(mentionsHiddenDesk("what's the NBA Price Gap tip"), "hidden desk detected");
assert(mentionsHiddenDesk("nhl value tonight") && mentionsHiddenDesk("NFL Totals unders"), "all hidden desks detected");
assert(!mentionsHiddenDesk("What about the Blazers tonight?"), "normal question is not a hidden desk");
assert(!/NHL Value|NBA Price Gap|NFL Totals/i.test(sanitizeReply("see NHL Value and NBA Price Gap and NFL Totals")), "hidden desks stripped from replies");

const ctx = {
  upcoming: [{
    sport: "nba",
    match: "Portland Trail Blazers at Sacramento Kings",
    pick: "Portland Trail Blazers",
    pct: "64%",
    light: "Orange",
    lightRaw: "ORANGE",
    start: "Sat 14 Nov, 2:00 pm",
    start_utc: "2026-11-14T03:00:00Z",
  }],
  records: { green: { w: 40, n: 60, pct: 67 }, super: { w: 4, n: 6, pct: 67, label: "Super — best value" }, sports: [{ sport: "nba", name: "NBA", green: { w: 20, n: 28, pct: 71 } }] },
  desks: { latest: { label: "John", open: [{ desk: "John", sport: "NBA", game: "POR at SAC", selection: "Portland", pct: "64%", light: "Orange", units: "1u" }] } },
  howto: [],
};
const blazers = fallbackAnswer("What about the Blazers tonight?", ctx, { premium: false });
assert(/Our model has Portland Trail Blazers at 64%/.test(blazers), "Blazers-style lead with model %");
assert(/Orange/.test(blazers), "includes the light");
assert(!/guaranteed/.test(blazers.toLowerCase()) || /not a guaranteed/.test(blazers), "no touting a winner");
assert(blazers.split(/[.!?]/).filter(Boolean).length <= 8, "short reply");

const recordLine = fallbackAnswer("what's the green record?", ctx, { premium: false });
assert(/40 of 60/.test(recordLine) && /Best value/.test(recordLine), "green record plus Best value");

const hiddenQ = fallbackAnswer("what's the NBA Price Gap pick?", ctx, { premium: true });
assert(/isn't on the members page/.test(hiddenQ), "refuses hidden desks even for Premium");
assert(!/Price Gap pick is/.test(hiddenQ), "does not answer a hidden desk");

const join = fallbackAnswer("what's John's tip?", { ...ctx, desks: null }, { premium: false });
assert(/probalabsports.com\/join/.test(join) && /members\/discord/.test(join), "non-premium desk questions point to join");

const facts = buildContextText({
  ...ctx,
  desks: {
    latest: ctx.desks.latest,
    "nba-price-gap": { label: "NBA Price Gap", open: [{ game: "secret", selection: "hidden" }] },
  },
}, { premium: true, question: "Blazers" });
assert(/John/.test(facts) && /64%/.test(facts), "context includes public and John desk");
assert(!/NBA Price Gap|secret|hidden/.test(facts), "context builder ignores unknown/hidden desk ids");
assert(ALLOWED_SNAPSHOT_IDS.join(" ") === "latest probalab sniper", "only allowed snapshot ids");

const freeFacts = buildContextText(ctx, { premium: false, question: "what's John's tip?" });
assert(/not Premium/.test(freeFacts) && /join/.test(freeFacts), "non-premium prompt forbids desk tips");

const lights = fallbackAnswer("what do the lights mean?", ctx, {});
assert(/Best value/.test(lights) && /65%/.test(lights), "lights explanation");

// ---- endpoint defers /ask and never logs secrets ----
let followed = 0;
let pending = null;
const prevFetch = globalThis.fetch;
globalThis.fetch = async () => new Response("{}", { status: 200 });
let deferRes;
try {
  deferRes = await onRequestPost({
    env: ENV,
    request: new Request("https://preview-discord-ask.probalab-site.pages.dev/api/discord/interactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature-ed25519": await sign("1730000002", JSON.stringify(slash)),
        "x-signature-timestamp": "1730000002",
      },
      body: JSON.stringify(slash),
    }),
    waitUntil(p) { followed += 1; pending = p; return p; },
  });
  if (pending) await pending;
} finally {
  globalThis.fetch = prevFetch;
}
assert(deferRes.status === 200 && (await deferRes.json()).type === RESPONSE.DEFERRED_CHANNEL_MESSAGE, "endpoint defers /ask");
assert(followed === 1, "follow-up scheduled with waitUntil");

const srcFiles = [
  "../functions/_shared/discord-ask.js",
  "../functions/api/discord/interactions.js",
  "../tools/register-discord-ask.mjs",
];
for (const f of srcFiles) {
  const src = readFileSync(new URL(f, import.meta.url), "utf8");
  for (const line of src.split("\n").filter((l) => l.includes("console.log"))) {
    assert(!/llmKey|botToken|TOKEN|API_KEY|interactionToken|job\.token|authorization/.test(line), `no secrets logged in ${f}`);
  }
  assert(!src.includes("nhl-value.json") && !src.toLowerCase().includes("fetch hidden"), `${f} does not fetch hidden desks`);
}
const askSrc = readFileSync(new URL("../functions/_shared/discord-ask.js", import.meta.url), "utf8");
assert(askSrc.includes('["latest", "probalab", "sniper"]'), "only allowed snapshot ids are requested");
assert(!/nba-price-gap|nhl-value|nfl-weather|nfl-totals/.test(askSrc.replace(/HIDDEN_DESK_RE[\s\S]*?;/, "")), "hidden desk ids are not loaded, only denied");

const reg = readFileSync(new URL("../tools/register-discord-ask.mjs", import.meta.url), "utf8");
assert(reg.includes('name: "ask"') && reg.includes('name: "Ask ProbaLab"') && reg.includes("type: 3"), "register script has /ask and message command");
assert(reg.includes("Never print the token") && reg.includes("console.error(\"Command registration failed:\", res.status)"), "register script does not print token or error bodies");

const sql = readFileSync(new URL("../ops/20261113_discord_ask/discord_ask_rate_limits.sql", import.meta.url), "utf8");
assert(/service role only/i.test(sql) && /enable row level security/.test(sql), "rate limit table is service role only");
assert(/Do not apply this to the production database until John says so/.test(sql), "migration is ask-first");

console.log("discord-ask tests passed");
