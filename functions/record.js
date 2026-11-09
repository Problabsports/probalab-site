// /record is kept as an alias of the Results page.
import { redirectToResults } from "./_shared/record-pages.js";

export async function onRequestGet(ctx) {
  const dest = new URL("/results", ctx.request.url);
  const src = new URL(ctx.request.url);
  src.searchParams.forEach((v, k) => dest.searchParams.set(k, v));
  return Response.redirect(dest.toString(), 302);
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
