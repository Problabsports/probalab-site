// ProbaLab Chat: /ask and "Ask ProbaLab" via Discord Interactions (no gateway process).
// Off unless DISCORD_ASK_ENABLED=on and DISCORD_CHAT_PUBLIC_KEY is set.
// Never log or return tokens, API keys, signatures, or interaction tokens.
import { supabaseAdmin } from "./membership.js";
import { HOWTO_POSTS as howtoPosts } from "./discord-ask-howto.js";

export const INTERACTION = { PING: 1, APPLICATION_COMMAND: 2 };
export const RESPONSE = { PONG: 1, CHANNEL_MESSAGE: 4, DEFERRED_CHANNEL_MESSAGE: 5 };
export const COMMAND_TYPE = { CHAT_INPUT: 1, MESSAGE: 3 };
export const FLAG_EPHEMERAL = 64;

export const ALLOWED_SNAPSHOT_IDS = Object.freeze(["latest", "probalab", "sniper"]);
export const SNAPSHOT_LABEL = { latest: "John", probalab: "ProbaLab", sniper: "Sniper" };
export const HIDDEN_DESK_RE = /nhl\s*value|nba\s*price\s*gap|nfl\s*totals|nfl[\s-]?weather|nba-price-gap|nhl-value|nfl-weather|nfl-totals/i;
export const RATE_HOUR = 5;
export const RATE_DAY = 30;
export const SNOWFLAKE = /^\d{15,22}$/;
export const DEFAULT_LLM_MODEL = "gpt-4.1-mini";
export const DEFAULT_LLM_URL = "https://api.openai.com/v1/chat/completions";
export const PUBLIC_FEED = "https://zwdpsereqicvzbtfrrnd.supabase.co/functions/v1/probalab-feed";
export const PUBLIC_FEED_SPORTS = ["nba", "nfl"];
export const TAG_JOHN = "@teamjwc";

const JOIN_URL = "https://probalabsports.com/join";
const DISCORD_LINK_URL = "https://probalabsports.com/members/discord";
const RESULTS_URL = "https://probalabsports.com/results";

export function parseIdList(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => SNOWFLAKE.test(s));
}

export function discordAskConfig(env) {
  const e = env || {};
  return {
    publicKey: String(e.DISCORD_CHAT_PUBLIC_KEY || "").trim(),
    appId: String(e.DISCORD_CHAT_APP_ID || "").trim(),
    botToken: String(e.DISCORD_CHAT_BOT_TOKEN || ""),
    llmKey: String(e.LLM_API_KEY || ""),
    llmModel: String(e.LLM_MODEL || DEFAULT_LLM_MODEL).trim() || DEFAULT_LLM_MODEL,
    llmUrl: String(e.LLM_API_URL || DEFAULT_LLM_URL).trim() || DEFAULT_LLM_URL,
    channelIds: parseIdList(e.DISCORD_ASK_CHANNEL_IDS),
    premiumRoleId: String(e.DISCORD_PREMIUM_ROLE_ID || "").trim(),
    enabled: String(e.DISCORD_ASK_ENABLED || "").trim().toLowerCase() === "on",
  };
}

export function discordAskEnabled(env) {
  const c = discordAskConfig(env);
  return c.enabled && /^[0-9a-f]{64}$/i.test(c.publicKey) && SNOWFLAKE.test(c.appId);
}

export function hexToBytes(hex) {
  const s = String(hex || "").trim().replace(/^0x/i, "");
  if (!s || s.length % 2) return null;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    const n = parseInt(s.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(n)) return null;
    out[i] = n;
  }
  return out;
}

export async function verifyDiscordSignature(publicKeyHex, signatureHex, timestamp, rawBody) {
  const keyBytes = hexToBytes(publicKeyHex);
  const sigBytes = hexToBytes(signatureHex);
  if (!keyBytes || keyBytes.length !== 32 || !sigBytes || sigBytes.length !== 64) return false;
  if (timestamp == null || String(timestamp) === "" || rawBody == null) return false;
  try {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "Ed25519" }, false, ["verify"]);
    const message = new TextEncoder().encode(`${timestamp}${rawBody}`);
    return await crypto.subtle.verify("Ed25519", key, sigBytes, message);
  } catch {
    return false;
  }
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function ephemeral(content) {
  return { type: RESPONSE.CHANNEL_MESSAGE, data: { content: String(content), flags: FLAG_EPHEMERAL } };
}

