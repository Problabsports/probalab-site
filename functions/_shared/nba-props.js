// NBA player props board: predictions only (predicted side, chance and light; no prices, no tips, no units).
// Data: the real board is the Supabase row public.tips_page_snapshot id="nba-props", uploaded by
// the mini PC after each morning run. It is read here, on the server, with the service key; the
// key and the raw row never reach the browser. If the row is missing, has no games, is marked
// sample, is 36h+ old, or the read fails, the sample fixture data/nba_points_props/board.json
// (via ASSETS) is used instead and stays marked sample. The raw fixture file is members-only
// (functions/data/nba_points_props/[[path]].js).
// Rendering: the free view (top FREE_PER_GAME players per game by projection, at least one per
// team; the rest blurred placeholders with no real data) or the full board for members.
//
// Per-player data shape (one block per stat):
//   { player, team, status, notes,
//     stats: { points:   { season_avg, line, proj, sigma, p_over, p_under },
//              rebounds: {...}, assists: {...}, threes: {...} } }
// Older boards with proj_pts / primary_line still render for points (see statOf).
import { esc, chip, slug } from "./site.js";
import { supabaseAdmin } from "./membership.js";

export const BOARD_PATH = "/data/nba_points_props/board.json";
export const SNAPSHOT_ID = "nba-props";
const SNAPSHOT_PATH = `/rest/v1/tips_page_snapshot?select=payload,generated_at&id=eq.${SNAPSHOT_ID}`;
export const FREE_PER_GAME = 3;
export const MAX_AGE_MS = 36 * 3600 * 1000; // a real board this old falls back to the sample
export const STARTED_HIDE_MS = 3 * 3600 * 1000; // games that tipped off longer ago are hidden
const CACHE_MS = 60 * 1000;
export const STATS = [
  ["points", "Points"],
  ["rebounds", "Rebounds"],
  ["assists", "Assists"],
  ["threes", "Threes"],
];
const TZ = "Australia/Sydney";
// Light colours, props scale: green 60%+, orange 55–59%, red under 55%.
export const GREEN_MIN = 0.6;
export const ORANGE_MIN = 0.55;
// Reserved for a later book line / price column. Off until prices exist.
export const SHOW_BOOK_COLUMN = false;

// ------------------------------------------------------------------ loading
let rowCache = null; // { at, row }, per isolate

/** Test hook: forget the cached Supabase row. */
export function _resetBoardCache() {
  rowCache = null;
}

async function readSnapshotRow(env, now) {
  if (rowCache && now - rowCache.at >= 0 && now - rowCache.at < CACHE_MS) return rowCache.row;
  let row = null;
  try {
    const rows = await supabaseAdmin(env, "GET", SNAPSHOT_PATH);
    row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.log(`nba-props: snapshot read failed (${(e && e.status) || "no response"})`);
  }
  rowCache = { at: now, row };
  return row;
}

function generatedOf(payload, row) {
  for (const v of [payload && payload.generated_at, row && row.generated_at]) {
    const t = Date.parse(v || "");
    if (Number.isFinite(t)) return { iso: v, t };
  }
  return null;
}

/** The Supabase row counts as the real board only with games, sample !== true and under 36h old. */
export function realBoardFrom(row, now = Date.now()) {
  const payload = row && row.payload;
  if (!payload || typeof payload !== "object") return null;
  if (payload.sample === true) return null;
  if (!Array.isArray(payload.games) || !payload.games.length) return null;
  const gen = generatedOf(payload, row);
  if (!gen || now - gen.t >= MAX_AGE_MS) return null;
  return { ...payload, generated_at: gen.iso, sample: false };
}

async function loadSample(ctx) {
  try {
    const r = await ctx.env.ASSETS.fetch(new URL(BOARD_PATH, ctx.request.url));
    if (!r.ok) return null;
    const b = await r.json();
    return b && Array.isArray(b.games) ? { ...b, sample: true } : null;
  } catch (_) {
    return null;
  }
}

