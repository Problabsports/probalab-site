// The full NBA props board is members-only. Block direct reads of the raw JSON;
// the page and /api/props-nba read it server-side through ASSETS.
import { verifyMember } from "../../_shared/member-session.js";

function denied() {
  return new Response(JSON.stringify({ error: "not found" }), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}

export async function onRequestGet(ctx) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  if (parts.length !== 1) return denied();
  const member = await verifyMember(ctx.request);
  if (!member) return denied();
  const res = await ctx.env.ASSETS.fetch(new URL("/data/nba_points_props/" + String(parts[0]).toLowerCase(), ctx.request.url));
  if (!res.ok) return denied();
  const headers = new Headers(res.headers);
  headers.set("cache-control", "private, no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(res.body, { status: res.status, headers });
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
