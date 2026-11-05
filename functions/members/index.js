// Public members waitlist — coming soon. No results/profit claims. No prices. Not in nav.
import { shell, html, esc } from "../_shared/site.js";

export async function onRequestGet() {
  const body = `
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Members</span></nav>
  <p class="eyebrow">// members · coming soon</p>
  <p id="deniedNote" class="note" style="display:none;color:var(--orange)">That email isn't on the members list yet. Join the waitlist below.</p>
  <h1>ProbaLab members</h1>
  <p>A private members area is on the way. Join the waitlist and we'll email you when it opens.</p>

  <section class="panel">
    <h2>What's coming</h2>
    <ul>
      <li>Every tip in one place, with the model's light and win chance</li>
      <li>Fair price and value % for each pick</li>
      <li>Tips emailed out as they go live</li>
    </ul>
    <p class="note">Coming soon. No public track record claims on this page — the members desk is still being built.</p>
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
    <p class="note">If you already have access, sign in with a magic link.</p>
    <form id="memberLoginForm" class="login-box">
      <label for="memberEmail">Email</label><br>
      <input id="memberEmail" type="email" required autocomplete="username" placeholder="you@example.com" style="width:100%;max-width:360px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 10px">
      <div><button class="btn" type="submit" style="display:inline-block;border:0;cursor:pointer;font-family:var(--f-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#07080f;background:var(--cyan);padding:10px 18px">Email me a login link</button></div>
      <p id="memberLoginMsg" class="msg muted"></p>
    </form>
  </section>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script>
  (function () {
    if (/[?&]denied=1/.test(location.search)) {
      var dn = document.getElementById("deniedNote");
      if (dn) dn.style.display = "block";
    }

    var f = document.getElementById("waitlistForm");
    if (f) f.addEventListener("submit", function (e) {
      e.preventDefault();
      var m = document.getElementById("wlMsg"), b = f.querySelector("button");
      b.disabled = true; m.textContent = "Joining…";
      fetch("/api/members-waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: f.email.value, website: f.website.value, source: f.source.value })
      }).then(function (r) { return r.json(); }).then(function (j) {
        m.textContent = j.ok
          ? "Thanks — you're on the waitlist. We'll email you when members opens."
          : (j.error || "Something went wrong. Please try again.");
        if (j.ok) f.email.value = "";
        b.disabled = false;
      }).catch(function () {
        m.textContent = "Something went wrong. Please try again.";
        b.disabled = false;
      });
    });

    var SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
    var SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
    var lf = document.getElementById("memberLoginForm");
    if (lf && window.supabase) {
      var sb = window.supabase.createClient(SB_URL, SB_ANON);
      lf.addEventListener("submit", function (e) {
        e.preventDefault();
        var msg = document.getElementById("memberLoginMsg");
        msg.textContent = "Sending magic link…";
        sb.auth.signInWithOtp({
          email: document.getElementById("memberEmail").value.trim(),
          options: { emailRedirectTo: window.location.origin + "/members/tips" }
        }).then(function (res) {
          msg.textContent = res.error ? res.error.message : "Check your email for the login link.";
        });
      });
    }
  })();
  </script>`;

  const page = shell({
    title: "Members waitlist | ProbaLab",
    description: "Join the waitlist for ProbaLab members: every tip, fair price and value %, and tips by email. Coming soon.",
    path: "/members",
    body,
    noindex: false,
    signup: false,
  });
  // Public page but keep out of sitemap/nav for now; allow indexing of waitlist is ok, or noindex?
  // Parent: no link from public nav. Indexing the waitlist page is fine for discovery later; leave indexable.
  const res = html(page, 200, 60);
  return res;
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
