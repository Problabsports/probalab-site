// /members/tips/:tipster — John or Closing Line Sniper desk
import { shell, html, notFound } from "../../_shared/site.js";
import { tipsDeskResponse } from "../../_shared/members-tips-desk.js";

export async function onRequestGet(ctx) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  if (parts.length !== 1) return notFound();
  const id = String(parts[0] || "").toLowerCase();
  if (id !== "john" && id !== "sniper") return notFound();
  return tipsDeskResponse(shell, html, id);
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
