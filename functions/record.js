// /record: hub linking to every sport's track-record page.
import { html } from "./_shared/site.js";
import { SPORT_ORDER, loadSportRecord, renderRecordHub } from "./_shared/record-pages.js";

export async function onRequestGet(ctx) {
  const views = await Promise.all(SPORT_ORDER.map((sport) => loadSportRecord(ctx, sport)));
  return html(renderRecordHub(views));
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
