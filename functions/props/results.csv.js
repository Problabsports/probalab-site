// /props/results.csv: every settled player prop call, every sport and light. Same public fields as
// /props/results; no prices, units or private fields.
import { loadResults, renderPropsCsv } from "../_shared/props-results.js";

export async function onRequestGet(ctx) {
  const results = await loadResults(ctx);
  return new Response(renderPropsCsv(results), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="probalab-props-results.csv"',
      "cache-control": "public, max-age=0, s-maxage=60, must-revalidate",
    },
  });
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
