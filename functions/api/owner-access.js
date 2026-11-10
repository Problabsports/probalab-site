// POST: verify the member JWT and set an httpOnly owner cookie.
// DELETE: clear the cookie (sign out).
import { verifyOwner, ownerCookieHeader, clearOwnerCookieHeader } from "../_shared/owner-session.js";

function json(body, status, extraHeaders) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  return new Response(JSON.stringify(body), { status, headers });
}

export async function onRequestPost(ctx) {
  const owner = await verifyOwner(ctx.request);
  if (!owner) return json({ ok: false }, 401, { "set-cookie": clearOwnerCookieHeader() });
  return json({ ok: true }, 200, { "set-cookie": ownerCookieHeader(owner.token, 60 * 60 * 12) });
}

export async function onRequestDelete() {
  return json({ ok: true }, 200, { "set-cookie": clearOwnerCookieHeader() });
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestPost(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
