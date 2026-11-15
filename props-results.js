/* Player props results page (/props/results): sport toggles, Green / Orange / Red chips (Green on by
   default), stat tabs, and the summary + per-stat hit rates recomputed from the rendered rows. */
(function () {
  var list = document.getElementById("prList");
  if (!list) return;
  var PAGE = 50;
  var rows = Array.prototype.slice.call(list.querySelectorAll(".pr-row"));
  var sportTabs = Array.prototype.slice.call(document.querySelectorAll(".pr-sports .pp-tab"));
  var statTabs = Array.prototype.slice.call(document.querySelectorAll(".pr-stat-tabs .pp-tab"));
  var lightBtns = Array.prototype.slice.call(document.querySelectorAll("#prLights .gf-btn"));
  var cards = document.getElementById("prCards");
  var byStat = document.getElementById("prByStat");
  var none = document.getElementById("prNone");
  var more = document.getElementById("prMore");
  var state = {
    sport: sportTabs.length ? sportTabs[0].getAttribute("data-sport") : "",
    stat: "all",
    limit: PAGE,
  };

  function lightsOn() {
    var on = {};
    lightBtns.forEach(function (b) { if (b.getAttribute("aria-pressed") === "true") on[b.getAttribute("data-light")] = true; });
    return on;
  }

  function tally(rs) {
    var w = 0, l = 0, p = 0;
    rs.forEach(function (r) { var x = r.getAttribute("data-result"); if (x === "W") w++; else if (x === "L") l++; else p++; });
    return { pct: w + l ? Math.round((w / (w + l)) * 100) + "%" : "—", rec: w + "–" + l + (p ? "–" + p : "") };
  }
  function fill(el, t) {
    el.querySelector('[data-v="pct"]').textContent = t.pct;
    el.querySelector('[data-v="rec"]').textContent = t.rec;
  }

  function apply() {
    var on = lightsOn();
    var inSport = rows.filter(function (r) { return r.getAttribute("data-sport") === state.sport; });
    var inStat = inSport.filter(function (r) { return state.stat === "all" || r.getAttribute("data-stat") === state.stat; });

    // Summary cards: every colour, for this sport and stat tab.
    if (cards) cards.querySelectorAll("[data-card]").forEach(function (c) {
      var l = c.getAttribute("data-card");
      fill(c, tally(inStat.filter(function (r) { return r.getAttribute("data-light") === l; })));
    });
    // Per-stat row: the selected colours, for this sport.
    var lit = inSport.filter(function (r) { return !!on[r.getAttribute("data-light")]; });
    if (byStat) byStat.querySelectorAll("[data-stat-cell]").forEach(function (c) {
      var s = c.getAttribute("data-stat-cell");
      c.classList.toggle("on", state.stat === s);
      fill(c, tally(lit.filter(function (r) { return r.getAttribute("data-stat") === s; })));
    });

    // List: this sport, this stat, the selected colours, newest first (server order).
    var match = 0;
    rows.forEach(function (r) {
      var ok = r.getAttribute("data-sport") === state.sport &&
        (state.stat === "all" || r.getAttribute("data-stat") === state.stat) &&
        !!on[r.getAttribute("data-light")];
      if (ok) match++;
      r.hidden = !ok || match > state.limit;
    });
    if (none) none.hidden = match > 0;
    if (more) more.hidden = match <= state.limit;
  }

  function tabGroup(tabs, key) {
    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var sel = i === j;
        t.setAttribute("aria-selected", sel ? "true" : "false");
        t.tabIndex = sel ? 0 : -1;
        if (sel && focus) t.focus();
      });
      state[key] = tabs[i].getAttribute("data-" + key);
      if (key === "sport") {
        state.stat = "all";
        if (statTabs.length) statTabs.forEach(function (t, j) { t.setAttribute("aria-selected", j === 0 ? "true" : "false"); t.tabIndex = j === 0 ? 0 : -1; });
      }
      state.limit = PAGE;
      apply();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i); });
      t.addEventListener("keydown", function (e) {
        var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
        if (j == null) return;
        e.preventDefault();
        select((j + tabs.length) % tabs.length, true);
      });
    });
  }
  tabGroup(sportTabs, "sport");
  tabGroup(statTabs, "stat");

  lightBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("on", on);
      state.limit = PAGE;
      apply();
    });
  });
  if (more) more.addEventListener("click", function () { state.limit += PAGE; apply(); });

  apply();
})();
