import { serveHidden } from "../_hidden/serve.js";
export const onRequestGet = (ctx) => serveHidden(ctx, "nhl");
// HEAD (curl -I, link checkers, crawlers) gets the same status and headers as GET, with no body
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
