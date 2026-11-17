/* Player props results page (/props/results). Loaded as a module. Reads the public settled rows
   from #prData and redraws the headline record, chart, breakdowns and list with the same helpers
   the server used (/props-results-core.js), so the first paint and every filter change match.
   Filters: sport tabs; period (Season / Last 30 days / Last 7 days, ending today in Sydney); Green / Orange / Red
   (Green on by default); stat or market; side; date; game (only when a sport's game labels vary).
   The headline record follows the sport and the period only. NFL / NHL rows are data (the side season form favoured). */
import {
  filterRows, gameLabels, gameLabelsVary, hasSeasonAvg, datesOf, dateLabel, lightsLabel,
  heroHtml, chartBlockHtml, breakdownHtml, headHtml, rowHtml, listSummary, sportEmptyText,
  statsFor, callsFor, words, isDataSport, PERIODS, periodStart, esc,
} from "/props-results-core.js";

const $ = (id) => document.getElementById(id);
const dataEl = $("prData");
if (dataEl) {
  const DATA = JSON.parse(dataEl.textContent);
  const PAGE = DATA.page || 50;
  const all = (s) => DATA.sports[s] || [];
  const label = (s) => DATA.labels[s] || String(s).toUpperCase();
  const qa = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
  const PERIOD_NAME = Object.fromEntries(PERIODS);

  const sportTabs = qa(".pr-sports .pp-tab");
  const periodTabs = qa(".pr-period-tabs .pp-tab");
  const statWrap = document.querySelector(".pr-stat-tabs");
  const callWrap = document.querySelector(".pr-call-tabs");
  let statTabs = [], callTabs = [];
  const lightBtns = qa("#prLights .gf-btn");
  const modeBtns = qa(".pr-mode .gf-btn");
  const el = {
    empty: $("prSportEmpty"), body: $("prSportBody"), list: $("picks"), hero: $("prHero"), chart: $("prChart"),
    brk: $("prBreak"), brkTitle: $("prBreakTitle"), listTitle: $("prListTitle"), date: $("prDate"), game: $("prGame"),
    gameWrap: $("prGameWrap"), count: $("prCount"), head: $("prHead"), rows: $("prBody"), none: $("prNone"), more: $("prMore"),
  };
  const selected = sportTabs.find((t) => t.getAttribute("aria-selected") === "true");
  const phone = window.matchMedia ? window.matchMedia("(max-width: 640px)") : null;
  const state = { sport: selected ? selected.getAttribute("data-sport") : "", period: "season", stat: "all", call: "all", date: "all", game: "all", mode: "cum", limit: PAGE };

  const since = () => periodStart(state.period, DATA.today);
  const periodRows = () => filterRows(all(state.sport), { since: since() });
  const lightsOn = () => lightBtns.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-light"));
  const options = (allText, values, fmt) => [["all", allText]].concat(values.map((v) => [v, fmt(v)]))
    .map(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; return o; });
  const setOptions = (sel, opts) => { sel.textContent = ""; opts.forEach((o) => sel.appendChild(o)); sel.value = "all"; };
  const selectTab = (tabs, attr, value) => tabs.forEach((t) => {
    const on = t.getAttribute(attr) === value;
    t.setAttribute("aria-selected", on ? "true" : "false");
    t.tabIndex = on ? 0 : -1;
  });
  const tabsHtml = (key, items) => items.map(([id, text], i) =>
    `<button type="button" role="tab" class="pp-tab" data-${key}="${esc(id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(text)}</button>`).join("");

  /** Stat / market and side tabs for the sport. */
  function buildListTabs() {
    const W = words(state.sport);
    statWrap.innerHTML = tabsHtml("stat", [["all", W.allStats]].concat(statsFor(state.sport)));
    callWrap.innerHTML = tabsHtml("call", [["all", W.allCalls]].concat(callsFor(state.sport).map((c) => [c, c])));
    callWrap.setAttribute("aria-label", W.call);
    statTabs = qa(".pr-stat-tabs .pp-tab");
    callTabs = qa(".pr-call-tabs .pp-tab");
    tabKeys(statTabs, (t) => setFilter("stat", t.getAttribute("data-stat")));
    tabKeys(callTabs, (t) => setFilter("call", t.getAttribute("data-call")));
    el.brkTitle.textContent = isDataSport(state.sport) ? "By market and side" : "By stat and call";
    el.listTitle.textContent = `Settled ${W.calls}`;
  }

  /** Sport or period changed: headline, empty card, date + game options. */
  function loadSport() {
    const sportAll = all(state.sport);
    const has = sportAll.length > 0;
    el.empty.hidden = has;
    el.body.hidden = !has;
    el.list.hidden = !has;
    if (!has) { el.empty.querySelector("p").textContent = sportEmptyText(label(state.sport), state.sport); return; }
    const rows = periodRows();
    el.hero.innerHTML = heroHtml(rows, label(state.sport), state.sport, state.period === "season" ? "" : PERIOD_NAME[state.period]);
    setOptions(el.date, options("All dates", datesOf(rows), dateLabel));
    const vary = gameLabelsVary(sportAll);
    el.gameWrap.hidden = !vary;
    setOptions(el.game, options("All games", vary ? gameLabels(rows) : [], (g) => g));
    state.date = state.game = "all";
  }

  /** Lights / stat / call / date / game / mode / page changed. */
  function apply() {
    const sportAll = all(state.sport);
    if (!sportAll.length) return;
    const rows = periodRows();
    const lights = lightsOn();
    const lit = filterRows(rows, { lights });
    el.chart.innerHTML = chartBlockHtml(lit, state.mode, lightsLabel(lights), {
      narrow: !!(phone && phone.matches), sport: state.sport, periodName: state.period === "season" ? "" : PERIOD_NAME[state.period],
    });
    el.brk.innerHTML = breakdownHtml(lit, state);
    const showGame = gameLabelsVary(sportAll);
    const showAvg = hasSeasonAvg(sportAll);
    const shown = filterRows(rows, { lights, stat: state.stat, call: state.call, date: state.date, game: showGame ? state.game : "all" });
    el.count.innerHTML = listSummary(shown, rows.length, state.sport);
    el.head.innerHTML = headHtml(showGame, showAvg, state.sport);
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
    state.stat = state.call = "all";
    state.limit = PAGE;
    buildListTabs();
    loadSport();
    apply();
  });
  tabKeys(periodTabs, (t) => {
    state.period = t.getAttribute("data-period");
    selectTab(periodTabs, "data-period", state.period);
    state.limit = PAGE;
    loadSport();
    apply();
  });
  buildListTabs();

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
  // Breakdown tiles: tap to filter the list by that stat / side (tap again to clear), then show it.
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
