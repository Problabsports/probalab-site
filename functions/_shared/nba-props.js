// NBA player props board: projections only (no prices, no tips, no units, no records).
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
import { esc, chip } from "./site.js";
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

/** Strip counts: games on the board, and players with at least one stat (hidden statuses never counted). */
export function boardStats(board) {
  const games = sortedGames(board);
  const ids = STATS.map(([id]) => id);
  const players = games.reduce((n, g) => n + (g.players || []).filter((p) => !isHiddenStatus(p) && ids.some((id) => statOf(p, id))).length, 0);
  const first = games[0];
  return { games: games.length, players, day: first ? dayLabel(first.commence_utc || first.commence_syd) : "" };
}

// ------------------------------------------------------------------ rendering
const nick = (team) => String(team || "").trim().split(/\s+/).pop();
const one = (x) => (x == null ? "—" : x.toFixed(1));

function playerRow(p) {
  const s = p.s;
  const light = lightOf(s.p);
  const status = statusLabel(p);
  const warn = status
    ? ` <span class="injury-watch pp-injury" role="note" title="${esc(p.notes || "")}"><span class="injury-watch-label">⚠️ ${esc(status)}</span><span class="injury-watch-note">Minutes uncertain</span></span>`
    : "";
  const book = SHOW_BOOK_COLUMN ? `<td class="book"></td>` : "";
  return `<tr data-team="${esc(p.team || "")}" data-best="${s.p.toFixed(3)}"${light === "GREEN" ? ' data-green="1"' : ""}>
      <th scope="row" class="pl"><span class="pp-name">${esc(p.player)}</span> <span class="pp-tm">${esc(nick(p.team))}</span>${warn}</th>
      <td class="num">${one(s.avg)}</td>
      <td class="num">${one(s.line)}</td>
      <td class="num">${one(s.proj)}</td>
      <td class="call">${s.side} ${pct(s.p)}</td>${book}
      <td class="lt">${chip(light)}</td>
    </tr>`;
}

function lockedRow() {
  // Placeholder only: no real names, numbers or statuses are sent to non-members.
  return `<tr class="pp-locked-row" aria-hidden="true"><th scope="row" class="pl"><span class="pp-name">Member player</span></th><td class="num">00.0</td><td class="num">00.5</td><td class="num">00.0</td><td class="call">Over 00%</td><td class="lt"><span class="chip">●●●</span></td></tr>`;
}

const HEAD = `<thead><tr><th scope="col" class="pl">Player</th><th scope="col" class="num">Avg</th><th scope="col" class="num">Line</th><th scope="col" class="num">Our projection</th><th scope="col" class="call">Call</th>${SHOW_BOOK_COLUMN ? '<th scope="col" class="book">Book line · price</th>' : ""}<th scope="col" class="lt"><span class="sr-only">Light</span></th></tr></thead>`;

// Members sign-in returns to this page after login (members-lobby.js honours a same-site ?next=).
export const SIGNIN_URL = "/members?next=%2Fprops%2Fnba#memberSignIn";
/** Two equal buttons: Join members (primary) and Members sign in (secondary). */
export const memberButtons = (extra = "") =>
  `<div class="pp-cta${extra ? " " + extra : ""}"><a class="btn pp-join" href="/join">Join members</a><a class="btn pp-signin" href="${SIGNIN_URL}">Members sign in</a></div>`;

export const EMPTY_HTML =`<section class="panel pp-empty"><p>No player props on the board yet. Check back closer to tip-off.</p></section>`;

/** One card per game for one stat. full=false keeps only the free picks. */
export function renderCards(board, { full = false, stat = "points" } = {}) {
  const games = sortedGames(board);
  if (!games.length || !hasStat(board, stat)) return EMPTY_HTML;
  return games.map((g) => {
    const all = preparePlayers(g.players, stat);
    if (!all.length) return "";
    const teams = [g.away, g.home].filter(Boolean);
    for (const p of all) if (p.team && !teams.includes(p.team)) teams.push(p.team);
    const picks = full ? null : freePicks(all, teams);
    const rows = full ? all : all.filter((p) => picks.has(p));
    const hidden = all.length - rows.length;
    const locked = hidden > 0 ? `<tbody class="pp-locked" aria-hidden="true">${Array.from({ length: hidden }, lockedRow).join("")}</tbody>` : "";
    const gate = hidden > 0
      ? `<div class="pp-gate"><p class="small">${hidden} more player${hidden === 1 ? "" : "s"} in this game.</p>${memberButtons()}</div>`
      : "";
    return `<section class="panel pp-game" data-teams="${esc(teams.join("|"))}">
    <header class="pp-head"><h2>${esc(g.away || "")} @ ${esc(g.home || "")}</h2><p class="pp-when mono">${esc(startLabel(g.commence_utc || g.commence_syd))}</p></header>
    <div class="pp-scroll"><table class="pp-table">${HEAD}<tbody class="pp-rows">${rows.map(playerRow).join("")}</tbody>${locked}</table></div>
    <p class="pp-none small" hidden>No players match these filters in this game.</p>
    ${gate}
  </section>`;
  }).join("\n");
}

/** Tab panels for every stat. A stat with rows is live; a stat with none says "Coming soon". */
export function renderPanels(board, { full = false } = {}) {
  const empty = !board || !sortedGames(board).length;
  return STATS.map(([id, label], i) => {
    const body = empty
      ? EMPTY_HTML
      : hasStat(board, id)
        ? renderCards(board, { full, stat: id })
        : `<section class="panel pp-soon"><h2>${esc(label)}</h2><p>Coming soon.</p></section>`;
    return `<div class="pp-panel" id="pp-panel-${id}" role="tabpanel" aria-labelledby="pp-tab-${id}"${i === 0 ? "" : " hidden"}>${body}</div>`;
  }).join("\n");
}

export function renderTabs() {
  return `<div class="pp-tabs" role="tablist" aria-label="Stat">${STATS.map(([id, label], i) =>
    `<button type="button" role="tab" class="pp-tab" id="pp-tab-${id}" aria-controls="pp-panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-stat="${id}">${esc(label)}</button>`).join("")}</div>`;
}

export function teamsOf(board) {
  const set = new Set();
  for (const g of sortedGames(board)) {
    for (const t of [g.away, g.home]) if (t) set.add(t);
    for (const p of g.players || []) if (p.team && !isHiddenStatus(p)) set.add(p.team);
  }
  return [...set].sort();
}
