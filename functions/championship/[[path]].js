// /championship: EFL Championship predictions (live 7 Nov 2026). Same app shell and code as the EPL page (hidden-sports.js).
import { serveHidden } from "../_hidden/serve.js";

export async function onRequestGet(ctx) {
  return serveHidden(ctx, "championship");
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
