// /tennis: ATP and WTA predictions (live 7 Nov 2026). App shell + tennis.js (see functions/_hidden/serve.js).
import { serveHidden } from "../_hidden/serve.js";
import { handleSportRecordRequest } from "../_shared/record-pages.js";

export async function onRequestGet(ctx) {
  const rec = await handleSportRecordRequest(ctx, "tennis");
  if (rec) return rec;
  return serveHidden(ctx, "tennis");
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