export function deferred(ephemeralReply = false) {
  return ephemeralReply
    ? { type: RESPONSE.DEFERRED_CHANNEL_MESSAGE, data: { flags: FLAG_EPHEMERAL } }
    : { type: RESPONSE.DEFERRED_CHANNEL_MESSAGE };
}

export function interactionUserId(body) {
  const id = (body && (body.member && body.member.user && body.member.user.id)) || (body && body.user && body.user.id);
  return SNOWFLAKE.test(String(id || "")) ? String(id) : "";
}

export function isPremiumMember(body, roleId) {
  if (!SNOWFLAKE.test(String(roleId || ""))) return false;
  const roles = (body && body.member && body.member.roles) || [];
  return Array.isArray(roles) && roles.map(String).includes(String(roleId));
}

export function channelAllowed(body, channelIds) {
  const id = String((body && (body.channel_id || (body.channel && body.channel.id))) || "");
  return SNOWFLAKE.test(id) && Array.isArray(channelIds) && channelIds.includes(id);
}

export function extractQuestion(body) {
  const data = (body && body.data) || {};
  if (Number(data.type) === COMMAND_TYPE.MESSAGE || data.name === "Ask ProbaLab") {
    const target = String(data.target_id || "");
    const msg = data.resolved && data.resolved.messages && data.resolved.messages[target];
    const text = String((msg && msg.content) || "").trim();
    return text;
  }
  const opts = Array.isArray(data.options) ? data.options : [];
  const q = opts.find((o) => o && o.name === "question");
  return String((q && q.value) || "").trim();
}

export function lightLabel(light) {
  const l = String(light || "").toUpperCase();
  if (l === "SUPER") return "Best value";
  if (l === "GREEN") return "Green";
  if (l === "ORANGE") return "Orange";
  if (l === "RED") return "Red";
  return "";
}

export function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  if (pct < 0 || pct > 100) return null;
  return `${pct}%`;
}

export function formatUnits(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const t = n.toFixed(2).replace(/\.?0+$/, "");
  return `${t}u`;
}

function aedtStamp(iso) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  try {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(t)).replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
  } catch {
    return "";
  }
}

