// /newsletter → home signup section
export function onRequestGet(ctx) {
  return Response.redirect(new URL("/#newsletter", ctx.request.url).toString(), 302);
}
export function onRequestHead(ctx) {
  return onRequestGet(ctx);
}
