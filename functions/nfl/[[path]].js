// /nfl (hub) and /nfl/<away>-vs-<home>-prediction-<date>-<id> (game page), rendered on the server for search engines.
import { handleSport } from "../_shared/site.js";
export const onRequestGet = (ctx) => handleSport(ctx, "nfl");
// HEAD (curl -I, link checkers, crawlers) gets the same status and headers as GET, with no body
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
