// /tennis: ATP and WTA predictions (live 7 Nov 2026). App shell + tennis.js (see functions/_hidden/serve.js).
import { serveHidden } from "../_hidden/serve.js";
import { html } from "../_shared/site.js";
import { handleSportRecordRequest } from "../_shared/record-pages.js";

export async function onRequestGet(ctx) {
  const rec = await handleSportRecordRequest(ctx, "tennis");
  if (rec) return rec;
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  if (parts.length) return serveHidden(ctx, "tennis");
  const { renderLeanHub } = await import("../_shared/sport-hubs.js");
  return html(await renderLeanHub(ctx, "tennis"));
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
