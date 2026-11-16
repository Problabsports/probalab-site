// Public player props results (/props/results): every settled call, green first.
// Data: Supabase row public.tips_page_snapshot id="props-results", read on the server with the
// service key (same read + 60s per-isolate cache as /props/nba). Shape:
//   { generated_at, sports: { nba: { rows: [ { date, game, player, stat, line, call, pct, light,
//                                              actual, result, team?, opp?, home?, season_avg? } ] },
//                             nfl: {...}, nhl: {...} } }
// Only settled rows (result W / L / P / V) are ever rendered; open calls never are.
// V = void (the player did not play, actual null). Only W and L count in any record or rate. The raw row and the
// service key never reach the browser: the page embeds only the normalised public fields below.
// No units, prices, ROI or profit. Today's board (snapshot "nba-props") is never read here.
// Numbers, charts and table rows come from /props-results-core.js, shared with the browser.
import { esc } from "./site.js";
import { supabaseAdmin } from "./membership.js";
import { memberButtons } from "./nba-props.js";
import {
  STATS, STAT_LABEL, LIGHTS, CALLS, tally, dateLabel, datesOf, gameLabels, gameLabelsVary, hasSeasonAvg, filterRows,
  heroHtml, chartBlockHtml, breakdownHtml, headHtml, rowHtml, listSummary, sportEmptyText, lightsLabel,
} from "../../props-results-core.js";

export { STATS, LIGHTS, tally, dateLabel, gameLabelsVary, sportEmptyText };
export const SNAPSHOT_ID = "props-results";
const SNAPSHOT_PATH = `/rest/v1/tips_page_snapshot?select=payload,generated_at&id=eq.${SNAPSHOT_ID}`;
const CACHE_MS = 60 * 1000;
export const PAGE_SIZE = 50;

// Sports always offered as tabs, in this order; any other sport in the data follows alphabetically.
const SPORT_ORDER = ["nba", "nfl", "nhl"];
const SPORT_LABEL = { nba: "NBA", nfl: "NFL", nhl: "NHL" };
export const sportLabel = (s) => SPORT_LABEL[s] || String(s).toUpperCase();
export const EMPTY_TEXT = "Results will appear here after the first graded day.";

// ------------------------------------------------------------------ loading
let rowCache = null; // { at, row }, per isolate

/** Test hook: forget the cached Supabase row. */
export function _resetResultsCache() {
  rowCache = null;
}

async function readSnapshotRow(env, now) {
  if (rowCache && now - rowCache.at >= 0 && now - rowCache.at < CACHE_MS) return rowCache.row;
  let row = null;
  try {
    const rows = await supabaseAdmin(env, "GET", SNAPSHOT_PATH);
    row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.log(`props-results: snapshot read failed (${(e && e.status) || "no response"})`);
  }
  rowCache = { at: now, row };
  return row;
}

