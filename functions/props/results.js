// /props/results: public player props results. Every settled call, green first. No login.
// Data and rendering: functions/_shared/props-results.js (+ /props-results-core.js, shared with the
// browser). Filters run in /props-results.js.
import { shell, html, esc, asHead } from "../_shared/site.js";
import { loadResults, renderBody } from "../_shared/props-results.js";
import { updatedLabel } from "../_shared/nba-props.js";

export async function onRequestGet(ctx) {
  const results = await loadResults(ctx);
  const updated = results && results.generated_at ? updatedLabel(results.generated_at) : "";

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/props/nba">Player props</a> › <span>Results</span></nav>
  <p class="eyebrow">// Player props results · green first</p>
  <h1>Player props results</h1>
  <p class="pr-intro">Every settled player prop call, updated daily.${updated ? ` <span class="mono small pr-updated">Updated ${esc(updated)}</span>` : ""}</p>
  ${renderBody(results)}
  <p class="note">For entertainment, not betting advice. 18+. <a href="/responsible-gambling">Gamble responsibly</a>.</p>
  <link rel="stylesheet" href="/props.css">
  ${results ? `<script type="module" src="/props-results.js"></script>` : ""}`;

  return html(shell({
    title: "Player Props Results | ProbaLab",
    description: "Every settled player prop call, updated daily: green record first, then hit rates by stat, Over vs Under and day.",
    path: "/props/results",
    body,
  }), 200, 60);
}

export const onRequestHead = (ctx) => asHead(onRequestGet, ctx);