const REFUSE_BET_PLACE = /\b(place|put|make)\b.{0,40}\b(bet|wager|punt)\b|\blog\s+in\b.{0,20}\bbetfair\b|\bbetfair\b.{0,20}\b(login|place|order)\b/i;
const REFUSE_STAKE_MONEY = /\b(stake|bet|risk|put)\b.{0,30}\$?\d|\bhow much should i (bet|stake|risk)\b|\bkelly\b|\bbankroll\s+(size|advice)\b/i;
const REFUSE_GUARANTEE = /\b(guaranteed?\s+winner|lock\s+it\s+in|sure\s+thing|can't lose|cant lose|dead cert)\b/i;
const ON_TOPIC = /\b(proba\s*lab|probalab|light|green|orange|red|best value|super|record|result|tip|pick|predict|model|odds|unit|clv|close|desk|john|sniper|member|discord|premium|join|billing|nba|nfl|nhl|epl|premier|championship|tennis|blazer|laker|game|tonight|today|upcoming)\b/i;

export function guardrailMessage(question) {
  const q = String(question || "").trim();
  if (!q) return "I need a text question to answer. Try /ask with a question, or use Ask ProbaLab on a message that has some text.";
  if (REFUSE_BET_PLACE.test(q)) {
    return "I can't place bets or log into a bookmaker. I only explain the model's numbers and the published desks. " + TAG_JOHN + " can pick this up if you need more.";
  }
  if (REFUSE_STAKE_MONEY.test(q)) {
    return "I can't give staking advice in dollars. Records are kept in units: you set what one unit is worth and keep that size steady. Most desks use a flat 1 unit. " + TAG_JOHN + " can help if you want that walked through.";
  }
  if (REFUSE_GUARANTEE.test(q)) {
    return "There are no guaranteed winners. A Green pick can still lose — a 70% chance is still meant to miss about three times in ten. Only bet what you can afford. 18+.";
  }
  if (q.length > 20 && !ON_TOPIC.test(q) && !/\b(who|what|why|how|when|does|is|are|should)\b/i.test(q)) {
    return "I only answer ProbaLab questions: lights, records, today's predictions, and (for Premium members) the John, ProbaLab and Sniper desks. " + TAG_JOHN + " can pick up anything else.";
  }
  return null;
}

export function sanitizeReply(text, { premium = false } = {}) {
  let out = String(text || "").trim();
  out = out.replace(new RegExp(HIDDEN_DESK_RE, "gi"), "[desk not on the members page]");
  if (!premium) {
    // Do not leak unit-level desk tips to non-Premium answers.
    out = out.replace(/\b\d+(\.\d+)?u\b/gi, "units");
  }
  if (out.length > 1800) out = `${out.slice(0, 1790).trim()}…`;
  return out;
}

export function mentionsHiddenDesk(question) {
  return new RegExp(HIDDEN_DESK_RE, "i").test(String(question || ""));
}

function hourStart(ms) {
  const d = new Date(ms);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}
function sydneyDay(ms) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(ms)); // YYYY-MM-DD
}
function dayStartAedt(ms) {
  // Stored as midnight UTC on the Sydney calendar date so comparisons do not
  // shift with the +10/+11 offset.
  return `${sydneyDay(ms)}T00:00:00.000Z`;
}
function windowDay(value) {
  const raw = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const t = Date.parse(raw);
  return Number.isFinite(t) ? sydneyDay(t) : raw.slice(0, 10);
}

async function rateFromSupabase(env, userId, nowMs) {
  const hourKey = hourStart(nowMs);
  const dayKey = dayStartAedt(nowMs);
  const rows = await supabaseAdmin(
    env,
    "GET",
    `/rest/v1/discord_ask_rate_limits?select=bucket,window_start,hit_count&discord_user_id=eq.${encodeURIComponent(userId)}`,
  );
  const list = Array.isArray(rows) ? rows : [];
  const hour = list.find((r) => r.bucket === "hour");
  const day = list.find((r) => r.bucket === "day");
  const hourCount = hour && hour.window_start === hourKey ? Number(hour.hit_count) || 0 : 0;
  const dayCount = day && windowDay(day.window_start) === windowDay(dayKey) ? Number(day.hit_count) || 0 : 0;
  if (hourCount >= RATE_HOUR) return { ok: false, reason: "hour", hourCount, dayCount };
  if (dayCount >= RATE_DAY) return { ok: false, reason: "day", hourCount, dayCount };
  const nextHour = hourCount + 1;
  const nextDay = dayCount + 1;
  await supabaseAdmin(env, "POST", "/rest/v1/discord_ask_rate_limits?on_conflict=discord_user_id,bucket", [
    { discord_user_id: userId, bucket: "hour", window_start: hourKey, hit_count: nextHour, updated_at: new Date(nowMs).toISOString() },
    { discord_user_id: userId, bucket: "day", window_start: dayKey, hit_count: nextDay, updated_at: new Date(nowMs).toISOString() },
  ], { prefer: "resolution=merge-duplicates,return=minimal" });
  return { ok: true, hourCount: nextHour, dayCount: nextDay, source: "supabase" };
}

