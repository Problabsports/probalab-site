// /props/nba — NBA player points: model projections and chances for the half-point lines
// nearest each projection. Free view: top players per game; members get the full board
// via /api/props-nba (props-nba.js swaps it in after the members session check).
// No prices, no tips, no units, no records.
import { shell, html, esc, asHead } from "../_shared/site.js";
import { loadBoard, renderCards, boardStats, updatedLabel, teamsOf, FREE_PER_GAME } from "../_shared/nba-props.js";

export async function onRequestGet(ctx) {
  const board = await loadBoard(ctx);
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
      <button type="button" class="gf-btn GREEN" id="ppGreens" aria-pressed="false">Greens only</button>
    </div>
    <p class="small filter-note">Strongest calls first. <span class="pp-chance GREEN">60%+</span> <span class="pp-chance ORANGE">55–59%</span> <span class="pp-chance RED">under 55%</span></p>
  </div>` : "";

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/nba">NBA predictions</a> › <span>Player props</span></nav>
  <p class="eyebrow">// NBA player points · Australia/Sydney</p>
  <h1>NBA player props: points projections</h1>
  <p>Every NBA game, every player: projected points and the chance of going over or under the key lines, with the strongest calls in green. Updated every morning before tip-off.</p>
  <p class="note">Projections only, not betting advice.</p>
  ${strip}
  ${filters}
  <p id="ppMemberNote" class="note">Free view shows ${FREE_PER_GAME} top scorers in each game. <a href="/join">Members see every player</a> · <a href="/members">Sign in</a></p>
  <div id="propsBoard">${board ? renderCards(board, { full: false }) : '<section class="panel"><p>No player props on the board yet. Check back closer to tip-off.</p></section>'}</div>
  <p class="note">⚠️ GTD, Questionable or Out: minutes are uncertain. Projections only, not betting advice. 18+. <a href="/responsible-gambling">Gamble responsibly</a>.</p>
  <link rel="stylesheet" href="/props.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/props-nba.js"></script>`;

  return html(shell({
    title: "NBA Player Props: Points Projections | ProbaLab",
    description: "Every NBA game, every player: projected points and the chance of going over or under the key lines, with the strongest calls in green. Projections only, not betting advice.",
    path: "/props/nba",
    body,
    noindex: sample,
  }), 200, 60);
}

export const onRequestHead = (ctx) => asHead(onRequestGet, ctx);
