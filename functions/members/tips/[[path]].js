// /members/tips and /members/tips/:tipster
// [[path]] is an optional catch-all, so bare /members/tips hits this too.
import { shell, html, notFound } from "../../_shared/site.js";
import { tipsDeskResponse, ownerDeskGateResponse } from "../../_shared/members-tips-desk.js";
import { canonicalDeskId, isKnownDesk, isMemberDesk, isOwnerOnlyDesk } from "../../_shared/members-desks.js";
import { verifyOwner } from "../../_shared/owner-session.js";

export async function onRequestGet(ctx) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  const url = new URL(ctx.request.url);

  // Bare /members/tips → tipster lobby, or a known ?tipster= redirect
  if (parts.length === 0) {
    const q = canonicalDeskId(url.searchParams.get("tipster") || "");
    if (isKnownDesk(q)) {
      return Response.redirect(new URL(`/members/tips/${q}`, url).toString(), 302);
    }
    return Response.redirect(new URL("/members", url).toString(), 302);
  }

  if (parts.length !== 1) return notFound();
  const id = canonicalDeskId(parts[0]);
  if (!isKnownDesk(id)) return notFound();
  if (isMemberDesk(id)) return tipsDeskResponse(shell, html, id);
  if (isOwnerOnlyDesk(id)) {
    const owner = await verifyOwner(ctx.request);
    if (owner) return tipsDeskResponse(shell, html, id);
    return ownerDeskGateResponse(shell, html, id);
  }
  return notFound();
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
