// /record.csv is kept as an alias of the combined results CSV.
export async function onRequestGet(ctx) {
  return Response.redirect(new URL("/results.csv", ctx.request.url).toString(), 302);
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
