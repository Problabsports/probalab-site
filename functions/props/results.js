// /props/results: public player props results. Every graded call, newest first. No login.
// Data and rendering: functions/_shared/props-results.js. Filters run in /props-results.js.
import { shell, html, esc, asHead } from "../_shared/site.js";
import { loadResults, renderBody } from "../_shared/props-results.js";
import { updatedLabel } from "../_shared/nba-props.js";

export async function onRequestGet(ctx) {
  const results = await loadResults(ctx);
  const updated = results && results.generated_at ? updatedLabel(results.generated_at) : "";

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/props/nba">Player props</a> › <span>Results</span></nav>
  <p class="eyebrow">// Player props results · Australia/Sydney</p>
  <h1>Player props results</h1>
  <p>Every graded player prop call, updated daily.${updated ? ` <span class="mono small">Updated ${esc(updated)}</span>` : ""}</p>
  ${renderBody(results)}
  <p class="note">For entertainment, not betting advice. 18+. <a href="/responsible-gambling">Gamble responsibly</a>.</p>
  <link rel="stylesheet" href="/props.css">
  ${results ? `<script src="/props-results.js"></script>` : ""}`;

  return html(shell({
    title: "Player Props Results | ProbaLab",
    description: "Every graded player prop call, updated daily: green, orange and red hit rates by stat.",
    path: "/props/results",
    body,
  }), 200, 60);
}

export const onRequestHead = (ctx) => asHead(onRequestGet, ctx);
