// /results: one green-first results page for every sport ProbaLab covers.
import { html } from "./_shared/site.js";
import { SPORT_ORDER, loadSportRecord, parseResultsFilters, renderResultsPage } from "./_shared/record-pages.js";

export async function onRequestGet(ctx) {
  const views = await Promise.all(SPORT_ORDER.map((sport) => loadSportRecord(ctx, sport)));
  return html(renderResultsPage(views, parseResultsFilters(ctx.request.url)));
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
