// NFL and NHL player props boards (/props/nfl, /props/nhl). DATA ONLY: bookie prices and player form.
// No tips, no units, no edge, no fair price, no model chance.
//
// Data: Supabase public.tips_page_snapshot id "nfl-props" / "nhl-props", uploaded by the mini PC jobs
// (ClosingLine\nfl_props, \nhl_props: schema "props-board-v1") through the members-auth-admin edge function
// (action upload_props; the mini holds no service-role key). Read here on the server with the site's own key.
//   * a fresh row (< 36 h) is the real board, even when it has no games yet (then the empty message shows);
//   * no row at all (job not set up) -> the members-only sample fixture /data/<sport>_props/board.json, marked sample.
//
// Board row (one per player x market):
//   { player, team, team_abbr, position, market, kind: "ou"|"yes", line,
//     books: [{key, name, over, under}] | [{key, name, yes, implied}],   // Sportsbet first
//     log: [{date, opp, ha, v}] (last 8, newest first), season: {gp, avg},
//     hits: {l5|l10|season: {n, over, under}}   (ou)   |   rates: {l8|season: {n, yes}}   (yes) }
//
// Lights here are the player's SEASON hit rate against today's line, on the props scale (60%+ green, 55-59% orange,
// under 55% red), shown with the side (Over / Under). They describe what happened, not what will happen.
import { esc, chip, slug } from "./site.js";
import { supabaseAdmin } from "./membership.js";
import { memberButtons, startLabel, updatedLabel, dayLabel, shortDay, FREE_PER_GAME } from "./nba-props.js";

export const SPORTS = {
  nfl: {
    name: "NFL", snapshot: "nfl-props", sample: "/data/nfl_props/board.json", start: "kick-off",
    markets: [["player_pass_yds", "Passing yards"], ["player_rush_yds", "Rushing yards"], ["player_reception_yds", "Receiving yards"], ["player_anytime_td", "Anytime TD"]],
    empty: "No NFL player props posted yet. Lines usually appear about a day before kick-off.",
  },
  nhl: {
    name: "NHL", snapshot: "nhl-props", sample: "/data/nhl_props/board.json", start: "puck drop",
    markets: [["player_shots_on_goal", "Shots on goal"], ["player_goal_scorer_anytime", "Anytime goal scorer"]],
    empty: "No NHL player props posted yet. Lines usually appear about a day before puck drop.",
  },
};
export const MAX_AGE_MS = 36 * 3600 * 1000;
export const STARTED_HIDE_MS = 3 * 3600 * 1000;
export const MIN_GAMES_FOR_LIGHT = 5;
const CACHE_MS = 60 * 1000;

// ------------------------------------------------------------------ loading
const rowCache = new Map(); // snapshot id -> { at, row }
export const _resetSportBoardCache = () => rowCache.clear();

async function readRow(env, id, now) {
  const hit = rowCache.get(id);
  if (hit && now - hit.at >= 0 && now - hit.at < CACHE_MS) return hit.row;
  let row = null;
  try {
    const rows = await supabaseAdmin(env, "GET", `/rest/v1/tips_page_snapshot?select=payload,generated_at&id=eq.${id}`);
    row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.log(`sport-props: ${id} read failed (${(e && e.status) || "no response"})`);
  }
  rowCache.set(id, { at: now, row });
  return row;
}

/** A row counts as the real board when it is a props-board payload under 36 h old (games may be empty). */
export function realSportBoard(row, now = Date.now()) {
  const p = row && row.payload;
  if (!p || typeof p !== "object" || p.sample === true || !Array.isArray(p.games)) return null;
  const t = Date.parse(p.generated_at || row.generated_at || "");
  if (!Number.isFinite(t) || now - t >= MAX_AGE_MS) return null;
  return { ...p, sample: false };
}

export function dropStartedGames(board, now = Date.now()) {
  if (!board) return board;
  return { ...board, games: (board.games || []).filter((g) => { const t = Date.parse(g.commence_utc || ""); return !Number.isFinite(t) || now - t <= STARTED_HIDE_MS; }) };
}

export async function loadSportBoard(ctx, sport, opts = {}) {
  const S = SPORTS[sport];
  const now = opts.now ?? ctx.now ?? Date.now();
  let board = realSportBoard(await readRow(ctx.env || {}, S.snapshot, now), now);
  if (!board) {
    try {
      const r = await ctx.env.ASSETS.fetch(new URL(S.sample, ctx.request.url));
      const b = r.ok ? await r.json() : null;
      board = b && Array.isArray(b.games) ? { ...b, sample: true } : null;
    } catch (_) { board = null; }
  }
  return board ? dropStartedGames(board, now) : { sport, games: [], sample: false };
}

