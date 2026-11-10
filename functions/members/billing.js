// /members/billing — open the Stripe Customer Portal.
import { shell, html } from "../_shared/site.js";

export async function onRequestGet() {
  const body = `
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/members">Members</a> › <span>Billing</span></nav>
  <p class="eyebrow">// billing</p>
  <h1>Manage billing</h1>
  <p>Update your payment method or cancel your ProbaLab Members subscription. Cancellation takes effect at the end of the period you have already paid for. See <a href="/refund">Refunds</a> for details.</p>
  <section class="panel">
    <p id="billingAuth" class="note">Checking your sign-in…</p>
    <form id="billingForm" class="hidden">
      <label for="billingEmail"><b>Email</b></label>
      <p class="note">Use the email you used at checkout if you are not signed in.</p>
      <input id="billingEmail" type="email" required maxlength="254" autocomplete="email" placeholder="you@example.com" style="width:100%;max-width:360px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 10px">
      <div><button class="btn" type="submit" style="display:inline-block;border:0;cursor:pointer;font-family:var(--f-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#07080f;background:var(--cyan);padding:10px 18px">Open billing portal</button></div>
      <p id="billingMsg" class="msg" role="status"></p>
    </form>
    <p class="small">18+. <a href="/responsible-gambling">Gamble responsibly</a>.</p>
  </section>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script>
  (function () {
    var SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
    var SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
    var form = document.getElementById("billingForm");
    var msg = document.getElementById("billingMsg");
    var authLine = document.getElementById("billingAuth");
    var token = null;
    var sb = window.supabase ? window.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
    function showForm() { form.classList.remove("hidden"); }
    function openPortal(email) {
      var headers = { "content-type": "application/json" };
      if (token) headers.authorization = "Bearer " + token;
      return fetch("/api/billing-portal", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ email: email || undefined })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
    }
    (sb ? sb.auth.getSession() : Promise.resolve({ data: { session: null } })).then(function (res) {
      var session = res && res.data && res.data.session;
      showForm();
      if (session) {
        token = session.access_token;
        document.getElementById("billingEmail").value = session.user.email || "";
        authLine.textContent = "Signed in as " + session.user.email + ". Opening the billing portal will not charge you.";
      } else {
        authLine.textContent = "You can sign in first, or enter the email you used at checkout.";
      }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var b = form.querySelector("button[type=submit]");
      b.disabled = true;
      msg.textContent = "Opening billing…";
      openPortal(document.getElementById("billingEmail").value)
        .then(function (x) {
          var j = x.j || {};
          if (j.ok && j.url) { location.href = j.url; return; }
          msg.textContent = j.error || "Could not open billing.";
        })
        .catch(function () { msg.textContent = "Could not open billing. Please try again."; })
        .finally(function () { b.disabled = false; });
    });
  })();
  </script>`;
  return html(shell({
    title: "Manage billing | ProbaLab Members",
    description: "Update your payment method or cancel your ProbaLab Members subscription.",
    path: "/members/billing",
    body,
    noindex: true,
    signup: false,
  }), 200, 0);
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