const tipOf = (g) => {
  const t = Date.parse(g.commence_utc || g.commence_syd || "");
  return Number.isFinite(t) ? t : null;
};

/** Drop games that tipped off more than 3 hours ago. */
export function dropStarted(board, now = Date.now()) {
  if (!board) return board;
  const games = (board.games || []).filter((g) => {
    const t = tipOf(g);
    return t == null || now - t <= STARTED_HIDE_MS;
  });
  return { ...board, games };
}

/**
 * The board to render: the fresh real board from Supabase, else the sample fixture (sample:true).
 * Games past tip-off + 3h are removed either way; an empty games list renders "nothing yet".
 */
export async function loadBoard(ctx, opts = {}) {
  const now = opts.now ?? ctx.now ?? Date.now();
  const row = await readSnapshotRow(ctx.env || {}, now);
  const board = realBoardFrom(row, now) || (await loadSample(ctx));
  return board ? dropStarted(board, now) : null;
}

// ------------------------------------------------------------------ statuses (ESPN)
// Doubtful / Out / Suspension: left off every tab and never counted.
const HIDDEN_STATUS = /^(doubtful|out|suspen)/i;
const norm = (s) => String(s || "").trim();
export const isHiddenStatus = (player) => HIDDEN_STATUS.test(norm(player && player.status));

/** Warning label for a status, or "" for Active / blank / hidden. */
export function statusLabel(player) {
  const s = norm(player && player.status);
  if (!s || /^active$/i.test(s) || isHiddenStatus(player)) return "";
  if (/^day[-\s]?to[-\s]?day$/i.test(s)) return "Day-to-day";
  if (/^questionable$/i.test(s)) return "Questionable";
  return s;
}

export function isUncertain(player) {
  return !!statusLabel(player);
}

