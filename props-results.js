/* Player props results page (/props/results). Loaded as a module. Reads the public settled rows
   from #prData and redraws the headline record, chart, breakdowns and list with the same helpers
   the server used (/props-results-core.js), so the first paint and every filter change match.
   Filters: sport tabs; Green / Orange / Red (Green on by default); stat; Over/Under; date; game
   (only when a sport's game labels vary). The headline record follows the sport only. */
import {
  filterRows, gameLabels, gameLabelsVary, hasSeasonAvg, datesOf, dateLabel, lightsLabel,
  heroHtml, chartBlockHtml, breakdownHtml, headHtml, rowHtml, listSummary, sportEmptyText,
} from "/props-results-core.js";

const $ = (id) => document.getElementById(id);
const dataEl = $("prData");
if (dataEl) {
  const DATA = JSON.parse(dataEl.textContent);
  const PAGE = DATA.page || 50;
  const all = (s) => DATA.sports[s] || [];
  const label = (s) => DATA.labels[s] || String(s).toUpperCase();
  const qa = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));

  const sportTabs = qa(".pr-sports .pp-tab");
  const statTabs = qa(".pr-stat-tabs .pp-tab");
  const callTabs = qa(".pr-call-tabs .pp-tab");
  const lightBtns = qa("#prLights .gf-btn");
  const modeBtns = qa(".pr-mode .gf-btn");
  const el = {
    empty: $("prSportEmpty"), body: $("prSportBody"), list: $("picks"), hero: $("prHero"), chart: $("prChart"),
    brk: $("prBreak"), date: $("prDate"), game: $("prGame"), gameWrap: $("prGameWrap"), count: $("prCount"),
    head: $("prHead"), rows: $("prBody"), none: $("prNone"), more: $("prMore"),
  };
  const selected = sportTabs.find((t) => t.getAttribute("aria-selected") === "true");
  const phone = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
  const state = { sport: selected ? selected.getAttribute("data-sport") : "", stat: "all", call: "all", date: "all", game: "all", mode: "cum", limit: PAGE };

  const lightsOn = () => lightBtns.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-light"));
  const options = (allText, values, fmt) => [["all", allText]].concat(values.map((v) => [v, fmt(v)]))
    .map(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; return o; });
  const setOptions = (sel, opts) => { sel.textContent = ""; opts.forEach((o) => sel.appendChild(o)); sel.value = "all"; };
  const selectTab = (tabs, attr, value) => tabs.forEach((t) => {
    const on = t.getAttribute(attr) === value;
    t.setAttribute("aria-selected", on ? "true" : "false");
    t.tabIndex = on ? 0 : -1;
  });

  /** Sport changed: headline, empty card, date + game options. */
  function loadSport() {
    const rows = all(state.sport);
    const has = rows.length > 0;
    el.empty.hidden = has;
    el.body.hidden = !has;
    el.list.hidden = !has;
    if (!has) { el.empty.querySelector("p").textContent = sportEmptyText(label(state.sport)); return; }
    el.hero.innerHTML = heroHtml(rows, label(state.sport));
    setOptions(el.date, options("All dates", datesOf(rows), dateLabel));
    const vary = gameLabelsVary(rows);
    el.gameWrap.hidden = !vary;
    setOptions(el.game, options("All games", vary ? gameLabels(rows) : [], (g) => g));
  }

  /** Lights / stat / call / date / game / mode / page changed. */
  function apply() {
    const rows = all(state.sport);
    if (!rows.length) return;
    const lights = lightsOn();
    const lit = filterRows(rows, { lights });
    el.chart.innerHTML = chartBlockHtml(lit, state.mode, lightsLabel(lights), { narrow: !!(phone && phone.matches) });
    el.brk.innerHTML = breakdownHtml(lit, state);
    const showGame = gameLabelsVary(rows);
    const showAvg = hasSeasonAvg(rows);
    const shown = filterRows(rows, { lights, stat: state.stat, call: state.call, date: state.date, game: showGame ? state.game : "all" });
    el.count.innerHTML = listSummary(shown, rows.length);
    el.head.innerHTML = headHtml(showGame, showAvg);
    el.rows.innerHTML = shown.slice(0, state.limit).map((r) => rowHtml(r, showGame, showAvg)).join("");
    el.none.hidden = shown.length > 0;
    el.more.hidden = shown.length <= state.limit;
  }

  function setFilter(key, value) {
    state[key] = value;
    state.limit = PAGE;
    if (key === "stat") selectTab(statTabs, "data-stat", value);
    if (key === "call") selectTab(callTabs, "data-call", value);
    apply();
  }

  function tabKeys(tabs, onPick) {
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => onPick(t));
      t.addEventListener("keydown", (e) => {
        const j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
        if (j == null) return;
        e.preventDefault();
        const next = tabs[(j + tabs.length) % tabs.length];
        onPick(next);
        next.focus();
      });
    });
  }

  tabKeys(sportTabs, (t) => {
    state.sport = t.getAttribute("data-sport");
    selectTab(sportTabs, "data-sport", state.sport);
    state.stat = state.call = state.date = state.game = "all";
    selectTab(statTabs, "data-stat", "all");
    selectTab(callTabs, "data-call", "all");
    state.limit = PAGE;
    loadSport();
    apply();
  });
  tabKeys(statTabs, (t) => setFilter("stat", t.getAttribute("data-stat")));
  tabKeys(callTabs, (t) => setFilter("call", t.getAttribute("data-call")));

  lightBtns.forEach((b) => b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.classList.toggle("on", on);
    state.limit = PAGE;
    apply();
  }));
  modeBtns.forEach((b) => b.addEventListener("click", () => {
    state.mode = b.getAttribute("data-mode");
    modeBtns.forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on ? "true" : "false"); });
    apply();
  }));
  // Breakdown tiles: tap to filter the list by that stat / call (tap again to clear), then show it.
  el.brk.addEventListener("click", (e) => {
    const tile = e.target.closest(".pr-bk");
    if (!tile) return;
    const key = tile.getAttribute("data-filter"), value = tile.getAttribute("data-value");
    setFilter(key, state[key] === value ? "all" : value);
  });
  el.date.addEventListener("change", () => setFilter("date", el.date.value));
  el.game.addEventListener("change", () => setFilter("game", el.game.value));
  el.more.addEventListener("click", () => { state.limit += PAGE; apply(); });
  // The server draws the wide chart; phones get the narrow one (and it follows rotation).
  if (phone) {
    if (phone.matches) apply();
    if (phone.addEventListener) phone.addEventListener("change", apply);
  }
}
