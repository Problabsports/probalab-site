// /members/tips → tipster desk default (john). Prefer /members/tips/john or /members/tips/sniper.
import { shell, html } from "../_shared/site.js";
import { tipsDeskResponse } from "../_shared/members-tips-desk.js";

export async function onRequestGet(ctx) {
  const url = new URL(ctx.request.url);
  const q = (url.searchParams.get("tipster") || "john").toLowerCase();
  // Canonical path for a named tipster
  if (q === "sniper" || q === "john") {
    return Response.redirect(new URL(`/members/tips/${q}`, url).toString(), 302);
  }
  return tipsDeskResponse(shell, html, "john");
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
