// NBA props, data only: hit-rate heatmap (on /props/nba) and player pages (/props/nba/player/<id>).
// Reads only the nba-props board already loaded by nba-props.js (Supabase tips_page_snapshot
// id="nba-props", or the sample fixture). No odds calls, no projections, no calls, no prices.
//
// Today's snapshot has, per player: player, team, status, notes and per-market season_avg + line.
// Hit rates, last-10 form and the game-by-game chart need a per-player game log, which the
// snapshot does not have yet. Every piece built on it is hidden until it arrives. Expected shape:
//   players[].game_log = [{ date: "2026-11-14", opp: "DEN", home: true,
//                           points: 31, rebounds: 5, assists: 6, threes: 3 }, ...]   (whole season)
// players[].player_id, when present, is used for the page URL; otherwise a slug of the name.
import { esc, slug, NBA_TEAMS } from "./site.js";
import { STATS, sortedGames, isHiddenStatus, statusLabel, statOf, preparePlayers, freePicks, startLabel, playerId, playerPath } from "./nba-props.js";
export { playerId, playerPath };

export const MARKETS = STATS; // [["points","Points"], ...]
export const SHORT = { points: "PTS", rebounds: "REB", assists: "AST", threes: "3PM" };
export const CHART_GAMES = 15;
const num = (x) => (x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));

// ------------------------------------------------------------------ ids and lookup

const TEAM_ABBR = Object.fromEntries(Object.entries(NBA_TEAMS).map(([a, n]) => [n.toLowerCase(), a]));
export function teamAbbr(name) {
  const n = String(name || "").trim();
  if (!n) return "";
  const hit = TEAM_ABBR[n.toLowerCase()];
  if (hit) return hit;
  const nick = n.split(/\s+/).pop().toLowerCase();
  const byNick = Object.entries(NBA_TEAMS).filter(([, full]) => full.toLowerCase().endsWith(" " + nick));
  return byNick.length === 1 ? byNick[0][0] : n.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 4);
}

/** Every listed player on the board (hidden statuses dropped), with their game attached. */
export function boardPlayers(board) {
  const out = [];
  for (const g of sortedGames(board)) {
    for (const p of g.players || []) {
      if (!p || !p.player || isHiddenStatus(p)) continue;
      out.push({ ...p, id: playerId(p), game: g });
    }
  }
  return out;
}

export function findPlayer(board, id) {
  const want = slug(String(id || ""));
  if (!want) return null;
  return boardPlayers(board).find((p) => p.id === want) || null;
}

/** Ids shown to everyone: the free-view players of every stat tab (same rule as the board). */
export function publicIds(board) {
  const ids = new Set();
  for (const g of sortedGames(board)) {
    const teams = [g.away, g.home].filter(Boolean);
    for (const [stat] of MARKETS) {
      const all = preparePlayers(g.players, stat);
      for (const p of all) if (p.team && !teams.includes(p.team)) teams.push(p.team);
      for (const p of freePicks(all, teams)) ids.add(playerId(p));
    }
  }
  return ids;
}

