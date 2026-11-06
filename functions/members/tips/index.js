// /members/tips → redirect to /members (lobby) or accept ?tipster=
import { shell, html } from "../../_shared/site.js";
import { tipsDeskResponse } from "../../_shared/members-tips-desk.js";

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const q = (url.searchParams.get("tipster") || "").toLowerCase();
  if (q === "sniper" || q === "john") {
    return Response.redirect(new URL(`/members/tips/${q}`, url).toString(), 302);
  }
  // Bare /members/tips → lobby (tipster hub), not a desk
  return Response.redirect(new URL("/members", url).toString(), 302);
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
