// /results.csv: every finished pick, every sport, every light.
import { SPORT_ORDER, loadSportRecord, csvResponse } from "./_shared/record-pages.js";

export async function onRequestGet(ctx) {
  const views = await Promise.all(SPORT_ORDER.map((sport) => loadSportRecord(ctx, sport)));
  return csvResponse(views.flatMap((v) => v.rows ?? []));
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
