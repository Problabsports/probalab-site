// /props/nba/player/<id> — one player on today's NBA props board: team, today's predictions (side,
// chance, light), season averages and lines, and (once the snapshot carries a game log) last-10
// form, a game-by-game chart against today's line and hit rates. No projection numbers, no prices.
// Players in the free view are public; everyone else is members-only, like the board, and the body
// is fetched from /api/props-nba-player by props-player.js after the members session check.
import { shell, html, esc, asHead } from "../../../_shared/site.js";
import { teamPath, teamLogoHtml } from "../../../_shared/teams.js";
import { loadBoard, memberButtons, statusLabel, boardFreeKeys } from "../../../_shared/nba-props.js";
import { findPlayer, findPlayerByName, publicIds, renderPlayerBody, teamAbbr, playerPath } from "../../../_shared/nba-player-props.js";

const CRUMBS = (name) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/nba">NBA predictions</a> › <a href="/props/nba">Player props</a> › <span>${esc(name)}</span></nav>`;
const FOOT = `<p class="note">Predictions only, not betting advice. 18+. <a href="/responsible-gambling">Gamble responsibly</a>.</p>`;
const ASSETS = `<link rel="stylesheet" href="/props.css">`;

export const teamHrefOf = (p) => (p && p.team ? teamPath("nba", p.team) : null);

export async function onRequestGet(ctx) {
  const id = String((ctx.params && ctx.params.id) || "");
  const board = await loadBoard(ctx);
  const p = board ? findPlayer(board, id) : null;

  // Old name URLs (/props/nba/player/<name-slug>) move to the player_id URL.
  if (!p && board) {
    const byName = findPlayerByName(board, id);
    if (byName && byName.id !== id) return Response.redirect(new URL(playerPath(byName), ctx.request.url).toString(), 301);
  }

  if (!p) {
    const body = `${CRUMBS("Player")}
  <p class="eyebrow">// NBA player props</p>
  <h1>Not on today's board</h1>
  <section class="panel"><p>This player isn't listed for today's games. Player pages are live while the player is on the board.</p>
  <p><a class="btn" href="/props/nba">Back to NBA player props</a></p></section>`;
    return html(shell({ title: "Player not on today's board | ProbaLab", description: "This player isn't on today's NBA props board.", path: `/props/nba/player/${esc(id)}`, body, noindex: true, signup: false }), 404, 60);
  }

  const open = publicIds(board).has(p.id);
  const abbr = teamAbbr(p.team);
  const sample = !!board.sample;
  const status = statusLabel(p);
  const head = `${CRUMBS(open ? p.player : "Member player")}
  <p class="eyebrow">// NBA player props${open && abbr ? ` · ${esc(abbr)}` : ""}</p>
  ${sample ? '<p class="pp-strip mono"><span class="pp-sample" title="Preview fixture: fictional players, invented numbers">Sample data</span></p>' : ""}`;

  const body = open
    ? `${head}
  <div class="team-hero">${p.team ? teamLogoHtml("nba", { name: p.team, abbr }) : ""}<h1>${esc(p.player)}</h1></div>
  <p>${p.team ? `<a href="${esc(teamPath("nba", p.team))}">${esc(p.team)}</a> · ` : ""}Today's predictions, season averages and lines${status ? `. Listed ${esc(status)}` : ""}.</p>
  <div id="playerBody">${renderPlayerBody(p, { teamHref: teamHrefOf(p), keys: boardFreeKeys(board) })}</div>
  ${FOOT}${ASSETS}
  <script src="/props-player.js"></script>`
    : `${head}
  <h1>Members player page</h1>
  <div id="playerBody" data-player="${esc(p.id)}"><section class="panel pp-gate"><p>This player's page is for members, like the full props board.</p>${memberButtons()}</section></div>
  ${FOOT}${ASSETS}
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/props-player.js"></script>`;

  return html(shell({
    title: open ? `${p.player} props: points, rebounds, assists, threes | ProbaLab` : "NBA player props | ProbaLab",
    description: open ? `${p.player} NBA prop predictions, season averages and today's lines for points, rebounds, assists and threes.` : "NBA player props for members.",
    path: playerPath(p),
    body,
    noindex: sample || !open,
    signup: false,
  }), 200, 60);
}

export const onRequestHead = (ctx) => asHead(onRequestGet, ctx);
