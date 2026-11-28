// Paused sports (2026-11-28): Championship and tennis are off on the backend while we focus on NBA, NFL and NHL
// (Premier League in beta). /championship and /tennis show this notice (noindex) instead of stale picks.
// /<sport>/results and /<sport>/record(.csv) still redirect to that sport's past results (handled before this).
import { shell, esc } from "./site.js";

export const PAUSED_SPORTS = { championship: "Championship", tennis: "Tennis" };

export function pausedSportPage(ctx, sport) {
  const name = PAUSED_SPORTS[sport] || sport;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>${esc(name)}</span></nav>
  <p class="eyebrow">// paused</p>
  <h1>${esc(name)} predictions are paused</h1>
  <section class="panel paused-notice">
    <p>We're focusing on <b>NBA, NFL and NHL</b> right now, with the Premier League in beta. ${esc(name)} picks are paused, so there are no new ${esc(name)} predictions on this page.</p>
    <p>Every ${esc(name)} pick we posted stays on the record, wins and losses included.</p>
    <p class="cta"><a class="btn primary" href="/results?sport=${esc(sport)}&amp;light=all">Past ${esc(name)} results →</a> <a class="btn primary" href="/today">Today's games →</a></p>
    <p class="small"><a href="/nba">NBA</a> · <a href="/nfl">NFL</a> · <a href="/nhl">NHL</a> · <a href="/epl">Premier League (beta)</a></p>
  </section>`;
  return new Response(shell({
    title: `${name} Predictions Paused | ProbaLab`,
    description: `${name} predictions are paused while ProbaLab focuses on NBA, NFL and NHL. Past ${name} results stay on the record.`,
    path: `/${sport}`,
    body,
    noindex: true,
  }), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "x-robots-tag": "noindex" } });
}
