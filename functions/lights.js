// /lights: how confidence lights work, and why the cut-offs differ by sport.
import { html } from "./_shared/site.js";
import { renderLightsPage } from "./_shared/record-pages.js";

export async function onRequestGet() {
  return html(renderLightsPage());
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
