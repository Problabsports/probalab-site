// /championship: paused (2026-11-28). Past results still redirect to /results?sport=championship; everything else
// (hub, /app, team pages) shows the paused notice (noindex). The app code (hidden-sports.js) stays for a return.
import { handleSportRecordRequest } from "../_shared/record-pages.js";
import { pausedSportPage } from "../_shared/paused.js";

export async function onRequestGet(ctx) {
  const rec = await handleSportRecordRequest(ctx, "championship");
  if (rec) return rec;
  return pausedSportPage(ctx, "championship");
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
