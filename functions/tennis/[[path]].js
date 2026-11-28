// /tennis: paused (2026-11-28). Past results still redirect to /results?sport=tennis; everything else shows the
// paused notice (noindex). The old app (tennis.js) and lean hub stay in the repo for when tennis comes back.
import { handleSportRecordRequest } from "../_shared/record-pages.js";
import { pausedSportPage } from "../_shared/paused.js";

export async function onRequestGet(ctx) {
  const rec = await handleSportRecordRequest(ctx, "tennis");
  if (rec) return rec;
  return pausedSportPage(ctx, "tennis");
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
