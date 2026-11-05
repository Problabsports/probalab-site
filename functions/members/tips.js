// Private tips desk. Magic-link auth via Supabase. Noindex. Not in sitemap. No public links.
// Logged-out visitors are redirected to /members (waitlist) by the client app.
import { shell, html } from "../_shared/site.js";

export async function onRequestGet() {
  const body = `
  <div class="tips-app">
    <p class="eyebrow">// private · members · units only</p>
    <h1>Tips desk</h1>
    <p class="note">Units only. Bankroll never shown.</p>

    <section id="bootPane" class="panel">
      <p class="muted">Checking your sign-in…</p>
      <p class="note"><a href="/members">Members waitlist</a></p>
    </section>

    <div id="appPane" class="hidden">
      <div class="tips-toolbar">
        <span id="who" class="muted"></span>
        <button type="button" id="signOut">Sign out</button>
      </div>
      <p id="meta" class="subline"></p>
      <p id="loadMsg" class="msg"></p>

      <section class="panel">
        <h2>Needs attention</h2>
        <div id="attention"></div>
      </section>

      <div class="tips-tabs" role="tablist">
        <button type="button" data-tab="today" class="on">Upcoming</button>
        <button type="button" data-tab="open">My open bets</button>
        <button type="button" data-tab="results">Results</button>
        <button type="button" data-tab="summary">Summary</button>
      </div>

      <div id="filters" class="tips-filters hidden">
        <label>Sport<select id="fSport"><option value="">All</option><option>NBA</option><option>NFL</option><option>NHL</option><option>EPL</option></select></label>
        <div id="colourFilters" class="colour-filters" role="group" aria-label="Pick colours"></div>
        <label>From<input id="fFrom" type="date"></label>
        <label>To<input id="fTo" type="date"></label>
      </div>

      <section id="todayPane"><div id="today"></div></section>
      <section id="openPane" class="hidden panel"><p class="note">Bets I have already placed, awaiting settlement — not bets to make.</p><div id="open"></div></section>
      <section id="resultsPane" class="hidden panel"><div id="results"></div></section>
      <section id="summaryPane" class="hidden"><div id="summary"></div></section>
    </div>
  </div>
  <link rel="stylesheet" href="/members-tips.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/members-tips-model.js"></script>
  <script src="/members-tips-app.js"></script>`;

  const page = shell({
    title: "Tips desk | ProbaLab",
    description: "Private tips desk",
    path: "/members/tips",
    body,
    noindex: true,
    signup: false,
  });
  const res = html(page, 200, 0);
  const headers = new Headers(res.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(res.body, { status: res.status, headers });
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
