// /props/nba — NBA player props: season average, line, our projection and the call, per stat tab.
// Free view: top players per game; members get the full board via /api/props-nba
// (props-nba.js swaps it in after the members session check).
// No prices, no tips, no units, no records.
import { shell, html, esc, asHead } from "../_shared/site.js";
import { loadBoard, renderPanels, renderTabs, boardStats, updatedLabel, teamsOf, FREE_PER_GAME, memberButtons } from "../_shared/nba-props.js";

export async function onRequestGet(ctx) {
  const board = await loadBoard(ctx);
  // board: the real Supabase board when fresh, else the sample fixture (sample:true). Only the
  // free view is rendered into this public HTML; members fetch the full board from /api/props-nba.
  const st = board ? boardStats(board) : { games: 0, players: 0, day: "" };
  const updated = board && board.generated_at ? updatedLabel(board.generated_at) : "";
  const sample = !!(board && board.sample);
  const teams = board ? teamsOf(board) : [];

  const strip = `<div class="pp-strip mono" role="status">
    ${sample ? '<span class="pp-sample" title="Preview fixture: fictional players, invented numbers">Sample data</span>' : ""}
    ${st.day ? `<span>${esc(st.day)}</span>` : ""}
    <span>${st.games} game${st.games === 1 ? "" : "s"}</span>
    <span>${st.players} player${st.players === 1 ? "" : "s"}</span>
    ${updated ? `<span>Updated ${esc(updated)}</span>` : ""}
  </div>`;

  const filters = board && st.games ? `<div class="game-filter-bar pp-filters" role="region" aria-label="Props filters">
    <div class="game-filters">
      <label class="pp-team-filter">Team
        <select id="ppTeam"><option value="">All teams</option>${teams.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</select>
      </label>
    </div>
    <nav class="game-filters lights" id="ppLights" aria-label="Filter by light">${[["GREEN", "Green"], ["ORANGE", "Orange"], ["RED", "Red"]].map(([cls, label]) =>
      `<button type="button" class="gf-btn ${cls} on" data-light="${cls}" aria-pressed="true">${label}</button>`).join("")}</nav>
    <p class="small filter-note">Strongest calls first. <span class="chip GREEN">Green</span> 60%+ · <span class="chip ORANGE">Orange</span> 55–59% · <span class="chip RED">Red</span> under 55%</p>
  </div>` : "";

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/nba">NBA predictions</a> › <span>Player props</span></nav>
  <p class="eyebrow">// NBA player props · Australia/Sydney</p>
  <h1>NBA player props</h1>
  <p>Every NBA game, every player: the line, our projection and the call, with the strongest calls in green. Updated every morning before tip-off.</p>
  <p class="note">Projections only, not betting advice.</p>
  <p class="small pp-results-link"><a href="/props/results">See props results →</a></p>
  ${renderTabs()}
  ${strip}
  ${filters}
  ${st.games ? `<div id="ppMemberNote" class="pp-member-note"><p class="note">Free view shows ${FREE_PER_GAME} top players in each game. Members see every player.</p>${memberButtons("pp-cta-left")}</div>` : ""}
  <div id="propsBoard">${renderPanels(board, { full: false })}</div>
  <p class="note">⚠️ Day-to-day or Questionable: minutes uncertain. Players listed Doubtful or Out are left off. Projections only, not betting advice. 18+. <a href="/responsible-gambling">Gamble responsibly</a>.</p>
  <link rel="stylesheet" href="/props.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/props-nba.js"></script>`;

  return html(shell({
    title: "NBA Player Props: Points, Rebounds, Assists, Threes | ProbaLab",
    description: "Every NBA game, every player: the line, our projection and the call, with the strongest calls in green. Projections only, not betting advice.",
    path: "/props/nba",
    body,
    noindex: sample,
  }), 200, 60);
}

export const onRequestHead = (ctx) => asHead(onRequestGet, ctx);
