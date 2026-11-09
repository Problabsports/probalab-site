// /how-it-works: methodology. Complements /lights rather than replacing it.
import { html } from "./_shared/site.js";
import { renderHowItWorksPage } from "./_shared/method-pages.js";

export function onRequestGet() {
  return html(renderHowItWorksPage());
}
export const onRequestHead = async (ctx) => {
  const r = onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