async function rateFromCache(cache, userId, nowMs) {
  if (!cache || typeof cache.match !== "function") return { ok: true, source: "none" };
  const hourKey = hourStart(nowMs);
  const dayKey = dayStartAedt(nowMs);
  const hUrl = `https://discord-ask-rl.internal/${userId}/hour/${hourKey}`;
  const dUrl = `https://discord-ask-rl.internal/${userId}/day/${dayKey}`;
  const [hHit, dHit] = await Promise.all([cache.match(new Request(hUrl)), cache.match(new Request(dUrl))]);
  const hourCount = hHit ? Number(await hHit.text()) || 0 : 0;
  const dayCount = dHit ? Number(await dHit.text()) || 0 : 0;
  if (hourCount >= RATE_HOUR) return { ok: false, reason: "hour", hourCount, dayCount, source: "cache" };
  if (dayCount >= RATE_DAY) return { ok: false, reason: "day", hourCount, dayCount, source: "cache" };
  const nextHour = hourCount + 1;
  const nextDay = dayCount + 1;
  await Promise.all([
    cache.put(new Request(hUrl), new Response(String(nextHour), { headers: { "cache-control": "max-age=3600" } })),
    cache.put(new Request(dUrl), new Response(String(nextDay), { headers: { "cache-control": "max-age=90000" } })),
  ]);
  return { ok: true, hourCount: nextHour, dayCount: nextDay, source: "cache" };
}

export async function consumeRateLimit(env, userId, nowMs = Date.now(), cache) {
  if (!SNOWFLAKE.test(String(userId || ""))) return { ok: false, reason: "user" };
  if (env && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      return await rateFromSupabase(env, userId, nowMs);
    } catch (err) {
      console.log("discord ask rate limit table unavailable", err && err.status);
    }
  }
  return rateFromCache(cache, userId, nowMs);
}

export function rateLimitMessage(result) {
  if (result && result.reason === "hour") {
    return "Slow down a little — that's five questions in an hour. Try again after the hour, or ask " + TAG_JOHN + ".";
  }
  if (result && result.reason === "day") {
    return "That's the daily cap of 30 questions. Try again tomorrow, or ask " + TAG_JOHN + ".";
  }
  return "Please try again in a moment.";
}

function compactGame(g, sport) {
  const home = g.home_name || g.home || "";
  const away = g.away_name || g.away || "";
  const pick = g.pick_name || g.pick || "";
  const pct = formatPct(g.pick_p);
  const light = lightLabel(g.light);
  const when = aedtStamp(g.start_utc);
  const status = String(g.status || "");
  return {
    sport,
    match: away && home ? `${away} at ${home}` : [away, home].filter(Boolean).join(" / "),
    pick,
    pct,
    light,
    lightRaw: g.light || "",
    start: when,
    status,
    start_utc: g.start_utc || "",
  };
}

function isUpcoming(g, nowMs) {
  const status = String(g.status || "").toLowerCase();
  if (status === "post" || status === "final") return false;
  const t = Date.parse(g.start_utc || g.tipoff_utc || g.kickoff_utc || "");
  if (Number.isFinite(t)) return t > nowMs - 15 * 60 * 1000;
  return status === "pre" || status === "scheduled" || status === "";
}

function compactBet(row, desk) {
  return {
    desk,
    sport: row.sport || "",
    game: row.game || "",
    selection: row.selection || row.side || "",
    light: lightLabel(row.light),
    lightRaw: row.light || "",
    pct: formatPct(row.win_pct != null ? row.win_pct : row.chance),
    price: row.price_taken != null ? String(row.price_taken) : "",
    units: formatUnits(row.units),
    result: row.result || "open",
    kickoff: aedtStamp(row.kickoff_utc || row.tipoff_utc),
  };
}

function compactResult(row, desk) {
  const b = compactBet(row, desk);
  b.pnl = formatUnits(row.pnl_units);
  b.won = row.result === "W" || row.won === true;
  return b;
}

