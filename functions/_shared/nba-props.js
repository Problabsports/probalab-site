// NBA player points props board: model projections only (no prices, no tips, no records).
// Data: data/nba_points_props/board.json, written by the mini PC job. The raw file is
// members-only (functions/data/nba_points_props/[[path]].js); this module reads it through
// ASSETS on the server and renders either the free view (top FREE_PER_GAME players per game,
// the rest as blurred placeholders with no real data) or the full board for members.
import { esc } from "./site.js";

export const BOARD_PATH = "/data/nba_points_props/board.json";
export const FREE_PER_GAME = 3;
export const NEAREST_LINES = 3;
const TZ = "Australia/Sydney";
// Chance colours reuse the site's light colours. Props scale: green 60%+, orange 55–59%, red below 55%.
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
export const lightOf = (p) => (p == null ? "" : p >= GREEN_MIN ? "GREEN" : p >= ORANGE_MIN ? "ORANGE" : "RED");

/** The 2–3 half-point lines nearest the projection, each with its more likely side. */
export function nearestLines(player, n = NEAREST_LINES) {
  const proj = num(player && player.proj_pts);
  const all = ((player && player.lines) || [])
    .map((l) => ({ line: num(l.line), over: num(l.p_over), under: num(l.p_under) }))
    .filter((l) => l.line != null && (l.over != null || l.under != null));
  if (proj == null || !all.length) return [];
  return all
    .sort((a, b) => Math.abs(a.line - proj) - Math.abs(b.line - proj) || a.line - b.line)
    .slice(0, n)
    .sort((a, b) => a.line - b.line)
    .map((l) => {
      const over = l.over != null ? l.over : 1 - l.under;
      const under = l.under != null ? l.under : 1 - l.over;
      return over >= under ? { line: l.line, side: "Over", p: over } : { line: l.line, side: "Under", p: under };
    });
}

export function isUncertain(player) {
  return UNCERTAIN.test(String((player && player.status) || "").trim());
}

/** Players with display fields, sorted highest chance first (unprojected players last). */
export function preparePlayers(players) {
  return (players || []).map((p) => {
    const shown = nearestLines(p);
    const best = shown.length ? Math.max(...shown.map((l) => l.p)) : null;
    return { ...p, shown, best };
  }).sort((a, b) => (b.best ?? -1) - (a.best ?? -1) || String(a.player).localeCompare(String(b.player)));
}

export function sortedGames(board) {
  const t = (g) => Date.parse(g.commence_syd || "") || Infinity;
  return ((board && board.games) || []).slice().sort((a, b) => t(a) - t(b));
}