// ------------------------------------------------------------------ data helpers
const num = (x) => (x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
const price = (x) => (num(x) == null ? "—" : Number(x).toFixed(2));
const pct0 = (x) => `${Math.round(x * 100)}%`;
const lineTxt = (x) => (num(x) == null ? "—" : Number(x).toFixed(1));

/** Props-scale light for a rate (rounded % shown decides the colour). */
export function rateLight(rate) {
  if (rate == null) return "";
  const p = Math.round(rate * 100);
  return p >= 60 ? "GREEN" : p >= 55 ? "ORANGE" : "RED";
}

/** Season hit-rate light for an O/U row: the side that cleared today's line more often, and how often. */
export function hitLight(row) {
  const s = row && row.hits && row.hits.season;
  if (!s || s.n < MIN_GAMES_FOR_LIGHT) return { light: "", side: "", rate: null };
  const side = s.over >= s.under ? "Over" : "Under";
  const rate = (side === "Over" ? s.over : s.under) / s.n;
  return { light: rateLight(rate), side, rate };
}

/** Sportsbet's prices, and the best other book's (highest price per side, may be two different books). */
export function bookSplit(row) {
  const books = row.books || [];
  const sb = books.find((b) => b.key === "sportsbet") || null;
  const others = books.filter((b) => b.key !== "sportsbet");
  const best = (side) => others.reduce((a, b) => (num(b[side]) != null && (!a || b[side] > a[side]) ? b : a), null);
  return row.kind === "yes" ? { sb, yes: best("yes") } : { sb, over: best("over"), under: best("under") };
}

export const marketLabel = (sport, key) => (SPORTS[sport].markets.find(([k]) => k === key) || [key, key])[1];
const marketRank = (sport, key) => { const i = SPORTS[sport].markets.findIndex(([k]) => k === key); return i < 0 ? 99 : i; };

export function sortedGames(board) {
  return (board.games || []).filter((g) => (g.props || []).length).slice().sort((a, b) => String(a.commence_utc).localeCompare(String(b.commence_utc)));
}

/** Free view: top FREE_PER_GAME players per market per game (O/U: highest season average; anytime: shortest Sportsbet / first price). */
export function freeRowKeys(g, n = FREE_PER_GAME) {
  const keys = new Set();
  const by = {};
  for (const r of g.props || []) (by[r.market] ||= []).push(r);
  for (const rows of Object.values(by)) {
    const ranked = rows.slice().sort((a, b) => {
      if (a.kind === "yes") return (num((a.books[0] || {}).yes) ?? 99) - (num((b.books[0] || {}).yes) ?? 99);
      return (num(b.season && b.season.avg) ?? -1) - (num(a.season && a.season.avg) ?? -1);
    });
    ranked.slice(0, n).forEach((r) => keys.add(`${r.player}|${r.market}`));
  }
  return keys;
}

/** Rows for display: market order, then lit rows first (green, orange, red), then by season average. */
function orderRows(sport, rows) {
  const lr = { GREEN: 0, ORANGE: 1, RED: 2, "": 3 };
  return rows.slice().sort((a, b) => marketRank(sport, a.market) - marketRank(sport, b.market)
    || lr[hitLight(a).light] - lr[hitLight(b).light]
    || (num(b.season && b.season.avg) ?? -1) - (num(a.season && a.season.avg) ?? -1)
    || String(a.player).localeCompare(String(b.player)));
}

// ------------------------------------------------------------------ pieces
export function teamLogo(sport, team, abbr) {
  if (!team) return "";
  const src = `/img/logos/${sport}/${slug(team)}.png`;
  return `<img class="pp-logo" src="${esc(src)}" alt="" width="22" height="22" loading="lazy" decoding="async" data-abbr="${esc(abbr || "")}" onerror="var s=document.createElement('span');s.className='pp-logo-fb';s.textContent=this.dataset.abbr||'';this.replaceWith(s)">`;
}

/** Last-8 chart: oldest to newest, bars green above the line / red below, dashed line at today's line.
    Anytime markets: one dot per game, filled when the player scored. */
export function formChart(row) {
  const log = (row.log || []).slice(0, 8).reverse();
  if (!log.length) return `<span class="pp-nochart">No games yet</span>`;
  const W = 96, H = 30, gap = 2, bw = (W - gap * (log.length - 1)) / log.length;
  const label = row.kind === "yes"
    ? `Last ${log.length}: scored in ${log.filter((g) => g.v >= 1).length}`
    : `Last ${log.length} against ${lineTxt(row.line)}: ${log.map((g) => g.v).join(", ")}`;
  if (row.kind === "yes") {
    const dots = log.map((g, i) => `<circle cx="${(i * (bw + gap) + bw / 2).toFixed(1)}" cy="${H / 2}" r="${Math.min(5, bw / 2 - 0.5).toFixed(1)}" class="${g.v >= 1 ? "pf-hit" : "pf-miss"}"/>`).join("");
    return `<svg class="pp-form" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">${dots}</svg>`;
  }
  const line = num(row.line) ?? 0;
  const max = Math.max(line, ...log.map((g) => num(g.v) ?? 0)) * 1.1 || 1;
  const y = (v) => H - (v / max) * (H - 2);
  const bars = log.map((g, i) => { const v = num(g.v) ?? 0;
    return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - y(v)).toFixed(1)}" class="${v > line ? "pf-over" : v < line ? "pf-under" : "pf-push"}"><title>${esc(g.date || "")} ${g.ha === "A" ? "@" : "v"} ${esc(g.opp || "")}: ${esc(String(g.v))}</title></rect>`; }).join("");
  return `<svg class="pp-form" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">${bars}<line x1="0" x2="${W}" y1="${y(line).toFixed(1)}" y2="${y(line).toFixed(1)}" class="pf-line"/></svg>`;
}

const rateCell = (c, side) => {
  if (!c || !c.n) return `<td class="num pp-hit">—</td>`;
  const k = side === "Under" ? c.under : side === "yes" ? c.yes : c.over;
  const lt = side === "yes" ? "" : rateLight(k / c.n);   // each cell coloured by its own rate; scoring rates stay neutral
  return `<td class="num pp-hit${lt ? ` hl-${lt}` : ""}"><b>${pct0(k / c.n)}</b><small>${k}/${c.n}</small></td>`;
};

const bookCell = (b, side) => (b && num(b[side]) != null
  ? `<td class="num pp-price"><b>${price(b[side])}</b>${side === "yes" ? `<small>${pct0(1 / b.yes)} implied</small>` : ""}</td>`
  : `<td class="num pp-price">—</td>`);
const bestCell = (b, side) => (b && num(b[side]) != null
  ? `<td class="num pp-price"><b>${price(b[side])}</b><small>${esc(b.name)}${side === "yes" ? ` · ${pct0(1 / b.yes)}` : ""}</small></td>`
  : `<td class="num pp-price">—</td>`);

export const HEAD = `<thead><tr><th scope="col" class="pl">Player</th><th scope="col" class="mk">Market</th><th scope="col" class="num">Line</th>
  <th scope="col" class="num">Sportsbet<small>Over · Under</small></th><th scope="col" class="num">Best other<small>Over · Under</small></th>
  <th scope="col" class="pp-formh">Last 8</th><th scope="col" class="num">L5</th><th scope="col" class="num">L10</th><th scope="col" class="num">Season</th>
  <th scope="col" class="lt"><span class="sr-only">Light</span></th></tr></thead>`;

/** One row. O/U rows take two lines (Over, Under) in the price cells; hit rates show the season's stronger side. */
export function propRow(sport, r) {
  const who = `<th scope="row" class="pl">${teamLogo(sport, r.team, r.team_abbr)}<span class="pp-name">${esc(r.player)}</span> <span class="pp-tm">${esc(r.team_abbr || "")}${r.position ? ` · ${esc(r.position)}` : ""}</span></th>`;
  const mk = `<td class="mk">${esc(marketLabel(sport, r.market))}</td>`;
  const split = bookSplit(r);
  if (r.kind === "yes") {
    const rt = r.rates || {};
    return `<tr class="pp-row pp-yes" data-team="${esc(r.team || "")}" data-market="${esc(r.market)}" data-light="">
      ${who}${mk}<td class="num">Anytime</td>${bookCell(split.sb, "yes")}${bestCell(split.yes, "yes")}
      <td class="pp-formc">${formChart(r)}</td><td class="num pp-hit">—</td>${rt.l8 && rt.l8.n ? `<td class="num pp-hit"><b>${pct0(rt.l8.yes / rt.l8.n)}</b><small>${rt.l8.yes}/${rt.l8.n} last ${rt.l8.n}</small></td>` : `<td class="num pp-hit">—</td>`}${rateCell(rt.season, "yes")}
      <td class="lt"><span class="pp-ratelab">Scored</span></td></tr>`;
  }
  const hl = hitLight(r);
  const side = hl.side || "Over";
  const sb = split.sb;
  const two = (a, b) => `<td class="num pp-price pp-ou"><span><b>${price(a && a.over)}</b><b>${price(b && b.under)}</b></span>${a && b && a !== b ? `<small>${esc(a.name)} · ${esc(b.name)}</small>` : a ? `<small>${esc(a.name)}</small>` : ""}</td>`;
  return `<tr class="pp-row lt-${hl.light || "none"}" data-team="${esc(r.team || "")}" data-market="${esc(r.market)}" data-light="${hl.light}">
      ${who}${mk}<td class="num">${lineTxt(r.line)}</td>
      <td class="num pp-price pp-ou"><span><b>${price(sb && sb.over)}</b><b>${price(sb && sb.under)}</b></span></td>
      ${two(split.over, split.under)}
      <td class="pp-formc">${formChart(r)}</td>${rateCell(r.hits && r.hits.l5, side)}${rateCell(r.hits && r.hits.l10, side)}${rateCell(r.hits && r.hits.season, side)}
      <td class="lt">${hl.light ? `${chip(hl.light)}<span class="pp-ratelab">${side}</span>` : `<span class="pp-ratelab">${hl.side || "—"}</span>`}</td></tr>`;
}

const lockedRow = () => `<tr class="pp-row pp-locked-row" aria-hidden="true"><th scope="row" class="pl"><span class="pp-name">Member player</span></th><td class="mk">Market</td><td class="num">00.5</td><td class="num">0.00</td><td class="num">0.00</td><td></td><td class="num">00%</td><td class="num">00%</td><td class="num">00%</td><td class="lt"></td></tr>`;

export function teamsOfBoard(board) {
  const set = new Set();
  for (const g of sortedGames(board)) for (const t of [g.away, g.home]) if (t) set.add(t);
  return [...set].sort();
}
export function marketsOnBoard(sport, board) {
  const on = new Set(sortedGames(board).flatMap((g) => g.props.map((r) => r.market)));
  return SPORTS[sport].markets.filter(([k]) => on.has(k));
}
export function boardCounts(board) {
  const games = sortedGames(board);
  return { games: games.length, players: new Set(games.flatMap((g) => g.props.map((r) => r.player))).size,
    day: games.length ? dayLabel(games[0].commence_utc) : "" };
}

export const emptyHtml = (sport) => `<section class="panel pp-empty"><p>${esc(SPORTS[sport].empty)}</p></section>`;

/** All game cards. full=false keeps the free view and shows how many more rows members get. */
export function renderSportBoard(sport, board, { full = false } = {}) {
  const games = board ? sortedGames(board) : [];
  if (!games.length) return emptyHtml(sport);
  return games.map((g) => {
    const keys = full ? null : freeRowKeys(g);
    const all = orderRows(sport, g.props);
    const rows = full ? all : all.filter((r) => keys.has(`${r.player}|${r.market}`));
    const hidden = all.length - rows.length;
    const teams = [g.away, g.home].concat(g.props.map((r) => r.team)).filter(Boolean);
    return `<section class="panel pp-game" data-game="${esc(g.event_id || "")}" data-teams="${esc([...new Set(teams)].join("|"))}">
    <header class="pp-head"><h2>${teamLogo(sport, g.away, g.away_abbr)}${esc(g.away || "")} @ ${teamLogo(sport, g.home, g.home_abbr)}${esc(g.home || "")}</h2>
      <p class="pp-when mono">${esc(startLabel(g.commence_utc))}${g.prices_utc ? ` · prices ${esc(updatedLabel(g.prices_utc))}` : ""}</p></header>
    <div class="pp-scroll"><table class="pp-table pp-data">${HEAD}<tbody class="pp-rows">${rows.map((r) => propRow(sport, r)).join("")}</tbody>
      ${hidden > 0 ? `<tbody class="pp-locked" aria-hidden="true">${Array.from({ length: Math.min(hidden, 3) }, lockedRow).join("")}</tbody>` : ""}</table></div>
    <p class="pp-none small" hidden>No props match these filters in this game.</p>
    ${hidden > 0 ? `<div class="pp-gate"><p class="small">${hidden} more prop${hidden === 1 ? "" : "s"} in this game.</p>${memberButtons()}</div>` : ""}
  </section>`;
  }).join("\n");
}

/** Sport switch shown on every props page (NBA, NFL, NHL). */
export function propsSportNav(current) {
  const items = [["nba", "NBA"], ["nfl", "NFL"], ["nhl", "NHL"]];
  return `<nav class="pp-sports game-filters sports" aria-label="Props by sport">${items.map(([k, l]) =>
    k === current ? `<a class="gf-btn on" href="/props/${k}" aria-current="page">${l} props</a>` : `<a class="gf-btn" href="/props/${k}">${l} props</a>`).join("")}</nav>`;
}

export { shortDay, FREE_PER_GAME };