// ------------------------------------------------------------------ game log and hit rates
/** The player's game log, newest first, rows with a parseable date. [] when the snapshot has none. */
export function gameLog(p) {
  const log = p && Array.isArray(p.game_log) ? p.game_log : [];
  return log
    .filter((r) => r && Number.isFinite(Date.parse(r.date || "")))
    .slice()
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

/** Today's line for a market, or null. */
export function lineOf(p, market) {
  const s = p && p.stats && p.stats[market];
  if (s && num(s.line) != null) return num(s.line);
  const legacy = statOf(p, market);
  return legacy ? legacy.line : null;
}

export function seasonAvgOf(p, market) {
  const s = p && p.stats && p.stats[market];
  if (s && num(s.season_avg) != null) return num(s.season_avg);
  const legacy = statOf(p, market);
  return legacy ? legacy.avg : null;
}

/**
 * Share of games over today's line: { over, n, rate } over the newest `last` games (all games when
 * last is null). null when there is no line or no game with this market in the window.
 */
export function hitRate(p, market, last = null, log = gameLog(p)) {
  const line = lineOf(p, market);
  if (line == null) return null;
  const rows = (last ? log.slice(0, last) : log).map((r) => num(r[market])).filter((v) => v != null);
  if (!rows.length) return null;
  const over = rows.filter((v) => v > line).length;
  return { over, n: rows.length, rate: over / rows.length };
}

export const boardHasLogs = (board) => boardPlayers(board).some((p) => gameLog(p).length > 0);

/** Heat band 0 (cold, red) … 4 (hot, green); "na" with no data. */
export function heatBand(h) {
  if (!h) return "na";
  const r = h.rate;
  return r >= 0.8 ? 4 : r >= 0.6 ? 3 : r >= 0.4 ? 2 : r >= 0.2 ? 1 : 0;
}

const pct = (h) => (h ? `${Math.round(h.rate * 100)}%` : "—");
const frac = (h) => (h ? `${h.over}/${h.n}` : "");
const one = (x) => (x == null ? "—" : Number(x).toFixed(1));

// ------------------------------------------------------------------ heatmap (/props/nba)
function heatCell(h, market, win) {
  const b = heatBand(h);
  const label = h ? `${pct(h)} (${frac(h)} over the line)` : "no data";
  return `<td class="hm-c hm-${b}" data-m="${market}" data-w="${win}" data-v="${h ? h.rate.toFixed(3) : ""}" title="${esc(label)}">${h ? `${pct(h)}<small>${frac(h)}</small>` : "—"}</td>`;
}

/**
 * Hit-rate heatmap: rows players, columns Points/Rebounds/Assists/Threes × last 5 / last 10.
 * Returns "" when no player on the board has a game log (the section is hidden).
 * ids: only these player ids get a row (free view); null = everyone (members).
 */
export function renderHeatmap(board, { ids = null } = {}) {
  if (!board || !boardHasLogs(board)) return "";
  const players = boardPlayers(board).filter((p) => !ids || ids.has(p.id));
  if (!players.length) return "";
  const rows = players.map((p) => {
    const log = gameLog(p);
    const g = p.game;
    const cells = MARKETS.map(([m]) => heatCell(hitRate(p, m, 5, log), m, 5) + heatCell(hitRate(p, m, 10, log), m, 10)).join("");
    return `<tr data-game="${esc(g.event_id || "")}" data-team="${esc(p.team || "")}" data-name="${esc(p.player)}">
      <th scope="row" class="hm-pl"><a href="${esc(playerPath(p))}">${esc(p.player)}</a><span class="hm-tm mono">${esc(teamAbbr(p.team))}</span></th>${cells}</tr>`;
  }).join("");
  const top = MARKETS.map(([m, label]) => `<th scope="colgroup" colspan="2" class="hm-mk" data-m="${m}">${esc(label)}</th>`).join("");
  const sub = MARKETS.map(([m]) => `<th scope="col" class="hm-w" data-m="${m}">L5</th><th scope="col" class="hm-w" data-m="${m}">L10</th>`).join("");
  return `<table class="hm-table"><thead><tr><th scope="col" rowspan="2" class="hm-pl">Player</th>${top}</tr><tr>${sub}</tr></thead><tbody>${rows}</tbody></table>`;
}

/** Filter bar + legend + table wrapper for the heatmap. "" when there is nothing to show. */
export function renderHeatmapSection(board, opts = {}) {
  const table = renderHeatmap(board, opts);
  if (!table) return "";
  const games = sortedGames(board);
  const teams = [...new Set(boardPlayers(board).map((p) => p.team).filter(Boolean))].sort();
  const sel = (id, label, opts) => `<label class="pp-team-filter">${label}<select id="${id}">${opts}</select></label>`;
  const sortOpts = [["name", "Player A–Z"], ["team", "Team"], ...MARKETS.flatMap(([m, l]) => [[`${m}-5`, `${l} L5 high–low`], [`${m}-10`, `${l} L10 high–low`]])];
  return `<section class="panel hm" id="hitRates" aria-labelledby="hmTitle">
    <h2 id="hmTitle">Hit rates</h2>
    <p class="small">Share of each player's last 5 and last 10 games over today's line. Tap a name for the full game log.</p>
    <div class="game-filter-bar hm-filters" role="region" aria-label="Hit rate filters"><div class="game-filters">
      ${sel("hmGame", "Game", `<option value="">All games</option>${games.map((g) => `<option value="${esc(g.event_id || "")}">${esc(g.away || "")} @ ${esc(g.home || "")}</option>`).join("")}`)}
      ${sel("hmTeam", "Team", `<option value="">All teams</option>${teams.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}`)}
      ${sel("hmMarket", "Market", `<option value="">All markets</option>${MARKETS.map(([m, l]) => `<option value="${m}">${esc(l)}</option>`).join("")}`)}
      ${sel("hmSort", "Sort", sortOpts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join(""))}
    </div></div>
    <p class="hm-legend small mono" aria-hidden="true"><span class="hm-4">80%+</span><span class="hm-3">60–79%</span><span class="hm-2">40–59%</span><span class="hm-1">20–39%</span><span class="hm-0">under 20%</span><span class="hm-na">no data</span></p>
    <div class="hm-scroll" tabindex="0" role="region" aria-label="Hit rate table, scrolls sideways">${table}</div>
    <p class="hm-none small" hidden>No players match these filters.</p>
  </section>`;
}

// ------------------------------------------------------------------ player page body
function barChart(p, market, log) {
  const line = lineOf(p, market);
  const games = log.filter((r) => num(r[market]) != null).slice(0, CHART_GAMES).reverse(); // oldest → newest
  if (line == null || !games.length) return "";
  const vals = games.map((r) => num(r[market]));
  const max = Math.max(line, ...vals) * 1.15 || 1;
  const W = 600, H = 220, padL = 30, padB = 34, padT = 12;
  const plotH = H - padB - padT;
  const bw = (W - padL) / games.length;
  const y = (v) => padT + plotH - (v / max) * plotH;
  const bars = games.map((r, i) => {
    const v = vals[i];
    const over = v > line;
    const x = padL + i * bw + bw * 0.15;
    const d = new Date(r.date);
    const lbl = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
    return `<g><rect class="${over ? "bc-over" : "bc-under"}" x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${(padT + plotH - y(v)).toFixed(1)}"><title>${esc(r.date)} ${r.home === false ? "@" : "vs"} ${esc(r.opp || "")}: ${v}</title></rect>
      <text class="bc-v" x="${(x + bw * 0.35).toFixed(1)}" y="${(y(v) - 4).toFixed(1)}" text-anchor="middle">${v}</text>
      <text class="bc-x" x="${(x + bw * 0.35).toFixed(1)}" y="${H - 18}" text-anchor="middle">${esc(lbl)}</text>
      <text class="bc-x" x="${(x + bw * 0.35).toFixed(1)}" y="${H - 5}" text-anchor="middle">${esc(String(r.opp || "").slice(0, 4))}</text></g>`;
  }).join("");
  const ly = y(line).toFixed(1);
  const label = MARKETS.find(([m]) => m === market)[1];
  return `<figure class="bc" data-m="${market}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}, last ${games.length} games against today's line of ${line}" preserveAspectRatio="xMidYMid meet">
      ${bars}
      <line class="bc-line" x1="${padL}" x2="${W}" y1="${ly}" y2="${ly}" />
      <text class="bc-ll" x="2" y="${(Number(ly) + 4).toFixed(1)}">${line}</text>
    </svg>
    <figcaption class="small">${esc(label)}, last ${games.length} games. Dashed line: today's line (${line}). <span class="bc-k bc-over-k">Over</span> <span class="bc-k bc-under-k">Under</span></figcaption>
  </figure>`;
}

/** Everything on a player's page under the header. Pieces without data are left out. */
export function renderPlayerBody(p, { teamHref = null } = {}) {
  const g = p.game || {};
  const log = gameLog(p);
  const markets = MARKETS.filter(([m]) => lineOf(p, m) != null || seasonAvgOf(p, m) != null);
  const opp = p.team && g.home === p.team ? g.away : g.home;
  const vs = p.team && g.home === p.team ? "vs" : "@";
  const status = statusLabel(p);
  const when = startLabel(g.commence_utc || g.commence_syd);

  const today = `<section class="panel pl-today"><h2>Today</h2><ul class="pl-facts">
    ${p.team ? `<li><span>Team</span><b>${teamHref ? `<a href="${esc(teamHref)}">${esc(p.team)}</a>` : esc(p.team)}</b></li>` : ""}
    ${opp ? `<li><span>Game</span><b>${vs} ${esc(opp)}</b></li>` : ""}
    ${when ? `<li><span>Starts</span><b class="mono">${esc(when)}</b></li>` : ""}
    ${status ? `<li><span>Status</span><b><span class="injury-watch pp-injury" role="note"${p.notes ? ` title="${esc(p.notes)}"` : ""}><span class="injury-watch-label">⚠️ ${esc(status)}</span><span class="injury-watch-note">Minutes uncertain</span></span></b></li>` : ""}
  </ul></section>`;

  const avgs = markets.length ? `<section class="panel"><h2>Season averages</h2>
    <div class="pl-tiles">${markets.map(([m, l]) => `<div class="pl-tile"><span class="k">${esc(l)}</span><b class="mono">${one(seasonAvgOf(p, m))}</b><span class="s mono">Today's line ${one(lineOf(p, m))}</span></div>`).join("")}</div>
  </section>` : "";

  const last10 = log.slice(0, 10);
  const form = last10.length ? `<section class="panel"><h2>Last ${last10.length} games</h2>
    <div class="pp-scroll"><table class="pl-log"><thead><tr><th scope="col">Date</th><th scope="col">Opp</th>${MARKETS.map(([m]) => `<th scope="col" class="num">${SHORT[m]}</th>`).join("")}</tr></thead><tbody>
    ${last10.map((r) => `<tr><td class="mono">${esc(r.date)}</td><td>${r.home === false ? "@" : "vs"} ${esc(r.opp || "")}</td>${MARKETS.map(([m]) => {
      const v = num(r[m]); const line = lineOf(p, m);
      const cls = v == null || line == null ? "" : v > line ? " over" : " under";
      return `<td class="num${cls}">${v == null ? "—" : v}</td>`;
    }).join("")}</tr>`).join("")}
    </tbody></table></div>
    <p class="small">Green: over today's line. Red: at or under it.</p>
  </section>` : "";

  const charts = log.length ? markets.map(([m]) => barChart(p, m, log)).filter(Boolean) : [];
  const chartMarkets = markets.filter(([m]) => log.length && barChart(p, m, log));
  const chart = charts.length ? `<section class="panel pl-chart"><h2>Game by game</h2>
    <div class="pp-tabs" role="tablist" aria-label="Market">${chartMarkets.map(([m, l], i) => `<button type="button" role="tab" class="pp-tab pl-ctab" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-m="${m}">${esc(l)}</button>`).join("")}</div>
    ${charts.map((c, i) => (i === 0 ? c : c.replace('<figure class="bc"', '<figure class="bc" hidden'))).join("")}
  </section>` : "";

  const rates = log.length ? markets.map(([m, l]) => [l, hitRate(p, m, 5, log), hitRate(p, m, 10, log), hitRate(p, m, null, log), lineOf(p, m)]).filter((r) => r[1] || r[2] || r[3]) : [];
  const hits = rates.length ? `<section class="panel"><h2>Hit rates</h2>
    <div class="pp-scroll"><table class="pl-hits"><thead><tr><th scope="col">Market</th><th scope="col" class="num">Line</th><th scope="col" class="num">Last 5</th><th scope="col" class="num">Last 10</th><th scope="col" class="num">Season</th></tr></thead><tbody>
    ${rates.map(([l, h5, h10, hs, line]) => `<tr><th scope="row">${esc(l)}</th><td class="num mono">${one(line)}</td>${[h5, h10, hs].map((h) => `<td class="num hm-c hm-${heatBand(h)}">${pct(h)}<small>${frac(h)}</small></td>`).join("")}</tr>`).join("")}
    </tbody></table></div>
    <p class="small">Share of games over today's line.</p>
  </section>` : "";

  return [today, avgs, form, chart, hits].filter(Boolean).join("\n");
}
