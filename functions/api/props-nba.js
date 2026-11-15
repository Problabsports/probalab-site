// GET /api/props-nba — full NBA props board (rendered cards) for signed-in members and the owner.
// Send the Supabase access token as "Authorization: Bearer <token>". Everyone else gets 401.
import { verifyMember } from "../_shared/member-session.js";
import { loadBoard, renderCards } from "../_shared/nba-props.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", vary: "authorization", "x-robots-tag": "noindex, nofollow" },
});

export async function onRequestGet(ctx) {
  const member = await verifyMember(ctx.request);
  if (!member) return json({ ok: false, error: "members only" }, 401);
  const board = await loadBoard(ctx);
  if (!board) return json({ ok: false, error: "no board yet" }, 404);
  return json({ ok: true, html: renderCards(board, { full: true }) });
}