// ------------------------------------------------------------------ data helpers
const num = (x) => (x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
const pct = (p) => `${Math.round(p * 100)}%`;
// Colour follows the rounded % shown, so "55%" is never red and "60%" is always green.
export const lightOf = (p) => {
  if (p == null) return "";
  const shown = Math.round(p * 100);
  return shown >= Math.round(GREEN_MIN * 100) ? "GREEN" : shown >= Math.round(ORANGE_MIN * 100) ? "ORANGE" : "RED";
};

/** One stat block for a player, normalised: { avg, line, proj, over, under, side, p } or null. */
export function statOf(player, stat) {
  if (!player) return null;
  let s = player.stats && player.stats[stat];
  if (!s && stat === "points" && player.primary_line) {
    // legacy points shape
    s = { season_avg: player.season_avg_pts ?? player.season_avg, line: player.primary_line.line, proj: player.proj_pts, p_over: player.primary_line.p_over, p_under: player.primary_line.p_under };
  }
  if (!s) return null;
  const line = num(s.line), proj = num(s.proj);
  let over = num(s.p_over), under = num(s.p_under);
  if (line == null || proj == null || (over == null && under == null)) return null;
  if (over == null) over = 1 - under;
  if (under == null) under = 1 - over;
  const side = over >= under ? "Over" : "Under";
  return { avg: num(s.season_avg), line, proj, over, under, side, p: Math.max(over, under) };
}

/** Players with this stat, strongest call first. Hidden statuses and players without the stat are dropped. */
export function preparePlayers(players, stat = "points") {
  return (players || [])
    .filter((p) => !isHiddenStatus(p))
    .map((p) => ({ ...p, s: statOf(p, stat) }))
    .filter((p) => p.s)
    .sort((a, b) => b.s.p - a.s.p || String(a.player).localeCompare(String(b.player)));
}

/** Free view: n players per game ranked by projection, at least one from each team. */
export function freePicks(prepared, teams, n = FREE_PER_GAME) {
  const ranked = prepared.slice().sort((a, b) => b.s.proj - a.s.proj || String(a.player).localeCompare(String(b.player)));
  const pick = new Set();
  for (const t of teams) {
    const top = ranked.find((p) => p.team === t);
    if (top && pick.size < n) pick.add(top);
  }
  for (const p of ranked) {
    if (pick.size >= n) break;
    pick.add(p);
  }
  return pick;
}

export function sortedGames(board) {
  const t = (g) => tipOf(g) ?? Infinity;
  return ((board && board.games) || []).slice().sort((a, b) => t(a) - t(b));
}

export function hasStat(board, stat) {
  return sortedGames(board).some((g) => preparePlayers(g.players, stat).length > 0);
}

const fmt = (iso, opts) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", { timeZone: TZ, ...opts }).format(d);
};
const ampm = (s) => s.replace(/\s?(am|pm)/i, (m) => " " + m.trim().toLowerCase());
const clock = { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" };
export const startLabel = (iso) => ampm(fmt(iso, clock));
/** "7:31 am AEDT" (Australia/Sydney short zone name: AEDT or AEST). */
export const updatedLabel = (iso) => ampm(fmt(iso, { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" }));
export const dayLabel = (iso) => fmt(iso, { weekday: "long", day: "numeric", month: "long" });
/** Sydney calendar date "YYYY-MM-DD" for an ISO string or epoch ms ("" when unparseable). */
export const sydDate = (t) => {
  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-AU", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
const dayBits = (iso) => ({ wd: fmt(iso, { weekday: "short" }), d: fmt(iso, { day: "numeric" }), mon: fmt(iso, { month: "short" }) });
/** "Wed 18 Nov" (Sydney). */
export const shortDay = (iso) => { const b = dayBits(iso); return b.wd ? `${b.wd} ${b.d} ${b.mon}` : ""; };
/** Strip day: "Tuesday 17 November" for one day, "Tue 17 – Wed 18 Nov" (or "Mon 30 Nov – Tue 1 Dec") across days. */
export function daySpanLabel(isos) {
  const ts = (isos || []).filter((x) => sydDate(x)).sort((a, b) => Date.parse(a) - Date.parse(b));
  if (!ts.length) return "";
  const first = ts[0], last = ts[ts.length - 1];
  if (sydDate(first) === sydDate(last)) return dayLabel(first);
  const a = dayBits(first), b = dayBits(last);
  return a.mon === b.mon ? `${a.wd} ${a.d} – ${b.wd} ${b.d} ${b.mon}` : `${a.wd} ${a.d} ${a.mon} – ${b.wd} ${b.d} ${b.mon}`;
}

/** Strip counts: games on the board, and players with at least one stat (hidden statuses never counted). */
export function boardStats(board) {
  const games = sortedGames(board);
  const ids = STATS.map(([id]) => id);
  const players = games.reduce((n, g) => n + (g.players || []).filter((p) => !isHiddenStatus(p) && ids.some((id) => statOf(p, id))).length, 0);
  return { games: games.length, players, day: daySpanLabel(games.map((g) => g.commence_utc || g.commence_syd)) };
}

/// ------------------------------------------------------------------ rendering
/** Player page id: player_id when the snapshot has one, else a slug of the name. */
export const playerId = (p) => slug((p && (p.player_id != null && p.player_id !== "" ? String(p.player_id) : p.player)) || "");
export const playerPath = (p) => `/props/nba/player/${playerId(p)}`;
const nick = (team) => String(team || "").trim().split(/\s+/).pop();
const one = (x) => (x == null ? "—" : x.toFixed(1));
export const MARKET_LABEL = Object.fromEntries(STATS);
const LIGHT_RANK = { GREEN: 0, ORANGE: 1, RED: 2 };
const STAT_RANK = Object.fromEntries(STATS.map(([id], i) => [id, i]));
/** Key for one prediction: player id + market. */
export const predKey = (p, stat) => `${playerId(p)}|${stat}`;

/**
 * Every prediction in one game: one row per player and market (hidden statuses and players
 * without the market dropped). Green first, then highest chance, then name, then market order.
 */
export function gamePredictions(g, market = null) {
  const out = [];
  for (const [stat] of STATS) {
    if (market && stat !== market) continue;
    for (const p of preparePlayers(g.players, stat)) out.push({ ...p, stat, light: lightOf(p.s.p) });
  }
  return out.sort((a, b) => LIGHT_RANK[a.light] - LIGHT_RANK[b.light] || b.s.p - a.s.p || String(a.player).localeCompare(String(b.player)) || STAT_RANK[a.stat] - STAT_RANK[b.stat]);
}

/** Teams in a game: away, home, then any other team a listed player carries. */
function gameTeams(g) {
  const teams = [g.away, g.home].filter(Boolean);
  for (const p of g.players || []) if (p.team && !isHiddenStatus(p) && !teams.includes(p.team)) teams.push(p.team);
  return teams;
}

/** Free view keys (player|market) for one game: FREE_PER_GAME players per market, as before. */
export function freeKeys(g) {
  const keys = new Set();
  const teams = gameTeams(g);
  for (const [stat] of STATS) for (const p of freePicks(preparePlayers(g.players, stat), teams)) keys.add(predKey(p, stat));
  return keys;
}

/** Free view keys across the whole board. */
export function boardFreeKeys(board) {
  const keys = new Set();
  for (const g of sortedGames(board)) for (const k of freeKeys(g)) keys.add(k);
  return keys;
}

const warnHtml = (p) => {
  const status = statusLabel(p);
  return status
    ? ` <span class="injury-watch pp-injury" role="note" title="${esc(p.notes || "")}"><span class="injury-watch-label">⚠️ ${esc(status)}</span><span class="injury-watch-note">Minutes uncertain</span></span>`
    : "";
};

/** One prediction row: Player | Market | Line | Prediction | Chance | light chip, coloured left border. */
export function predictionRow(r, { link = true, name = true } = {}) {
  const s = r.s;
  const who = name
    ? `<th scope="row" class="pl">${link ? `<a class="pp-name" href="${esc(playerPath(r))}">${esc(r.player)}</a>` : `<span class="pp-name">${esc(r.player)}</span>`} <span class="pp-tm">${esc(nick(r.team))}</span>${warnHtml(r)}</th>`
    : "";
  return `<tr class="pp-row lt-${r.light}" data-team="${esc(r.team || "")}" data-market="${r.stat}" data-light="${r.light}" data-p="${s.p.toFixed(3)}">
      ${who}<td class="mk">${esc(MARKET_LABEL[r.stat])}</td>
      <td class="num">${one(s.line)}</td>
      <td class="call">${s.side}</td>
      <td class="num pct">${pct(s.p)}</td>
      <td class="lt">${chip(r.light)}</td>
    </tr>`;
}

function lockedRow() {
  // Placeholder only: no real names, numbers or statuses are sent to non-members.
  return `<tr class="pp-row pp-locked-row" aria-hidden="true"><th scope="row" class="pl"><span class="pp-name">Member player</span></th><td class="mk">Market</td><td class="num">00.5</td><td class="call">Over</td><td class="num pct">00%</td><td class="lt"><span class="chip">●●●</span></td></tr>`;
}
const LOCKED_SHOWN = 3; // blurred placeholder rows per game; the count line says how many more

export const HEAD = `<thead><tr><th scope="col" class="pl">Player</th><th scope="col" class="mk">Market</th><th scope="col" class="num">Line</th><th scope="col" class="call">Prediction</th><th scope="col" class="num pct">Chance</th><th scope="col" class="lt"><span class="sr-only">Light</span></th></tr></thead>`;
const HEAD_NO_NAME = HEAD.replace('<th scope="col" class="pl">Player</th>', "");

// Members sign-in returns to this page after login (members-lobby.js honours a same-site ?next=).
export const SIGNIN_URL = "/members?next=%2Fprops%2Fnba#memberSignIn";
/** Two equal buttons: Join members (primary) and Members sign in (secondary). */
export const memberButtons = (extra = "") =>
  `<div class="pp-cta${extra ? " " + extra : ""}"><a class="btn pp-join" href="/join">Join members</a><a class="btn pp-signin" href="${SIGNIN_URL}">Members sign in</a></div>`;

export const EMPTY_HTML = `<section class="panel pp-empty"><p>No player props on the board yet. Check back closer to tip-off.</p></section>`;

/**
 * Predictions board grouped by game: one card per game, every player × market row, green first.
 * full=false keeps only the free-view rows; the rest are counted and shown as blurred placeholders.
 */
export function renderCards(board, { full = false } = {}) {
  const games = sortedGames(board);
  if (!games.length || !STATS.some(([id]) => hasStat(board, id))) return EMPTY_HTML;
  return games.map((g) => {
    const all = gamePredictions(g);
    if (!all.length) return "";
    const teams = gameTeams(g);
    const keys = full ? null : freeKeys(g);
    const rows = full ? all : all.filter((r) => keys.has(predKey(r, r.stat)));
    const hidden = all.length - rows.length;
    const locked = hidden > 0 ? `<tbody class="pp-locked" aria-hidden="true">${Array.from({ length: Math.min(hidden, LOCKED_SHOWN) }, lockedRow).join("")}</tbody>` : "";
    const gate = hidden > 0
      ? `<div class="pp-gate"><p class="small">${hidden} more prediction${hidden === 1 ? "" : "s"} in this game.</p>${memberButtons()}</div>`
      : "";
    return `<section class="panel pp-game" data-game="${esc(g.event_id || "")}" data-teams="${esc(teams.join("|"))}">
    <header class="pp-head"><h2>${esc(g.away || "")} @ ${esc(g.home || "")}</h2><p class="pp-when mono">${esc(startLabel(g.commence_utc || g.commence_syd))}</p></header>
    <div class="pp-scroll"><table class="pp-table">${HEAD}<tbody class="pp-rows">${rows.map((r) => predictionRow(r)).join("")}</tbody>${locked}</table></div>
    <p class="pp-none small" hidden>No predictions match these filters in this game.</p>
    ${gate}
  </section>`;
  }).join("\n");
}

/** The predictions board (kept under this name for /api/props-nba). */
export const renderPanels = (board, opts = {}) => (!board || !sortedGames(board).length ? EMPTY_HTML : renderCards(board, opts));

/** A player's own predictions table (player pages): market rows, no name column. keys: allowed player|market keys, null = all. */
export function playerPredictions(p, { keys = null } = {}) {
  const rows = [];
  let locked = 0;
  for (const [stat] of STATS) {
    const s = statOf(p, stat);
    if (!s) continue;
    if (keys && !keys.has(predKey(p, stat))) { locked++; continue; }
    rows.push({ ...p, s, stat, light: lightOf(s.p) });
  }
  rows.sort((a, b) => LIGHT_RANK[a.light] - LIGHT_RANK[b.light] || b.s.p - a.s.p || STAT_RANK[a.stat] - STAT_RANK[b.stat]);
  return { rows, locked, html: rows.length ? `<div class="pp-scroll"><table class="pp-table pp-player-table">${HEAD_NO_NAME}<tbody class="pp-rows">${rows.map((r) => predictionRow(r, { name: false })).join("")}</tbody></table></div>` : "" };
}

/** Markets with at least one prediction on the board, in tab order. */
export const marketsOn = (board) => STATS.filter(([id]) => hasStat(board, id));

export function teamsOf(board) {
  const set = new Set();
  for (const g of sortedGames(board)) {
    for (const t of [g.away, g.home]) if (t) set.add(t);
    for (const p of g.players || []) if (p.team && !isHiddenStatus(p)) set.add(p.team);
  }
  return [...set].sort();
}