export function relevantHowto(question, limit = 3) {
  const q = String(question || "").toLowerCase();
  const words = q.split(/[^a-z0-9+]+/).filter((w) => w.length > 3);
  const scored = (howtoPosts || []).map((p) => {
    const hay = `${p.title}\n${p.body}`.toLowerCase();
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 1;
    if (/light|green|orange|red|best value|super/.test(q) && /lights mean|best value/.test(hay)) score += 3;
    if (/unit|stake/.test(q) && /what a unit/.test(hay)) score += 3;
    if (/clv|close/.test(q) && /beating the close/.test(hay)) score += 3;
    if (/result|record/.test(q) && /results are checked/.test(hay)) score += 3;
    if (/join|cancel|billing|price|founding/.test(q) && /manage or cancel/.test(hay)) score += 3;
    if (/alert|channel|discord/.test(q) && /where things land|get alerts/.test(hay)) score += 2;
    if (/afford|responsible|18|guarant/.test(q) && /bet only what/.test(hay)) score += 3;
    return { p, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => `${x.p.title}\n${x.p.body}`);
}

export async function loadGrounding(env, request, { premium, question, nowMs, fetchImpl } = {}) {
  const fetchFn = fetchImpl || fetch;
  const origin = (() => {
    try { return new URL(request.url).origin; } catch { return "https://probalabsports.com"; }
  })();
  const now = nowMs || Date.now();
  const ctx = { upcoming: [], records: null, yesterday: null, howto: relevantHowto(question), desks: null, generated: [] };

  const tasks = [
    ...PUBLIC_FEED_SPORTS.map(async (sport) => {
      try {
        const res = await fetchFn(`${PUBLIC_FEED}?sport=${sport}`, { headers: { accept: "application/json" } });
        if (!res.ok) return;
        const data = await res.json();
        const games = Array.isArray(data.games) ? data.games : [];
        ctx.generated.push(`${sport} feed ${data.generated_at || ""}`.trim());
        for (const g of games) {
          if (isUpcoming(g, now)) ctx.upcoming.push(compactGame(g, sport));
        }
      } catch (err) {
        console.log("discord ask feed failed", sport, err && err.message);
      }
    }),
    (async () => {
      try {
        const res = await fetchFn(`${origin}/api/green-record`, { headers: { accept: "application/json" } });
        if (res.ok) ctx.records = await res.json();
      } catch (err) {
        console.log("discord ask green-record failed", err && err.message);
      }
    })(),
    (async () => {
      try {
        const res = await fetchFn(`${origin}/api/yesterday-greens`, { headers: { accept: "application/json" } });
        if (res.ok) ctx.yesterday = await res.json();
      } catch (err) {
        console.log("discord ask yesterday-greens failed", err && err.message);
      }
    })(),
  ];

  if (premium && env && env.SUPABASE_SERVICE_ROLE_KEY) {
    tasks.push((async () => {
      const desks = {};
      for (const id of ALLOWED_SNAPSHOT_IDS) {
        try {
          const rows = await supabaseAdmin(
            env,
            "GET",
            `/rest/v1/tips_page_snapshot?select=id,payload,generated_at&id=eq.${encodeURIComponent(id)}`,
          );
          const row = Array.isArray(rows) && rows[0];
          if (!row || !row.payload) continue;
          const p = row.payload;
          const label = SNAPSHOT_LABEL[id];
          const open = Array.isArray(p.open_bets) ? p.open_bets.map((r) => compactBet(r, label)) : [];
          const today = Array.isArray(p.today)
            ? p.today.filter((r) => isUpcoming(r, now)).map((r) => ({
              desk: label,
              sport: r.sport || "",
              game: r.game || "",
              selection: r.selection || "",
              light: lightLabel(r.light),
              pct: formatPct(r.win_pct),
              kickoff: aedtStamp(r.tipoff_utc || r.kickoff_utc),
            }))
            : [];
          const results = Array.isArray(p.results) ? p.results.slice(-8).map((r) => compactResult(r, label)) : [];
          const summary = p.summary
            ? { desk: label, bets: p.summary.bets, wins: p.summary.wins, losses: p.summary.losses, units: formatUnits(p.summary.units) }
            : null;
          desks[id] = { label, generated_at: p.generated_at || row.generated_at || null, open, today, results, summary };
        } catch (err) {
          console.log("discord ask snapshot failed", id, err && err.status);
        }
      }
      ctx.desks = desks;
    })());
  }

  await Promise.all(tasks);
  ctx.upcoming.sort((a, b) => String(a.start_utc).localeCompare(String(b.start_utc)));
  return ctx;
}

export function buildContextText(ctx, { premium, question } = {}) {
  const lines = [];
  lines.push("Use only the facts below. If a figure is missing, say so and mention " + TAG_JOHN + ". Do not invent numbers.");
  lines.push("Call SUPER 'Best value' (NBA only). Greens matter most. Public results update around 5pm AEDT.");
  lines.push("There are no guaranteed winners. 18+. No staking advice beyond published units.");
  if (!premium) {
    lines.push("This user is not Premium. You may use public lights, records and site predictions only. If they ask about John, ProbaLab or Sniper desk tips, tell them to join at " + JOIN_URL + " and link Discord at " + DISCORD_LINK_URL + ". Do not invent desk tips.");
  }
  if (mentionsHiddenDesk(question)) {
    lines.push("Those named desks are not on the members page. Do not describe them. Say you can talk about John, ProbaLab and Sniper only.");
  }
  if (ctx.records) {
    const g = ctx.records.green || {};
    const s = ctx.records.super;
    lines.push(`Public green record: ${g.w ?? 0} of ${g.n ?? 0}${g.pct != null ? ` (${g.pct}%)` : ""}.`);
    if (s && s.n) lines.push(`Best value (NBA only): ${s.w} of ${s.n}${s.pct != null ? ` (${s.pct}%)` : ""}.`);
    for (const sp of ctx.records.sports || []) {
      if (sp.error || !sp.green) continue;
      lines.push(`${sp.name || sp.sport} green: ${sp.green.w} of ${sp.green.n}${sp.green.pct != null ? ` (${sp.green.pct}%)` : ""}.`);
    }
  }
  if (ctx.yesterday && !ctx.yesterday.hide && ctx.yesterday.greens && ctx.yesterday.greens.length) {
    lines.push(`Latest green results (${ctx.yesterday.label || ctx.yesterday.day}):`);
    for (const r of ctx.yesterday.greens.slice(0, 12)) {
      const mark = r.won ? "won" : "lost";
      const light = lightLabel(r.light) || r.light;
      const pct = formatPct(r.chance);
      lines.push(`- ${r.sport_name || r.sport}: ${r.pick}${pct ? ` ${pct}` : ""} ${light} ${mark}`);
    }
  }
  const q = String(question || "").toLowerCase();
  const upcoming = ctx.upcoming || [];
  const matched = q
    ? upcoming.filter((g) => `${g.match} ${g.pick}`.toLowerCase().includes(q.split(/\s+/).find((w) => w.length > 3) || "___") || q.split(/[^a-z0-9]+/).filter((w) => w.length > 3).some((w) => `${g.match} ${g.pick}`.toLowerCase().includes(w)))
    : [];
  const show = (matched.length ? matched : upcoming.filter((g) => g.lightRaw === "GREEN" || g.lightRaw === "SUPER")).slice(0, 16);
  const list = show.length ? show : upcoming.slice(0, 12);
  if (list.length) {
    lines.push("Today's public predictions (upcoming):");
    for (const g of list) {
      lines.push(`- ${g.sport.toUpperCase()} ${g.match}: pick ${g.pick}${g.pct ? ` ${g.pct}` : ""}${g.light ? ` ${g.light}` : ""}${g.start ? ` ${g.start} AEDT` : ""}`);
    }
  }
  if (premium && ctx.desks) {
    lines.push("Premium members desks (John, ProbaLab, Sniper only):");
    for (const id of ALLOWED_SNAPSHOT_IDS) {
      const d = ctx.desks[id];
      if (!d) continue;
      if (d.summary) lines.push(`${d.label} record: ${d.summary.wins} wins, ${d.summary.losses} losses, net ${d.summary.units || "n/a"} (${d.summary.bets} settled).`);
      const open = (d.open || []).slice(0, 8);
      if (open.length) {
        lines.push(`${d.label} open tips:`);
        for (const t of open) {
          lines.push(`- ${t.sport} ${t.game}: ${t.selection}${t.pct ? ` ${t.pct}` : ""}${t.light ? ` ${t.light}` : ""}${t.price ? ` @ ${t.price}` : ""}${t.units ? ` ${t.units}` : ""}${t.kickoff ? ` ${t.kickoff} AEDT` : ""}`);
        }
      }
    }
  }
  if (ctx.howto && ctx.howto.length) {
    lines.push("How-to guides:");
    for (const h of ctx.howto) lines.push(h);
  }
  lines.push(`Public record: ${RESULTS_URL}`);
  return lines.join("\n");
}

export function fallbackAnswer(question, ctx, { premium } = {}) {
  const refused = guardrailMessage(question);
  if (refused) return refused;
  if (mentionsHiddenDesk(question)) {
    return "That desk isn't on the members page. I can talk about the John, ProbaLab and Sniper desks, plus the public lights and record. " + TAG_JOHN + " can pick this up if you meant something else.";
  }
  const q = String(question || "").toLowerCase();
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !["what", "whats", "about", "today", "tonight", "does", "have", "with", "from", "this", "that", "game", "team", "please"].includes(w));
  const hits = (ctx.upcoming || []).filter((g) => words.some((w) => `${g.match} ${g.pick}`.toLowerCase().includes(w)));
  if (hits.length) {
    const g = hits[0];
    const pct = g.pct || "a figure I don't have on the feed";
    const light = g.light ? ` (${g.light})` : "";
    const when = g.start ? ` ${g.start} AEDT` : "";
    return `Our model has ${g.pick} at ${pct}${light} in ${g.match}${when}. That's the live site number, not a guaranteed winner.`;
  }
  if (/green record|how many green|record|how (are|is) (the )?green/.test(q) && ctx.records && ctx.records.green) {
    const g = ctx.records.green;
    const s = ctx.records.super;
    let out = `Greens first: the public green record is ${g.w} of ${g.n}${g.pct != null ? ` (${g.pct}%)` : ""}.`;
    if (s && s.n) out += ` Best value (NBA only) is ${s.w} of ${s.n}${s.pct != null ? ` (${s.pct}%)` : ""}.`;
    out += ` Full list: ${RESULTS_URL}. Results go up around 5pm AEDT.`;
    return out;
  }
  if (/best value|what does super|what is super/.test(q)) {
    return "Best value is the NBA-only flag (labelled SUPER on the feed). It means the bookmaker price beats our fair price. It is not a higher-confidence Green. Green is still the high-chance pick: 65% or more in the NBA.";
  }
  if (/what (do|does|is|are) (the )?lights|orange|red pick/.test(q)) {
    return "Green, orange and red are about the model's chance. Green is the high-chance pick: 65% or more in the NBA, NFL and NHL (55% in the Premier League and Championship, 70% in tennis). Orange is a lean, red is below that. Best value is different: an NBA-only price flag, not a stronger green. There are no guaranteed winners.";
  }
  if (premium && ctx.desks && /tip|desk|john|sniper|probalab/.test(q)) {
    const bits = [];
    for (const id of ALLOWED_SNAPSHOT_IDS) {
      const d = ctx.desks[id];
      if (!d || !d.open || !d.open.length) continue;
      const t = d.open[0];
      bits.push(`${d.label}: ${t.selection} in ${t.game}${t.pct ? ` ${t.pct}` : ""}${t.light ? ` ${t.light}` : ""}${t.units ? `, ${t.units}` : ""}`);
    }
    if (bits.length) return `On the members desks right now: ${bits.join(". ")}. Units only — not dollar staking advice.`;
  }
  if (!premium && /\b(john|sniper|probalab|desk tip|members tip)\b/.test(q)) {
    return `John, ProbaLab and Sniper desk tips are for Premium members. Join at ${JOIN_URL} and link Discord at ${DISCORD_LINK_URL} to unlock them. I can still talk through the public lights and today's site predictions.`;
  }
  if (ctx.howto && ctx.howto.length && /unit|clv|close|alert|channel|cancel|billing|founding|18|afford/.test(q)) {
    const first = String(ctx.howto[0] || "");
    const body = first.split("\n").slice(1).join(" ").trim();
    if (body) return body.slice(0, 500);
  }
  return "I don't have a figure for that on the live feed. " + TAG_JOHN + " can pick this up.";
}

export async function callLlm(env, { question, contextText, fetchImpl }) {
  const c = discordAskConfig(env);
  if (!c.llmKey) return null;
  const fetchFn = fetchImpl || fetch;
  const res = await fetchFn(c.llmUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${c.llmKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: c.llmModel,
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: "You are the ProbaLab Chat bot in the ProbaLab Members Discord. Reply like a short team chat note, 2 to 6 sentences. Lead with the model's percentage and light when a game is involved (example: \"Our model has Portland at 64% tonight (Orange).\"). Be friendly, not touty. Use only the provided facts. Never invent numbers, never mention hidden desks, never offer to place a bet, never give dollar staking advice, never promise a winner. If you are unsure, say so and tag " + TAG_JOHN + ".",
        },
        { role: "user", content: `Question: ${question}\n\nFacts:\n${contextText}` },
      ],
    }),
  });
  if (!res.ok) {
    console.log("discord ask llm failed", res.status);
    return null;
  }
  const data = await res.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return String(text || "").trim() || null;
}

