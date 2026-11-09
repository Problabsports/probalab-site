// Members: waitlist + login when logged out; tipster lobby when logged in.
import { shell, html } from "../_shared/site.js";

export async function onRequestGet() {
  const body = `
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Members</span></nav>
  <p class="eyebrow">// members</p>
  <p id="deniedNote" class="note" style="display:none;color:var(--orange)">That email isn't on the members list yet. Join the waitlist below.</p>

  <section id="bootPane" class="panel">
    <p class="muted">Checking your sign-in…</p>
  </section>

  <div id="lobbyPane" class="hidden tips-app">
    <h1>Tipsters</h1>
    <p>Public pages rate every game. Members follow tipsters who pick a smaller set with their own strategy and compare that record with the ProbaLab board. Everyone here is still building a track record.</p>
    <div class="tips-toolbar">
      <span id="who" class="muted"></span>
      <button type="button" id="signOut">Sign out</button>
    </div>
    <p id="lobbyMeta" class="subline"></p>
    <p id="lobbyMsg" class="msg"></p>
    <div id="tipsterCards" class="tipster-grid"></div>
  </div>

  <div id="publicPane" class="hidden">
    <h1>ProbaLab members</h1>
    <p>Public pages rate every game. Members follow tipsters who pick a smaller set with their own strategy — still building their track records, units only.</p>

    <section class="panel" id="memberSignIn">
      <h2>Sign in</h2>
      <p class="note">Members email and password open the tipster lobby.</p>
      <form id="memberLoginForm" class="login-box">
        <label for="memberEmail">Email</label><br>
        <input id="memberEmail" type="email" required autocomplete="username" placeholder="you@example.com" style="width:100%;max-width:360px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 10px"><br>
        <label for="memberPassword">Password</label><br>
        <input id="memberPassword" type="password" required autocomplete="current-password" style="width:100%;max-width:360px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 10px">
        <div><button class="btn" type="submit" style="display:inline-block;border:0;cursor:pointer;font-family:var(--f-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#07080f;background:var(--cyan);padding:10px 18px">Open members</button></div>
        <p id="memberLoginMsg" class="msg muted"></p>
      </form>
    </section>

    <section class="panel">
      <h2>Live tipster desks</h2>
      <p>Sign in to open a desk. Each tipster keeps its own record, separate from the public board.</p>
      <ul class="desk-list">
        <li><b>John</b> — NBA · NFL · NHL · EPL · Championship · Tennis</li>
        <li><b>ProbaLab</b> — site greens and supers across NBA, NFL, NHL and EPL</li>
        <li><b>Closing Line Sniper</b> — selective Closing Line tips</li>
        <li><b>NFL Totals</b> — NFL overs and unders</li>
        <li><b>NBA Price Gap</b> — NBA moneylines when AU books beat Pinnacle</li>
        <li><b>NHL Value</b> — NHL moneylines at or above model fair</li>
      </ul>
      <p class="note">Tipsters are still proving themselves. No public staking claims on this page.</p>
    </section>

    <section class="panel">
      <h2>Not a member yet?</h2>
      <p>Join the waitlist and we will email you when more seats open.</p>
      <form class="signup main" id="waitlistForm" action="/api/members-waitlist" method="post" data-waitlist>
        <label for="wl-email"><b>Email me when a seat opens</b></label>
        <p>No spam. Waitlist mail only.</p>
        <div class="srow">
          <input id="wl-email" type="email" name="email" required maxlength="254" placeholder="you@example.com" autocomplete="email">
          <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input type="hidden" name="source" value="members">
          <button type="submit">Join waitlist</button>
        </div>
        <p class="small">Unsubscribe any time. 18+. <a href="/privacy">Privacy</a></p>
        <p class="msg" id="wlMsg" role="status"></p>
      </form>
    </section>
  </div>

  <link rel="stylesheet" href="/members-tips.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/members-tips-model.js"></script>
  <script src="/members-lobby.js"></script>`;

  const page = shell({
    title: "Members | ProbaLab",
    description: "Sign in to ProbaLab members tipster desks, or join the waitlist. Live tipsters with their own records.",
    path: "/members",
    body,
    noindex: false,
    signup: false,
  });
  return html(page, 200, 60);
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
