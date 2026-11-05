// Private tips desk. Magic-link auth via Supabase. Noindex. Not in sitemap. No public links.
import { shell, html } from "../_shared/site.js";

export async function onRequestGet() {
  const body = `
  <div class="tips-app">
    <p class="eyebrow">// private · members · units only</p>
    <h1>Tips desk</h1>
    <p class="note">John-only for now. Bankroll never shown. Replaces the Google tips sheet.</p>

    <section id="loginPane" class="panel login-box">
      <h2>Sign in</h2>
      <p>Use your allowlisted email. We'll email a one-time magic link.</p>
      <form id="loginForm">
        <label for="email">Email</label><br>
        <input id="email" name="email" type="email" required autocomplete="username" placeholder="you@example.com">
        <div><button class="btn" type="submit">Email me a login link</button></div>
      </form>
      <p id="loginMsg" class="msg muted"></p>
    </section>

    <div id="appPane" class="hidden">
      <div class="tips-toolbar">
        <span id="who" class="muted"></span>
        <button type="button" id="signOut">Sign out</button>
        <label style="margin-left:auto;font-size:12px;color:var(--muted)"><input type="checkbox" id="showEpl"> Show EPL</label>
      </div>
      <p id="meta" class="subline"></p>
      <p id="loadMsg" class="msg"></p>

      <section class="panel">
        <h2>Needs attention</h2>
        <div id="attention"></div>
      </section>

      <div class="tips-tabs" role="tablist">
        <button type="button" data-tab="today" class="on">Today</button>
        <button type="button" data-tab="open">Open bets</button>
        <button type="button" data-tab="results">Results</button>
        <button type="button" data-tab="summary">Summary</button>
      </div>

      <div id="filters" class="tips-filters hidden">
        <label>Sport<select id="fSport"><option value="">All</option><option>NBA</option><option>NFL</option><option>NHL</option><option>EPL</option></select></label>
        <label>System<select id="fSystem"><option value="">All</option><option value="CL">CL</option><option value="PL">PL</option><option value="CL+PL">CL+PL</option><option value="OTHER">OTHER</option></select></label>
        <label>Light<select id="fLight"><option value="">All</option><option>SUPER</option><option>GREEN</option><option>ORANGE</option><option>RED</option></select></label>
        <label>From<input id="fFrom" type="date"></label>
        <label>To<input id="fTo" type="date"></label>
      </div>

      <section id="todayPane"><div id="today"></div></section>
      <section id="openPane" class="hidden panel"><div id="open"></div></section>
      <section id="resultsPane" class="hidden panel"><div id="results"></div></section>
      <section id="summaryPane" class="hidden"><div id="summary"></div></section>
    </div>
  </div>
  <link rel="stylesheet" href="/members-tips.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
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
