// /backtest: labelled historical tests, never folded into live Results.
import { html } from "./_shared/site.js";
import { renderBacktestPage } from "./_shared/method-pages.js";

export function onRequestGet() {
  return html(renderBacktestPage());
}
export const onRequestHead = async (ctx) => {
  const r = onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