const num = (x) => (x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
const RESULTS = new Set(["W", "L", "P", "V"]);

/** 0.62 or 62 → 0.62; anything else → null. */
function prob(x) {
  const n = num(x);
  if (n == null) return null;
  return n > 1 ? n / 100 : n;
}

/** Light from the data, else from the % (green 60%+, orange 55–59%, red under 55%). */
function lightFor(r, p) {
  const l = String(r.light || "").trim().toUpperCase();
  if (l === "GREEN" || l === "ORANGE" || l === "RED") return l;
  if (p == null) return "";
  const shown = Math.round(p * 100);
  return shown >= 60 ? "GREEN" : shown >= 55 ? "ORANGE" : "RED";
}

/** true / false (also "true" / "false"), else null. */
function bool(x) {
  if (x === true || x === false) return x;
  const s = String(x ?? "").trim().toLowerCase();
  return s === "true" ? true : s === "false" ? false : null;
}
const text = (x) => (x == null ? "" : String(x).trim());

/**
 * One row normalised, or null when it is not a settled call we can show.
 * Settled = result W, L, P or V. W and L need an actual; a push may come without one; a void
 * (did not play) never has one. Optional public fields team, opp, home (bool) and season_avg are
 * kept when present and valid, and left empty / null otherwise.
 */
export function normaliseRow(r, sport) {
  if (!r || typeof r !== "object") return null;
  const result = String(r.result || "").trim().toUpperCase();
  if (!RESULTS.has(result)) return null; // open or ungraded: never shown
  const actual = result === "V" ? null : num(r.actual);
  if (actual == null && (result === "W" || result === "L")) return null;
  const stat = String(r.stat || "").trim().toLowerCase();
  if (!STAT_LABEL[stat]) return null;
  const date = String(r.date || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const call = /^u/i.test(String(r.call || "")) ? "Under" : /^o/i.test(String(r.call || "")) ? "Over" : null;
  if (!call) return null;
  const p = prob(r.pct);
  const light = lightFor(r, p);
  if (!light) return null;
  return {
    sport, date, game: text(r.game), player: String(r.player || ""), stat, line: num(r.line), call, p, light, actual, result,
    team: text(r.team), opp: text(r.opp), home: bool(r.home), season_avg: num(r.season_avg),
  };
}

/** { generated_at, sports: { id: rows[] } } with settled rows only, newest first; null when empty. */
export function resultsFrom(row) {
  const payload = row && row.payload;
  if (!payload || typeof payload !== "object" || !payload.sports || typeof payload.sports !== "object") return null;
  const sports = {};
  for (const [id, v] of Object.entries(payload.sports)) {
    const key = String(id).toLowerCase();
    const rows = (Array.isArray(v && v.rows) ? v.rows : []).map((r) => normaliseRow(r, key)).filter(Boolean);
    if (!rows.length) continue;
    rows.sort((a, b) => b.date.localeCompare(a.date) || a.game.localeCompare(b.game) || a.player.localeCompare(b.player) || a.stat.localeCompare(b.stat));
    sports[key] = rows;
  }
  if (!Object.keys(sports).length) return null;
  return { generated_at: payload.generated_at || row.generated_at || null, sports };
}

const bySportOrder = (a, b) => {
  const ia = SPORT_ORDER.indexOf(a), ib = SPORT_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
};
/** Sports with settled rows: NBA, NFL, NHL first, then the rest alphabetically. */
export function sportIds(results) {
  return Object.keys((results && results.sports) || {}).sort(bySportOrder);
}
/** Tabs: NBA, NFL and NHL always (an empty one gets a calm card), then any other sport in the data. */
export function tabSports(results) {
  return [...new Set([...SPORT_ORDER, ...sportIds(results)])].sort(bySportOrder);
}

export async function loadResults(ctx, opts = {}) {
  const now = opts.now ?? ctx.now ?? Date.now();
  return resultsFrom(await readSnapshotRow(ctx.env || {}, now));
}

/**
 * What the browser and the CSV get: the normalised public fields only, per sport. When a sport's
 * game labels do not vary they are left blank (the column is hidden; nothing is "corrected").
 */
export function publicRows(results) {
  const out = {};
  for (const id of sportIds(results)) {
    const rows = results.sports[id];
    const keepGame = gameLabelsVary(rows);
    out[id] = rows.map((r) => ({
      sport: r.sport, date: r.date, game: keepGame ? r.game : "", player: r.player, stat: r.stat, line: r.line, call: r.call,
      p: r.p, light: r.light, actual: r.actual, result: r.result, team: r.team, opp: r.opp, home: r.home, season_avg: r.season_avg,
    }));
  }
  return out;
}

// ------------------------------------------------------------------ CSV
const csvEsc = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Every settled call, every sport and light, same public fields as the page. */
export function renderPropsCsv(results) {
  const lines = [["sport", "date", "game", "player", "team", "opp", "home", "stat", "line", "season_avg", "call", "chance", "light", "actual", "result"].join(",")];
  if (results) {
    const rows = publicRows(results);
    for (const id of sportIds(results)) {
      for (const r of rows[id]) {
        lines.push([r.sport, r.date, r.game, r.player, r.team, r.opp, r.home, r.stat, r.line, r.season_avg, r.call, r.p == null ? "" : r.p.toFixed(2), r.light, r.actual, r.result].map(csvEsc).join(","));
      }
    }
  }
  return lines.join("\n") + "\n";
}

// ------------------------------------------------------------------ rendering
const DEFAULT_LIGHTS = ["GREEN"];

function optionsHtml(all, values, label) {
  return `<option value="all">${esc(all)}</option>${values.map((v) => `<option value="${esc(v)}">${esc(label(v))}</option>`).join("")}`;
}

/** Initial view: first sport with settled rows, Green only, every stat / call / date. */
export function renderBody(results) {
  if (!results) return `<section class="panel pr-empty"><p>${EMPTY_TEXT}</p></section>`;
  const tabs = tabSports(results);
  const first = sportIds(results)[0];
  const rows = results.sports[first];
  const lit = filterRows(rows, { lights: DEFAULT_LIGHTS });
  const showGame = gameLabelsVary(rows);
  const showAvg = hasSeasonAvg(rows);
  const data = JSON.stringify({ sports: publicRows(results), labels: Object.fromEntries(tabs.map((id) => [id, sportLabel(id)])), page: PAGE_SIZE })
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

  const sportTabs = `<div class="pp-tabs pr-sports" role="tablist" aria-label="Sport">${tabs.map((id) =>
    `<button type="button" role="tab" class="pp-tab" data-sport="${esc(id)}" aria-selected="${id === first}" tabindex="${id === first ? 0 : -1}">${esc(sportLabel(id))}</button>`).join("")}</div>`;
  const lights = `<nav class="game-filters lights" id="prLights" aria-label="Filter by light">${LIGHTS.map(([cls, label]) =>
    `<button type="button" class="gf-btn ${cls}${DEFAULT_LIGHTS.includes(cls) ? " on" : ""}" data-light="${cls}" aria-pressed="${DEFAULT_LIGHTS.includes(cls)}">${label}</button>`).join("")}</nav>`;
  const tabGroup = (cls, key, items, label) => `<div class="pp-tabs ${cls}" role="tablist" aria-label="${label}">${items.map(([id, text], i) =>
    `<button type="button" role="tab" class="pp-tab" data-${key}="${esc(id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(text)}</button>`).join("")}</div>`;

  return `${sportTabs}
  <div class="panel pr-empty" id="prSportEmpty" hidden><p></p></div>
  <div id="prSportBody">
    <section class="panel green-lead pr-hero" id="prHero" aria-label="Headline record">${heroHtml(rows, sportLabel(first))}</section>
    <div class="game-filter-bar pr-filters" role="region" aria-label="Light filter">
      ${lights}
      <p class="small pr-filter-note">Lights change the chart, breakdowns and list. The record above always counts every settled call.</p>
    </div>
    <section class="panel pr-growth" id="growth">
      <div class="pr-head">
        <h2>Hit rate over time</h2>
        <div class="game-filters pr-mode" role="group" aria-label="Chart view">
          <button type="button" class="gf-btn on" data-mode="cum" aria-pressed="true">Cumulative</button>
          <button type="button" class="gf-btn" data-mode="day" aria-pressed="false">Daily</button>
        </div>
      </div>
      <div id="prChart">${chartBlockHtml(lit, "cum", lightsLabel(DEFAULT_LIGHTS))}</div>
    </section>
    <section class="panel pr-break" aria-label="Breakdowns">
      <div class="pr-head"><h2>By stat and call</h2><p class="small">Tap a tile to filter the settled list.</p></div>
      <div id="prBreak">${breakdownHtml(lit)}</div>
    </section>
  </div>
  <section class="panel pr-members">
    <h2>Members get today's full player props</h2>
    ${memberButtons("pp-cta-left")}
  </section>
  <section class="panel pr-list-panel" id="picks">
    <div class="toolbar results-toolbar">
      <h2 class="grow">Settled calls</h2>
      <a class="csv-btn" href="/props/results.csv">Download CSV</a>
    </div>
    <div class="pr-list-filters">
      ${tabGroup("pr-stat-tabs", "stat", [["all", "All stats"], ...STATS], "Stat")}
      ${tabGroup("pr-call-tabs", "call", [["all", "Over + Under"], ...CALLS.map((c) => [c, c])], "Our call")}
      <div class="pr-selects">
        <label class="pp-team-filter">Date <select id="prDate">${optionsHtml("All dates", datesOf(rows), dateLabel)}</select></label>
        <label class="pp-team-filter" id="prGameWrap"${showGame ? "" : " hidden"}>Game <select id="prGame">${optionsHtml("All games", showGame ? gameLabels(rows) : [], (g) => g)}</select></label>
      </div>
    </div>
    <p class="pr-count" id="prCount">${listSummary(lit, rows.length)}</p>
    <div class="tablewrap pr-tablewrap"><table class="record-picks pr-table">
      <thead id="prHead">${headHtml(showGame, showAvg)}</thead>
      <tbody id="prBody">${lit.slice(0, PAGE_SIZE).map((r) => rowHtml(r, showGame, showAvg)).join("")}</tbody>
    </table></div>
    <p class="pr-none small" id="prNone"${lit.length ? " hidden" : ""}>No settled calls match these filters yet.</p>
    <p class="pr-more-wrap"><button type="button" class="btn btn-ghost pr-more" id="prMore"${lit.length > PAGE_SIZE ? "" : " hidden"}>Show more</button></p>
  </section>
  <script type="application/json" id="prData">${data}</script>`;
}