export async function followUpMessage(appId, interactionToken, content, fetchImpl) {
  const fetchFn = fetchImpl || fetch;
  const url = `https://discord.com/api/v10/webhooks/${encodeURIComponent(appId)}/${encodeURIComponent(interactionToken)}/messages/@original`;
  const res = await fetchFn(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: String(content).slice(0, 2000) }),
  });
  if (!res.ok) console.log("discord ask follow-up failed", res.status);
  return res.ok;
}

export async function answerQuestion(env, request, { question, premium, nowMs, fetchImpl, cache }) {
  const refused = guardrailMessage(question);
  if (refused) return sanitizeReply(refused, { premium });
  const ctx = await loadGrounding(env, request, { premium, question, nowMs, fetchImpl });
  const contextText = buildContextText(ctx, { premium, question });
  let text = null;
  try {
    text = await callLlm(env, { question, contextText, fetchImpl });
  } catch (err) {
    console.log("discord ask llm error", err && err.message);
  }
  if (!text) text = fallbackAnswer(question, ctx, { premium });
  return sanitizeReply(text, { premium });
}

export async function planInteraction(env, body, request, { nowMs, cache } = {}) {
  const c = discordAskConfig(env);
  if (body && body.type === INTERACTION.PING) return { response: { type: RESPONSE.PONG } };
  if (!discordAskEnabled(env)) {
    return { response: ephemeral("ProbaLab Chat is not switched on in this environment yet.") };
  }
  if (!body || body.type !== INTERACTION.APPLICATION_COMMAND) {
    return { response: ephemeral("I only answer /ask and the Ask ProbaLab message action.") };
  }
  if (!body.guild_id) {
    return { response: ephemeral("Please use /ask in #general-chat or #questions on the ProbaLab server.") };
  }
  if (!c.channelIds.length) {
    return { response: ephemeral("The channel allowlist is not set yet, so I can't reply here. " + TAG_JOHN + " will switch that on for #general-chat and #questions.") };
  }
  if (!channelAllowed(body, c.channelIds)) {
    return { response: ephemeral("I only reply in #general-chat and #questions. Please ask me there.") };
  }
  const question = extractQuestion(body);
  const userId = interactionUserId(body);
  const rate = await consumeRateLimit(env, userId, nowMs || Date.now(), cache);
  if (!rate.ok) return { response: ephemeral(rateLimitMessage(rate)) };
  const premium = isPremiumMember(body, c.premiumRoleId);
  const appId = SNOWFLAKE.test(c.appId) ? c.appId : String((body && body.application_id) || "");
  const token = body && body.token;
  return {
    response: deferred(false),
    job: {
      question,
      premium,
      appId,
      token,
    },
  };
}

export async function runFollowUp(env, request, job, { nowMs, fetchImpl } = {}) {
  if (!job || !job.token || !job.appId) return false;
  const content = await answerQuestion(env, request, {
    question: job.question,
    premium: job.premium,
    nowMs,
    fetchImpl,
  });
  return followUpMessage(job.appId, job.token, content, fetchImpl);
}
