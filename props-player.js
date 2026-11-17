/* NBA props player page (/props/nba/player/<id>): game-by-game chart market tabs, and the members
   swap for players outside the free view (same Supabase session check as /props/nba). */
(function () {
  var SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  var SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
  var bodyEl = document.getElementById("playerBody");
  if (!bodyEl) return;

  function wireCharts() {
    var tabs = Array.prototype.slice.call(bodyEl.querySelectorAll(".pl-ctab"));
    var figs = Array.prototype.slice.call(bodyEl.querySelectorAll(".pl-chart figure.bc"));
    function show(m, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute("data-m") === m;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      figs.forEach(function (f) { f.hidden = f.getAttribute("data-m") !== m; });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { show(t.getAttribute("data-m")); });
      t.addEventListener("keydown", function (e) {
        var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
        if (j == null) return;
        e.preventDefault();
        show(tabs[(j + tabs.length) % tabs.length].getAttribute("data-m"), true);
      });
    });
  }

  async function loadMember(id) {
    if (!window.supabase) return;
    var sb = window.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true } });
    var got = await sb.auth.getSession();
    var session = got && got.data && got.data.session;
    if (!session) return;
    var r = await fetch("/api/props-nba-player?id=" + encodeURIComponent(id), { headers: { authorization: "Bearer " + session.access_token }, credentials: "same-origin" });
    if (!r.ok) return;
    var j = await r.json();
    if (!j || !j.ok || !j.html) return;
    var h1 = document.querySelector("main h1");
    if (h1 && j.hero) { var wrap = document.createElement("div"); wrap.innerHTML = j.hero; h1.replaceWith.apply(h1, Array.prototype.slice.call(wrap.childNodes)); }
    bodyEl.innerHTML = j.html;
    if (j.name) document.title = j.name + " props | ProbaLab";
    wireCharts();
  }

  wireCharts();
  var gated = bodyEl.getAttribute("data-player");
  if (gated) loadMember(gated).catch(function () {});
})();
