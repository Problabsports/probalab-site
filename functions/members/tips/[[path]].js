// /members/tips and /members/tips/:tipster
// [[path]] is an optional catch-all, so bare /members/tips hits this too.
import { shell, html, notFound } from "../../_shared/site.js";
import { tipsDeskResponse } from "../../_shared/members-tips-desk.js";

export async function onRequestGet(ctx) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  const url = new URL(ctx.request.url);

  // Bare /members/tips → tipster lobby
  if (parts.length === 0) {
    const q = (url.searchParams.get("tipster") || "").toLowerCase();
    if (q === "sniper" || q === "john" || q === "probalab" || q === "nfl-weather" || q === "nba-price-gap" || q === "nhl-value") {
      return Response.redirect(new URL(`/members/tips/${q}`, url).toString(), 302);
    }
    return Response.redirect(new URL("/members", url).toString(), 302);
  }

  if (parts.length !== 1) return notFound();
  const id = String(parts[0] || "").toLowerCase();
  if (id !== "john" && id !== "sniper" && id !== "probalab" && id !== "nfl-weather" && id !== "nba-price-gap" && id !== "nhl-value") return notFound();
  return tipsDeskResponse(shell, html, id);
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