const fmt = (iso, opts) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", { timeZone: TZ, ...opts }).format(d);
};
export const startLabel = (iso) => fmt(iso, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" }).replace(/\s?(am|pm)/i, (m) => m.trim().toLowerCase());
export const updatedLabel = (iso) => fmt(iso, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" }).replace(/\s?(am|pm)/i, (m) => m.trim().toLowerCase());
export const dayLabel = (iso) => fmt(iso, { weekday: "long", day: "numeric", month: "long" });

export function boardStats(board) {
  const games = sortedGames(board);
  const players = games.reduce((n, g) => n + ((g.players || []).length), 0);
  return { games: games.length, players, day: games.length ? dayLabel(games[0].commence_syd) : "" };
}

function cell(l) {
  if (!l) return `<td class="ln ln-empty">—</td>`;
  const light = lightOf(l.p);
  return `<td class="ln"><span class="pp-chance ${light}" title="Model chance, not a bet">${esc(l.side)} ${l.line.toFixed(1)} <b>${pct(l.p)}</b></span></td>`;
}

const UNCERTAIN_NOTE = "Minutes are uncertain";

function playerRow(p) {
  const status = String(p.status || "").trim();
  const warn = isUncertain(p)
    ? `<span class="injury-watch pp-injury" role="note"><span class="injury-watch-label">⚠️ ${esc(status || "Injury watch")}</span><span class="injury-watch-note">${UNCERTAIN_NOTE}${p.notes ? ` — ${esc(p.notes)}` : "."}</span></span>`
    : "";
  const min = num(p.proj_min), pts = num(p.proj_pts);
  const cells = [];
  for (let i = 0; i < NEAREST_LINES; i++) cells.push(cell(p.shown[i]));
  const book = SHOW_BOOK_COLUMN ? `<td class="book"></td>` : "";
  const green = p.best != null && p.best >= GREEN_MIN;
  return `<tr data-best="${p.best == null ? "" : p.best.toFixed(3)}"${green ? ' data-green="1"' : ""}>
      <th scope="row" class="pl"><span class="pp-name">${esc(p.player)}</span>${warn}</th>
      <td class="num">${min == null || (min === 0 && !p.shown.length) ? "—" : min.toFixed(1)}</td>
      <td class="num">${pts == null || !p.shown.length ? "—" : pts.toFixed(1)}</td>
      ${cells.join("")}${book}
    </tr>`;
}

function lockedRow() {
  // Placeholder only: no real names or numbers are sent to non-members.
  const cells = Array.from({ length: NEAREST_LINES }, () => `<td class="ln"><span class="pp-chance">Over 00.5 <b>00%</b></span></td>`).join("");
  return `<tr class="pp-locked-row" aria-hidden="true"><th scope="row" class="pl"><span class="pp-name">Member player</span></th><td class="num">00.0</td><td class="num">00.0</td>${cells}</tr>`;
}

function teamTable(team, rows, lockedCount) {
  const head = `<thead><tr><th scope="col" class="pl">Player</th><th scope="col" class="num" title="Projected minutes">Proj min</th><th scope="col" class="num" title="Projected points">Proj pts</th><th scope="col" class="ln" colspan="${NEAREST_LINES}">Nearest lines · model chance</th>${SHOW_BOOK_COLUMN ? '<th scope="col" class="book">Book line · price</th>' : ""}</tr></thead>`;
  const body = rows.map(playerRow).join("");
  const locked = lockedCount > 0
    ? `<tbody class="pp-locked" aria-hidden="true">${Array.from({ length: lockedCount }, lockedRow).join("")}</tbody>`
    : "";
  return `<div class="pp-team" data-team="${esc(team)}">
    <h3>${esc(team)}</h3>
    <div class="pp-scroll"><table class="pp-table">${head}<tbody class="pp-rows">${body}</tbody>${locked}</table></div>
    <p class="pp-none small" hidden>No greens for ${esc(team)} in this game.</p>
  </div>`;
}

/** One card per game. full=false keeps only the top FREE_PER_GAME players per game. */
export function renderCards(board, { full = false } = {}) {
  const games = sortedGames(board);
  if (!games.length) return `<section class="panel"><p>No player props on the board yet. Check back closer to tip-off.</p></section>`;
  return games.map((g) => {
    const all = preparePlayers(g.players);
    const freeSet = new Set(all.slice(0, FREE_PER_GAME));
    const teams = [g.away, g.home].filter(Boolean);
    for (const p of all) if (p.team && !teams.includes(p.team)) teams.push(p.team);
    let hidden = 0;
    const tables = teams.map((team) => {
      const mine = all.filter((p) => p.team === team);
      const rows = full ? mine : mine.filter((p) => freeSet.has(p));
      const locked = mine.length - rows.length;
      hidden += locked;
      return teamTable(team, rows, locked);
    }).join("");
    const gate = !full && hidden > 0
      ? `<div class="pp-gate"><a class="btn pp-join" href="/join">Members see every player</a><p class="small">${hidden} more player${hidden === 1 ? "" : "s"} in this game. Already a member? <a href="/members">Sign in</a>, then come back to this page.</p></div>`
      : "";
    return `<section class="panel pp-game" data-teams="${esc(teams.join("|"))}">
    <header class="pp-head"><h2>${esc(g.away || "")} @ ${esc(g.home || "")}</h2><p class="pp-when mono">${esc(startLabel(g.commence_syd))}</p></header>
    ${tables}
    ${gate}
  </section>`;
  }).join("\n");
}

export function teamsOf(board) {
  const set = new Set();
  for (const g of sortedGames(board)) {
    for (const t of [g.away, g.home]) if (t) set.add(t);
    for (const p of g.players || []) if (p.team) set.add(p.team);
  }
  return [...set].sort();
}
