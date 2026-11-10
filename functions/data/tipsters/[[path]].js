// Hide owner-only tipster snapshot JSON from the public site.
// Member-visible files (probalab.json, sniper.json) stay publicly fetchable.
import { isHiddenSnapshotFile } from "../../_shared/members-desks.js";
import { verifyOwner } from "../../_shared/owner-session.js";

function denied() {
  return new Response(JSON.stringify({ error: "not found" }), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
  });
}

export async function onRequestGet(ctx) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  if (parts.length !== 1) return denied();
  const file = String(parts[0] || "").toLowerCase();
  const assetUrl = new URL("/data/tipsters/" + file, ctx.request.url);
  if (!isHiddenSnapshotFile(file)) {
    return ctx.env.ASSETS.fetch(assetUrl);
  }
  const owner = await verifyOwner(ctx.request);
  if (!owner) return denied();
  const res = await ctx.env.ASSETS.fetch(assetUrl);
  if (!res.ok) return denied();
  const headers = new Headers(res.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(res.body, { status: res.status, headers });
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
