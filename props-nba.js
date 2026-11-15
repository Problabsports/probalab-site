/* NBA player props page: stat tabs, Team / Greens-only filters, and the members session check
   (same as the members lobby: Supabase session + member_allowlist row, checked server-side by
   /api/props-nba), which swaps in the full board. */
(function () {
  var SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  var SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
  var boardEl = document.getElementById("propsBoard");
  var teamSel = document.getElementById("ppTeam");
  var greensBtn = document.getElementById("ppGreens");
  var note = document.getElementById("ppMemberNote");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".pp-tab"));
  if (!boardEl) return;
  var active = "points";

  function showTab(stat, focus) {
    active = stat;
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-stat") === stat;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    boardEl.querySelectorAll(".pp-panel").forEach(function (p) {
      p.hidden = p.id !== "pp-panel-" + stat;
    });
    applyFilters();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { showTab(t.getAttribute("data-stat")); });
    t.addEventListener("keydown", function (e) {
      var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
      if (j == null) return;
      e.preventDefault();
      showTab(tabs[(j + tabs.length) % tabs.length].getAttribute("data-stat"), true);
    });
  });

  function applyFilters() {
    var team = teamSel ? teamSel.value : "";
    var greens = greensBtn ? greensBtn.getAttribute("aria-pressed") === "true" : false;
    var filtering = !!team || greens;
    boardEl.querySelectorAll(".pp-game").forEach(function (card) {
      var teams = (card.getAttribute("data-teams") || "").split("|");
      if (team && teams.indexOf(team) < 0) { card.hidden = true; return; }
      card.hidden = false;
      var shown = 0;
      card.querySelectorAll(".pp-rows tr").forEach(function (tr) {
        var ok = (!team || tr.getAttribute("data-team") === team) && (!greens || tr.getAttribute("data-green") === "1");
        tr.hidden = !ok;
        if (ok) shown++;
      });
      var locked = card.querySelector(".pp-locked");
      if (locked) locked.hidden = filtering;
      var none = card.querySelector(".pp-none");
      if (none) none.hidden = shown > 0;
    });
  }

  if (teamSel) teamSel.addEventListener("change", applyFilters);
  if (greensBtn) greensBtn.addEventListener("click", function () {
    var on = greensBtn.getAttribute("aria-pressed") !== "true";
    greensBtn.setAttribute("aria-pressed", on ? "true" : "false");
    greensBtn.classList.toggle("on", on);
    applyFilters();
  });

  async function loadMemberBoard() {
    if (!window.supabase) return;
    var sb = window.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true } });
    var got = await sb.auth.getSession();
    var session = got && got.data && got.data.session;
    if (!session) return;
    var r = await fetch("/api/props-nba", { headers: { authorization: "Bearer " + session.access_token }, credentials: "same-origin" });
    if (!r.ok) {
      if (r.status === 401 && note) note.innerHTML = '<p class="note">You are signed in, but this account is not a paying member yet.</p><div class="pp-cta pp-cta-left"><a class="btn pp-join" href="/join">Join members</a></div>';
      return;
    }
    var j = await r.json();
    if (!j || !j.ok || !j.html) return;
    boardEl.innerHTML = j.html;
    if (note) note.innerHTML = '<p class="note">Members view: every player on the board.</p>';
    showTab(active);
  }

  showTab(active);
  loadMemberBoard().catch(function () {});
})();
