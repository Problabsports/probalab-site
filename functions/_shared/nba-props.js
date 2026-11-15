// NBA player props board: projections only (no prices, no tips, no units, no records).
// Data: data/nba_points_props/board.json, written by the mini PC job. The raw file is
// members-only (functions/data/nba_points_props/[[path]].js); this module reads it through
// ASSETS on the server and renders either the free view (top FREE_PER_GAME players per game
// by projection, at least one per team; the rest blurred placeholders with no real data) or
// the full board for members.
//
// Per-player data shape (one block per stat; add rebounds/assists/threes later, no redesign):
//   { player, team, status, notes,
//     stats: { points:   { season_avg, line, proj, sigma, p_over, p_under },
//              rebounds: {...}, assists: {...}, threes: {...} } }
// Older boards with proj_pts / primary_line still render for points (see statOf).
import { esc, chip } from "./site.js";

export const BOARD_PATH = "/data/nba_points_props/board.json";
export const FREE_PER_GAME = 3;
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
// Reserved for a later "Book line / price / Best value" column. Off until prices exist.
export const SHOW_BOOK_COLUMN = false;

const UNCERTAIN = /^(gtd|game[- ]time|questionable|doubtful|out|day[- ]to[- ]day)/i;

export async function loadBoard(ctx) {
  try {
    const r = await ctx.env.ASSETS.fetch(new URL(BOARD_PATH, ctx.request.url));
    if (!r.ok) return null;
    const b = await r.json();
    return b && Array.isArray(b.games) ? b : null;
  } catch (_) {
    return null;
  }
}

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

export function isUncertain(player) {
  return UNCERTAIN.test(String((player && player.status) || "").trim());
}

/** Players with this stat, strongest call first. Players without data for the stat are dropped. */
export function preparePlayers(players, stat = "points") {
  return (players || [])
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
  const t = (g) => Date.parse(g.commence_syd || "") || Infinity;
  return ((board && board.games) || []).slice().sort((a, b) => t(a) - t(b));
}

export function hasStat(board, stat) {
  return sortedGames(board).some((g) => (g.players || []).some((p) => statOf(p, stat)));
}

const fmt = (iso, opts) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", { timeZone: TZ, ...opts }).format(d);
};
const clock = { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" };
export const startLabel = (iso) => fmt(iso, clock).replace(/\s?(am|pm)/i, (m) => m.trim().toLowerCase());
export const updatedLabel = startLabel;
export const dayLabel = (iso) => fmt(iso, { weekday: "long", day: "numeric", month: "long" });

export function boardStats(board, stat = "points") {
  const games = sortedGames(board);
  const players = games.reduce((n, g) => n + preparePlayers(g.players, stat).length, 0);
  return { games: games.length, players, day: games.length ? dayLabel(games[0].commence_syd) : "" };
}

const nick = (team) => String(team || "").trim().split(/\s+/).pop();
const one = (x) => (x == null ? "—" : x.toFixed(1));

function playerRow(p) {
  const s = p.s;
  const light = lightOf(s.p);
  const status = String(p.status || "").trim();
  const warn = isUncertain(p)
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
  // Placeholder only: no real names or numbers are sent to non-members.
  return `<tr class="pp-locked-row" aria-hidden="true"><th scope="row" class="pl"><span class="pp-name">Member player</span></th><td class="num">00.0</td><td class="num">00.5</td><td class="num">00.0</td><td class="call">Over 00%</td><td class="lt"><span class="chip">●●●</span></td></tr>`;
}

const HEAD = `<thead><tr><th scope="col" class="pl">Player</th><th scope="col" class="num">Avg</th><th scope="col" class="num">Line</th><th scope="col" class="num">Our projection</th><th scope="col" class="call">Call</th>${SHOW_BOOK_COLUMN ? '<th scope="col" class="book">Book line · price</th>' : ""}<th scope="col" class="lt"><span class="sr-only">Light</span></th></tr></thead>`;

/** One card per game for one stat. full=false keeps only the free picks. */
export function renderCards(board, { full = false, stat = "points" } = {}) {
  const games = sortedGames(board);
  if (!games.length || !hasStat(board, stat)) return `<section class="panel"><p>No player props on the board yet. Check back closer to tip-off.</p></section>`;
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
      ? `<div class="pp-gate"><a class="btn pp-join" href="/join">Members see every player</a><p class="small">${hidden} more player${hidden === 1 ? "" : "s"} in this game. Already a member? <a href="/members">Sign in</a>, then come back to this page.</p></div>`
      : "";
    return `<section class="panel pp-game" data-teams="${esc(teams.join("|"))}">
    <header class="pp-head"><h2>${esc(g.away || "")} @ ${esc(g.home || "")}</h2><p class="pp-when mono">${esc(startLabel(g.commence_syd))}</p></header>
    <div class="pp-scroll"><table class="pp-table">${HEAD}<tbody class="pp-rows">${rows.map(playerRow).join("")}</tbody>${locked}</table></div>
    <p class="pp-none small" hidden>No players match these filters in this game.</p>
    ${gate}
  </section>`;
  }).join("\n");
}

/** Tab panels for every stat; stats without data show "Coming soon". */
export function renderPanels(board, { full = false } = {}) {
  return STATS.map(([id, label], i) => {
    const body = board && hasStat(board, id)
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
    for (const p of g.players || []) if (p.team) set.add(p.team);
  }
  return [...set].sort();
}
