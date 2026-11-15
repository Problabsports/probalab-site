/* NBA player props page: members session check (same as the members lobby: Supabase session
   + member_allowlist row) swaps in the full board from /api/props-nba. Team and Greens-only
   filters work on whatever board is on the page. */
(function () {
  var SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  var SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
  var boardEl = document.getElementById("propsBoard");
  var teamSel = document.getElementById("ppTeam");
  var greensBtn = document.getElementById("ppGreens");
  var note = document.getElementById("ppMemberNote");
  if (!boardEl) return;

  function applyFilters() {
    var team = teamSel ? teamSel.value : "";
    var greens = greensBtn ? greensBtn.getAttribute("aria-pressed") === "true" : false;
    boardEl.querySelectorAll(".pp-game").forEach(function (card) {
      var anyTeam = false;
      card.querySelectorAll(".pp-team").forEach(function (t) {
        var teamOk = !team || t.getAttribute("data-team") === team;
        var visibleRows = 0;
        t.querySelectorAll(".pp-rows tr").forEach(function (tr) {
          var show = !greens || tr.getAttribute("data-green") === "1";
          tr.hidden = !show;
          if (show) visibleRows++;
        });
        var locked = t.querySelector(".pp-locked");
        if (locked) locked.hidden = greens;
        var none = t.querySelector(".pp-none");
        if (none) none.hidden = !(greens && visibleRows === 0);
        t.hidden = !teamOk;
        if (teamOk) anyTeam = true;
      });
      card.hidden = !anyTeam;
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
      if (r.status === 401 && note) note.innerHTML = 'You are signed in, but this account is not a paying member yet. <a href="/join">Join to see every player</a>.';
      return;
    }
    var j = await r.json();
    if (!j || !j.ok || !j.html) return;
    boardEl.innerHTML = j.html;
    if (note) note.textContent = "Members view: every player on the board.";
    applyFilters();
  }

  applyFilters();
  loadMemberBoard().catch(function () {});
})();
