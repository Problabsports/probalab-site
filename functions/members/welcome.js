// /members/welcome — after Stripe Checkout, set a password and continue to the lobby.
import { shell, html } from "../_shared/site.js";

export async function onRequestGet() {
  const body = `
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/members">Members</a> › <span>Welcome</span></nav>
  <p class="eyebrow">// welcome</p>
  <h1>Welcome to ProbaLab Members</h1>
  <p>Set a password for the email you used at checkout, then open the members desks. You will see John, ProbaLab and Sniper.</p>
  <section class="panel">
    <form id="welcomeForm">
      <input type="hidden" id="welcomeSession" name="session_id">
      <label for="welcomePassword"><b>Password</b></label>
      <p class="note">At least 12 characters. Use this with your checkout email to sign in later.</p>
      <input id="welcomePassword" type="password" required minlength="12" autocomplete="new-password" style="width:100%;max-width:360px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 10px"><br>
      <label for="welcomePassword2"><b>Confirm password</b></label><br>
      <input id="welcomePassword2" type="password" required minlength="12" autocomplete="new-password" style="width:100%;max-width:360px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 10px">
      <div><button class="btn" type="submit" style="display:inline-block;border:0;cursor:pointer;font-family:var(--f-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#07080f;background:var(--cyan);padding:10px 18px">Save password and continue</button></div>
      <p id="welcomeMsg" class="msg" role="status"></p>
    </form>
    <p class="small">Already have a password? <a href="/members">Sign in</a>. Manage or cancel any time from <a href="/members/billing">Manage billing</a>.</p>
    <p class="small">18+. <a href="/responsible-gambling">Gamble responsibly</a>. <a href="/refund">Refunds</a>.</p>
  </section>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script>
  (function () {
    var SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
    var SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
    var params = new URLSearchParams(location.search);
    var sessionId = params.get("session_id") || "";
    document.getElementById("welcomeSession").value = sessionId;
    var f = document.getElementById("welcomeForm");
    var m = document.getElementById("welcomeMsg");
    if (!sessionId) {
      m.textContent = "This welcome link needs a checkout session. If you just paid, go back from Stripe, or sign in from the members page.";
    }
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var p1 = document.getElementById("welcomePassword").value;
      var p2 = document.getElementById("welcomePassword2").value;
      if (p1 !== p2) { m.textContent = "Those passwords do not match."; return; }
      if (p1.length < 12) { m.textContent = "Use a password of at least 12 characters."; return; }
      var b = f.querySelector("button[type=submit]");
      b.disabled = true;
      m.textContent = "Saving…";
      fetch("/api/membership-activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, password: p1 })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          var j = x.j || {};
          if (!j.ok) { m.textContent = j.error || "Could not finish sign-up."; return; }
          if (!window.supabase || !j.email) { location.replace("/members"); return; }
          var sb = window.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true } });
          return sb.auth.signInWithPassword({ email: j.email, password: p1 }).then(function (res) {
            if (res.error) { location.replace("/members"); return; }
            location.replace("/members");
          });
        })
        .catch(function () { m.textContent = "Could not finish sign-up. Please try again."; })
        .finally(function () { b.disabled = false; });
    });
  })();
  </script>`;
  return html(shell({
    title: "Welcome | ProbaLab Members",
    description: "Finish setting up your ProbaLab Members account.",
    path: "/members/welcome",
    body,
    noindex: true,
    signup: false,
  }), 200, 0);
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
