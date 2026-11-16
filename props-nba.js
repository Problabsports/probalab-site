/* NBA player prop predictions (/props/nba): Predictions / Hit rates view tabs, shared Game / Team /
   Market filters, Green / Orange / Red light toggles (all on by default, predictions only), heatmap
   sorting, and the members session check (same as the members lobby: Supabase session +
   member_allowlist row, checked server-side by /api/props-nba), which swaps in the full board. */
(function () {
  var SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  var SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
  var boardEl = document.getElementById("propsBoard");
  if (!boardEl) return;
  var gameSel = document.getElementById("ppGame");
  var teamSel = document.getElementById("ppTeam");
  var mktSel = document.getElementById("ppMarket");
  var lightsNav = document.getElementById("ppLights");
  var lightBtns = Array.prototype.slice.call(document.querySelectorAll("#ppLights .gf-btn"));
  var note = document.getElementById("ppMemberNote");
  var noneAll = document.getElementById("ppNone");
  var views = Array.prototype.slice.call(document.querySelectorAll(".pp-views .pp-tab"));
  var val = function (el) { return el ? el.value : ""; };

  // ---------------------------------------------------------------- view tabs
  function showView(v, focus) {
    views.forEach(function (t) {
      var on = t.getAttribute("data-view") === v;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
    // light toggles only filter predictions
    if (lightsNav) lightsNav.hidden = v === "hits";
  }
  views.forEach(function (t, i) {
    t.addEventListener("click", function () { showView(t.getAttribute("data-view")); });
    t.addEventListener("keydown", function (e) {
      var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
      if (j == null) return;
      e.preventDefault();
      showView(views[(j + views.length) % views.length].getAttribute("data-view"), true);
    });
  });

  // ---------------------------------------------------------------- predictions board
  function applyBoard() {
    var g = val(gameSel), team = val(teamSel), m = val(mktSel);
    var lightsOn = {};
    lightBtns.forEach(function (b) { if (b.getAttribute("aria-pressed") === "true") lightsOn[b.getAttribute("data-light")] = true; });
    var allLights = lightBtns.every(function (b) { return b.getAttribute("aria-pressed") === "true"; });
    var filtering = !!(g || team || m) || !allLights;
    var anyShown = 0;
    boardEl.querySelectorAll(".pp-game").forEach(function (card) {
      var teams = (card.getAttribute("data-teams") || "").split("|");
      if ((g && card.getAttribute("data-game") !== g) || (team && teams.indexOf(team) < 0)) { card.hidden = true; return; }
      var shown = 0;
      card.querySelectorAll(".pp-rows tr").forEach(function (tr) {
        var ok = (!team || tr.getAttribute("data-team") === team) && (!m || tr.getAttribute("data-market") === m) && (allLights || !!lightsOn[tr.getAttribute("data-light")]);
        tr.hidden = !ok;
        if (ok) shown++;
      });
      card.hidden = filtering && shown === 0;
      var locked = card.querySelector(".pp-locked");
      if (locked) locked.hidden = filtering;
      var gate = card.querySelector(".pp-gate");
      if (gate) gate.hidden = filtering && shown === 0;
      var none = card.querySelector(".pp-none");
      if (none) none.hidden = shown > 0 || !filtering;
      if (!card.hidden) anyShown++;
    });
    if (noneAll) noneAll.hidden = anyShown > 0 || !boardEl.querySelector(".pp-game");
  }

  lightBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("on", on);
      applyBoard();
    });
  });

  // ---------------------------------------------------------------- hit-rate heatmap
  function applyHeatmap() {
    var root = document.getElementById("hitRates");
    if (!root) return;
    var tbody = root.querySelector(".hm-table tbody");
    var sortSel = root.querySelector("#hmSort");
    var none = root.querySelector(".hm-none");
    var g = val(gameSel), t = val(teamSel), m = val(mktSel), shown = 0;
    root.querySelectorAll(".hm-table [data-m]").forEach(function (el) { el.hidden = !!m && el.getAttribute("data-m") !== m; });
    var rows = Array.prototype.slice.call(tbody.rows);
    rows.forEach(function (tr) {
      var ok = (!g || tr.getAttribute("data-game") === g) && (!t || tr.getAttribute("data-team") === t);
      tr.hidden = !ok;
      if (ok) shown++;
    });
    var k = sortSel ? sortSel.value : "name";
    function cellVal(tr, mk, w) {
      var c = tr.querySelector('td[data-m="' + mk + '"][data-w="' + w + '"]');
      var v = c ? c.getAttribute("data-v") : "";
      return v === "" ? -1 : Number(v);
    }
    var byName = function (a, b) { return a.getAttribute("data-name").localeCompare(b.getAttribute("data-name")); };
    rows.sort(function (a, b) {
      if (k === "name") return byName(a, b);
      if (k === "team") return a.getAttribute("data-team").localeCompare(b.getAttribute("data-team")) || byName(a, b);
      var mw = k.split("-");
      return cellVal(b, mw[0], mw[1]) - cellVal(a, mw[0], mw[1]) || byName(a, b);
    }).forEach(function (tr) { tbody.appendChild(tr); });
    if (none) none.hidden = shown > 0;
  }
  function wireHeatmap() {
    var s = document.getElementById("hmSort");
    if (s) s.addEventListener("change", applyHeatmap);
    applyHeatmap();
  }

  function applyAll() { applyBoard(); applyHeatmap(); }
  [gameSel, teamSel, mktSel].forEach(function (el) { if (el) el.addEventListener("change", applyAll); });

  // ---------------------------------------------------------------- members swap
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
    var hm = document.getElementById("propsHeatmap");
    if (hm && typeof j.heatmap === "string" && j.heatmap) { hm.innerHTML = j.heatmap; wireHeatmap(); }
    if (note) note.innerHTML = '<p class="note">Members view: every player on the board.</p>';
    applyAll();
  }

  showView("preds");
  wireHeatmap();
  applyBoard();
  loadMemberBoard().catch(function () {});
})();
