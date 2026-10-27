// /api/preview?sport=nba&id=<game_id>: the same pre-game preview section the /nba/<game> page renders (previewSection),
// so the app's game view and the game page can never differ. Empty html when a game has no preview.
import { getFeed, gamesOf, previewSection } from "../_shared/site.js";
export async function onRequestGet(ctx) {
  const u = new URL(ctx.request.url), sport = u.searchParams.get("sport"), id = u.searchParams.get("id");
  const j = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { "content-type": "application/json", "cache-control": "public, max-age=0, s-maxage=60" } });
  if (!["nba", "nfl"].includes(sport) || !id) return j({ html: "" }, 400);
  try {
    const data = gamesOf(sport, await getFeed(ctx, sport)), g = data.games.find((x) => x.game_id === id);
    return j({ html: g ? previewSection(g, data.games) : "" });
  } catch (e) { return j({ html: "" }, 503); }
}
