// /members/discord — link a Discord account so the Premium role is added automatically.
import { shell, html } from "../_shared/site.js";
import { DISCORD_INVITE_URL } from "../_shared/discord.js";

const BTN = "display:inline-block;border:0;cursor:pointer;font-family:var(--f-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#07080f;background:var(--cyan);padding:10px 18px;margin:0 8px 8px 0";
const BTN2 = "display:inline-block;cursor:pointer;font-family:var(--f-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink);background:transparent;border:1px solid var(--line-hi);padding:9px 16px;margin:0 8px 8px 0";

export async function onRequestGet() {
  const invite = String(DISCORD_INVITE_URL || "").replace(/"/g, "&quot;");
  const body = `
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/members">Members</a> › <span>Discord</span></nav>
  <p class="eyebrow">// discord</p>
  <h1>Link your Discord</h1>
  <p>Link your Discord account and we add the <b>Premium</b> role in the ProbaLab server automatically, which unlocks the members channels. If your membership ends, the role is removed.</p>
  <section class="panel">
    <ol>
      <li>Join the server first: <a href="${invite}" target="_blank" rel="noopener noreferrer">ProbaLab Discord</a>.</li>
      <li>Then press <b>Link Discord</b>. Discord asks you to share your username only (no messages, no server list).</li>
    </ol>
    <p id="dcStatus" class="note" role="status">Checking your sign-in…</p>
    <div id="dcActions" class="hidden">
      <button type="button" id="dcLink" style="${BTN}">Link Discord</button>
      <button type="button" id="dcSync" style="${BTN2}" class="hidden">Check again</button>
      <button type="button" id="dcUnlink" style="${BTN2}" class="hidden">Unlink</button>
    </div>
    <p class="small">Not a member yet? <a href="/join">Join ProbaLab Members</a>. Manage or cancel from <a href="/members/billing">Manage billing</a>.</p>
  </section>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script>
  (function () {
    var SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
    var SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
    var statusEl = document.getElementById("dcStatus");
    var actions = document.getElementById("dcActions");
    var linkBtn = document.getElementById("dcLink");
    var syncBtn = document.getElementById("dcSync");
    var unlinkBtn = document.getElementById("dcUnlink");
    var token = null;
    var RETURN_MSG = {
      linked: "Linked. The Premium role has been added — the members channels should appear in Discord now.",
      not_in_guild: "Linked, but that Discord account is not in the ProbaLab server yet. Join the server, then press Check again.",
      inactive: "Linking Discord needs an active membership.",
      cancelled: "Discord linking was cancelled.",
      expired: "That link attempt expired. Please press Link Discord again.",
      disabled: "Discord linking is not switched on yet.",
      error: "Something went wrong linking Discord. Please try again."
    };
    var returned = new URLSearchParams(location.search).get("status");
    function show(el, on) { el.classList.toggle("hidden", !on); }
    function call(action) {
      return fetch("/api/discord/link", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + token },
        body: JSON.stringify({ action: action })
      }).then(function (r) { return r.json(); });
    }
    function render(j, note) {
      if (!j.ok && j.enabled === false) { statusEl.textContent = j.error; show(actions, false); return; }
      if (!j.ok) { statusEl.textContent = j.error || "Something went wrong."; return; }
      show(actions, true);
      var link = j.link;
      show(linkBtn, j.active);
      linkBtn.textContent = link ? "Link a different account" : "Link Discord";
      show(syncBtn, !!link);
      show(unlinkBtn, !!link);
      var lines = [];
      if (note) lines.push(note);
      if (!j.active) lines.push("Your membership is not active, so the Premium role is not given.");
      if (link) {
        var s = { granted: "Premium role added", not_in_guild: "not in the ProbaLab server yet — join it, then press Check again", removed: "role removed", error: "could not update the role — press Check again" }[link.role_state] || "linked";
        lines.push("Linked to " + (link.discord_username || "your Discord account") + ": " + s + ".");
      } else if (j.active) {
        lines.push("No Discord account linked yet.");
      }
      statusEl.textContent = lines.join(" ");
    }
    function run(btn, action) {
      btn.disabled = true;
      return call(action).then(function (j) {
        if (action === "start" && j.ok && j.url) { location.href = j.url; return; }
        render(j);
      }).catch(function () { statusEl.textContent = "Something went wrong. Please try again."; })
        .finally(function () { btn.disabled = false; });
    }
    linkBtn.addEventListener("click", function () { run(linkBtn, "start"); });
    syncBtn.addEventListener("click", function () { run(syncBtn, "sync"); });
    unlinkBtn.addEventListener("click", function () {
      if (confirm("Unlink Discord? The Premium role will be removed from that account.")) run(unlinkBtn, "unlink");
    });
    var sb = window.supabase ? window.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
    (sb ? sb.auth.getSession() : Promise.resolve({ data: { session: null } })).then(function (res) {
      var session = res && res.data && res.data.session;
      if (!session) {
        statusEl.innerHTML = 'Please <a href="/members">sign in</a> first, then come back to this page.';
        return;
      }
      token = session.access_token;
      if (returned) history.replaceState(null, "", location.pathname);
      return call("status").then(function (j) { render(j, RETURN_MSG[returned] || ""); });
    }).catch(function () { statusEl.textContent = "Could not check your sign-in. Please reload."; });
  })();
  </script>`;
  return html(shell({
    title: "Link Discord | ProbaLab Members",
    description: "Link your Discord account to get the ProbaLab Members Premium role.",
    path: "/members/discord",
    body,
    noindex: true,
    signup: false,
  }), 200, 0);
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
