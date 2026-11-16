// GET /api/props-nba-player?id=<player id> — a members-only player page body (/props/nba/player/<id>).
// Same members check as /api/props-nba: "Authorization: Bearer <Supabase access token>", else 401.
import { verifyMember } from "../_shared/member-session.js";
import { loadBoard } from "../_shared/nba-props.js";
import { findPlayer, renderPlayerBody, teamAbbr } from "../_shared/nba-player-props.js";
import { teamPath, teamLogoHtml } from "../_shared/teams.js";
import { esc } from "../_shared/site.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", vary: "authorization", "x-robots-tag": "noindex, nofollow" },
});

export async function onRequestGet(ctx) {
  const member = await verifyMember(ctx.request);
  if (!member) return json({ ok: false, error: "members only" }, 401);
  const id = new URL(ctx.request.url).searchParams.get("id") || "";
  const board = await loadBoard(ctx);
  const p = board ? findPlayer(board, id) : null;
  if (!p) return json({ ok: false, error: "not on today's board" }, 404);
  const abbr = teamAbbr(p.team);
  const hero = `<div class="team-hero">${p.team ? teamLogoHtml("nba", { name: p.team, abbr }) : ""}<h1>${esc(p.player)}</h1></div>
  <p>${p.team ? `<a href="${esc(teamPath("nba", p.team))}">${esc(p.team)}</a> · ` : ""}Today's predictions, season averages and lines.</p>`;
  return json({ ok: true, name: p.player, hero, html: renderPlayerBody(p, { teamHref: p.team ? teamPath("nba", p.team) : null }) });
}
