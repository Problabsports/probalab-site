// /props/nba — NBA player prop predictions, grouped by game: market, line, predicted side, our
// chance and the light (green first), like the H2H games. Filters: game, team, market, light.
// A Hit rates tab (heatmap) appears once the snapshot carries player game logs.
// Free view: FREE_PER_GAME players per market in each game; members get the full board via
// /api/props-nba (props-nba.js swaps it in after the members session check).
// No prices, no tips, no units, no projection numbers.
import { shell, html, esc, asHead, getFeed } from "../_shared/site.js";
import { startLabel, loadBoard, renderPanels, boardStats, updatedLabel, teamsOf, FREE_PER_GAME, memberButtons, sortedGames, marketsOn, shortDay } from "../_shared/nba-props.js";
import { renderHeatmapSection, publicIds, boardHasLogs } from "../_shared/nba-player-props.js";
import { propsSportNav } from "../_shared/sport-props.js";

/** "No props posted yet" with the next NBA game time, from the same feed the NBA pages use. */
async function emptyWithNextGame(ctx) {
  let next = null;
  try {
    const feed = await getFeed(ctx, "nba");
    const now = ctx.now ?? Date.now();
    next = (feed.games || []).filter((g) => g.status !== "post" && Date.parse(g.start_utc) > now)
      .map((g) => g.start_utc).sort()[0] || null;
  } catch (_) { next = null; }
  return `<section class="panel pp-empty"><p>No NBA player props posted yet.${next ? ` Next game: <b>${esc(startLabel(next))}</b>.` : ""} Props are posted on the morning of game day.</p></section>`;
}

export async function onRequestGet(ctx) {
  const board = await loadBoard(ctx);
  // board: the real Supabase board when fresh, else the sample fixture (sample:true). Only the
  // free view is rendered into this public HTML; members fetch the full board from /api/props-nba.
  const st = board ? boardStats(board) : { games: 0, players: 0, day: "" };
  const updated = board && board.generated_at ? updatedLabel(board.generated_at) : "";
  const sample = !!(board && board.sample);
  const teams = board ? teamsOf(board) : [];
  const games = board ? sortedGames(board) : [];
  const markets = board ? marketsOn(board) : [];
  const heat = board && st.games && boardHasLogs(board) ? renderHeatmapSection(board, { ids: publicIds(board) }) : "";

  const strip = `<div class="pp-strip mono" role="status">
    ${sample ? '<span class="pp-sample" title="Preview fixture: fictional players, invented numbers">Sample data</span>' : ""}
    ${st.day ? `<span>${esc(st.day)}</span>` : ""}
    <span>${st.games} game${st.games === 1 ? "" : "s"}</span>
    <span>${st.players} player${st.players === 1 ? "" : "s"}</span>
    ${updated ? `<span>Updated ${esc(updated)}</span>` : ""}
  </div>`;

  // View tabs: Predictions, plus Hit rates only when there is a heatmap to show.
  const tabs = heat ? `<div class="pp-tabs pp-views" role="tablist" aria-label="View">
    <button type="button" role="tab" class="pp-tab" id="pp-tab-preds" aria-controls="pp-view-preds" aria-selected="true" tabindex="0" data-view="preds">Predictions</button>
    <button type="button" role="tab" class="pp-tab" id="pp-tab-hits" aria-controls="pp-view-hits" aria-selected="false" tabindex="-1" data-view="hits">Hit rates</button>
  </div>` : "";

  const sel = (id, label, opts) => `<label class="pp-team-filter">${label}<select id="${id}">${opts}</select></label>`;
  const filters = board && st.games ? `<div class="game-filter-bar pp-filters" role="region" aria-label="Props filters">
    <div class="game-filters pp-selects">
      ${sel("ppGame", "Game", `<option value="">All games</option>${games.map((g) => { const day = shortDay(g.commence_utc || g.commence_syd); return `<option value="${esc(g.event_id || "")}">${day ? `${esc(day)} · ` : ""}${esc(g.away || "")} @ ${esc(g.home || "")}</option>`; }).join("")}`)}
      ${sel("ppTeam", "Team", `<option value="">All teams</option>${teams.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}`)}
      ${sel("ppMarket", "Market", `<option value="">All markets</option>${markets.map(([m, l]) => `<option value="${m}">${esc(l)}</option>`).join("")}`)}
    </div>
    <nav class="game-filters lights" id="ppLights" aria-label="Filter by light">${[["GREEN", "Green"], ["ORANGE", "Orange"], ["RED", "Red"]].map(([cls, label]) =>
      `<button type="button" class="gf-btn ${cls} on" data-light="${cls}" aria-pressed="true">${label}</button>`).join("")}</nav>
    <p class="small filter-note" id="ppLegend">Green first, then highest chance. <span class="chip GREEN">Green</span> 60%+ · <span class="chip ORANGE">Orange</span> 55–59% · <span class="chip RED">Red</span> under 55%</p>
  </div>` : "";

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/nba">NBA predictions</a> › <span>Player props</span></nav>
  <p class="eyebrow">// NBA player props · Australia/Sydney</p>
  <h1>NBA player props</h1>
  ${propsSportNav("nba")}
  <p>Every NBA game, every player: points, rebounds, assists and threes, with the line, our prediction and our chance. Strongest in green. Updated every morning before tip-off.</p>
  <p class="note">Predictions only, not betting advice.</p>
  <p class="small pp-results-link"><a href="/props/results">See props results →</a></p>
  ${strip}
  ${tabs}
  ${filters}
  ${st.games ? `<div id="ppMemberNote" class="pp-member-note"><p class="note">Free view shows ${FREE_PER_GAME} top players per market in each game. Members see every player.</p>${memberButtons("pp-cta-left")}</div>` : ""}
  <div id="pp-view-preds" class="pp-view"${heat ? ' role="tabpanel" aria-labelledby="pp-tab-preds"' : ""}>
    <div id="propsBoard">${st.games ? renderPanels(board, { full: false }) : await emptyWithNextGame(ctx)}</div>
    <p id="ppNone" class="note" hidden>No predictions match these filters.</p>
  </div>
  ${heat ? `<div id="pp-view-hits" class="pp-view" role="tabpanel" aria-labelledby="pp-tab-hits" hidden><div id="propsHeatmap">${heat}</div></div>` : ""}
  <p class="note">⚠️ Day-to-day or Questionable: minutes uncertain. Players listed Doubtful or Out are left off. Predictions only, not betting advice. 18+. <a href="/responsible-gambling">Gamble responsibly</a>.</p>
  <link rel="stylesheet" href="/props.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/props-nba.js"></script>
  <script src="/props-cards.js"></script>`;

  return html(shell({
    title: "NBA Player Prop Predictions: Points, Rebounds, Assists, Threes | ProbaLab",
    description: "Every NBA game, every player: the line, our prediction and our chance for points, rebounds, assists and threes, strongest in green. Predictions only, not betting advice.",
    path: "/props/nba",
    body,
    noindex: sample,
  }), 200, 60);
}

export const onRequestHead = (ctx) => asHead(onRequestGet, ctx);
