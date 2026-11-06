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
    <p>A private members area is on the way. Join the waitlist and we'll email you when it opens.</p>

    <section class="panel">
      <h2>What's coming</h2>
      <ul>
        <li>Tipsters with their own strategy — not every game, a selected set</li>
        <li>Each tipster's tips, results and summary against the ProbaLab board</li>
        <li>Fair price and value tools, units only</li>
      </ul>
      <p class="note">Coming soon. No public track record claims on this page — tipsters are still proving themselves.</p>
    </section>

    <section class="panel">
      <h2>Join the waitlist</h2>
      <form class="signup main" id="waitlistForm" action="/api/members-waitlist" method="post" data-waitlist>
        <label for="wl-email"><b>Email me when members opens</b></label>
        <p>No spam. We'll only write when the members area is ready.</p>
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

    <section class="panel" id="memberSignIn">
      <h2>Already a member?</h2>
      <p class="note">Sign in with your members email and password to open the tipster lobby.</p>
      <form id="memberLoginForm" class="login-box">
        <label for="memberEmail">Email</label><br>
        <input id="memberEmail" type="email" required autocomplete="username" placeholder="you@example.com" style="width:100%;max-width:360px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 10px"><br>
        <label for="memberPassword">Password</label><br>
        <input id="memberPassword" type="password" required autocomplete="current-password" style="width:100%;max-width:360px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 10px">
        <div><button class="btn" type="submit" style="display:inline-block;border:0;cursor:pointer;font-family:var(--f-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#07080f;background:var(--cyan);padding:10px 18px">Open members</button></div>
        <p id="memberLoginMsg" class="msg muted"></p>
      </form>
    </section>
  </div>

  <link rel="stylesheet" href="/members-tips.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/members-tips-model.js"></script>
  <script src="/members-lobby.js"></script>`;

  const page = shell({
    title: "Members | ProbaLab",
    description: "ProbaLab members: follow tipsters and compare their tips with the ProbaLab board. Join the waitlist or sign in.",
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
