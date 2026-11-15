// Public player props results (/props/results): every graded call, newest first.
// Data: Supabase row public.tips_page_snapshot id="props-results", read on the server with the
// service key (same read + 60s per-isolate cache as /props/nba). Shape:
//   { generated_at, sports: { nba: { rows: [ { date, game, player, stat, line, call, pct, light,
//                                              actual, result } ] }, nfl: {...}, nhl: {...} } }
// Only settled rows (result W / L / P with an actual) are ever rendered; open calls never are.
// No units, prices, ROI or profit.
import { esc } from "./site.js";
import { supabaseAdmin } from "./membership.js";
import { memberButtons } from "./nba-props.js";

export const SNAPSHOT_ID = "props-results";
const SNAPSHOT_PATH = `/rest/v1/tips_page_snapshot?select=payload,generated_at&id=eq.${SNAPSHOT_ID}`;
const CACHE_MS = 60 * 1000;
export const PAGE_SIZE = 50;

export const STATS = [
  ["points", "Points"],
  ["rebounds", "Rebounds"],
  ["assists", "Assists"],
  ["threes", "Threes"],
];
const STAT_LABEL = Object.fromEntries(STATS);
export const LIGHTS = [
  ["GREEN", "Green"],
  ["ORANGE", "Orange"],
  ["RED", "Red"],
];
// Known sports first, in this order; any other sport in the data follows alphabetically.
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
const RESULTS = new Set(["W", "L", "P"]);

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

/** One row normalised, or null when it is not a settled call we can show. */
export function normaliseRow(r, sport) {
  if (!r || typeof r !== "object") return null;
  const result = String(r.result || "").trim().toUpperCase();
  if (!RESULTS.has(result)) return null; // open or ungraded: never shown
  const actual = num(r.actual);
  if (actual == null) return null;
  const stat = String(r.stat || "").trim().toLowerCase();
  if (!STAT_LABEL[stat]) return null;
  const date = String(r.date || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const call = /^u/i.test(String(r.call || "")) ? "Under" : /^o/i.test(String(r.call || "")) ? "Over" : null;
  if (!call) return null;
  const p = prob(r.pct);
  const light = lightFor(r, p);
  if (!light) return null;
  return { sport, date, game: String(r.game || ""), player: String(r.player || ""), stat, line: num(r.line), call, p, light, actual, result };
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

export function sportIds(results) {
  const ids = Object.keys((results && results.sports) || {});
  return ids.sort((a, b) => {
    const ia = SPORT_ORDER.indexOf(a), ib = SPORT_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
}

export async function loadResults(ctx, opts = {}) {
  const now = opts.now ?? ctx.now ?? Date.now();
  return resultsFrom(await readSnapshotRow(ctx.env || {}, now));
}

// ------------------------------------------------------------------ tallies
/** { w, l, p, pct } where pct = w / (w + l), pushes left out; pct null with no decided calls. */
export function tally(rows) {
  let w = 0, l = 0, p = 0;
  for (const r of rows) r.result === "W" ? w++ : r.result === "L" ? l++ : p++;
  return { w, l, p, pct: w + l ? w / (w + l) : null };
}
const pctText = (t) => (t.pct == null ? "—" : `${Math.round(t.pct * 100)}%`);
const recText = (t) => `${t.w}–${t.l}${t.p ? `–${t.p}` : ""}`;

// ------------------------------------------------------------------ rendering
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-14" → "Sat 14 Nov" (a calendar date, no time zone shift). */
export function dateLabel(d) {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return `${DAYS[dt.getUTCDay()]} ${day} ${MONTHS[m - 1]}`;
}
/** Same date, weekday in its own span so phones can drop it. */
const dateHtml = (d) => {
  const [wd, ...rest] = dateLabel(d).split(" ");
  return `<span class="pr-wd">${wd} </span>${rest.join(" ")}`;
};
const lineText = (x) => (x == null ? "—" : String(x));

function summaryCards(rows) {
  return LIGHTS.map(([cls, label]) => {
    const t = tally(rows.filter((r) => r.light === cls));
    return `<div class="pr-card ${cls}" data-card="${cls}">
      <p class="pr-card-k">${label} hit rate</p>
      <p class="pr-card-v" data-v="pct">${pctText(t)}</p>
      <p class="pr-card-r mono" data-v="rec">${recText(t)}</p>
    </div>`;
  }).join("");
}

function statRow(rows) {
  return `<div class="pr-stats" aria-label="Hit rate by stat">${STATS.map(([id, label]) => {
    const t = tally(rows.filter((r) => r.stat === id));
    return `<div class="pr-stat" data-stat-cell="${id}"><span class="pr-stat-k">${label}</span><span class="pr-stat-v mono" data-v="pct">${pctText(t)}</span><span class="pr-stat-r mono" data-v="rec">${recText(t)}</span></div>`;
  }).join("")}</div>`;
}

const BADGE = { W: ["W", "Win"], L: ["L", "Loss"], P: ["P", "Push"] };
function callRow(r, visible) {
  const [b, title] = BADGE[r.result];
  return `<li class="pr-row ${r.light}" data-sport="${esc(r.sport)}" data-stat="${r.stat}" data-light="${r.light}" data-result="${r.result}"${visible ? "" : " hidden"}>
      <span class="pr-date mono">${dateHtml(r.date)}</span>
      <span class="pr-player"${r.game ? ` title="${esc(r.game)}"` : ""}>${esc(r.player)}</span>
      <span class="pr-statn">${esc(STAT_LABEL[r.stat])}</span>
      <span class="pr-line mono">${esc(lineText(r.line))}</span>
      <span class="pr-call mono">${r.call}</span>
      <span class="pr-actual mono">${esc(String(r.actual))}</span>
      <span class="pr-badge ${r.result}" title="${title}">${b}</span>
    </li>`;
}

/** Default view: first sport, Green only, All stats. */
export function renderBody(results) {
  if (!results) return `<section class="panel pr-empty"><p>${EMPTY_TEXT}</p></section>`;
  const ids = sportIds(results);
  const first = ids[0];
  const all = ids.flatMap((id) => results.sports[id]);
  const start = results.sports[first];
  const green = start.filter((r) => r.light === "GREEN");

  const sportTabs = `<div class="pp-tabs pr-sports" role="tablist" aria-label="Sport">${ids.map((id, i) =>
    `<button type="button" role="tab" class="pp-tab" data-sport="${esc(id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(sportLabel(id))}</button>`).join("")}</div>`;
  const lights = `<nav class="game-filters lights" id="prLights" aria-label="Filter by light">${LIGHTS.map(([cls, label]) =>
    `<button type="button" class="gf-btn ${cls}${cls === "GREEN" ? " on" : ""}" data-light="${cls}" aria-pressed="${cls === "GREEN"}">${label}</button>`).join("")}</nav>`;
  const statTabs = `<div class="pp-tabs pr-stat-tabs" role="tablist" aria-label="Stat">${[["all", "All"], ...STATS].map(([id, label], i) =>
    `<button type="button" role="tab" class="pp-tab" data-stat="${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(label)}</button>`).join("")}</div>`;

  let shown = 0;
  const list = all.map((r) => {
    const vis = r.sport === first && r.light === "GREEN" && shown < PAGE_SIZE;
    if (vis) shown++;
    return callRow(r, vis);
  }).join("");

  return `${sportTabs}
  <div class="game-filter-bar pr-filters" role="region" aria-label="Results filters">${lights}</div>
  ${statTabs}
  <section class="pr-summary" aria-label="Hit rate summary"><div class="pr-cards" id="prCards">${summaryCards(start)}</div></section>
  <section class="panel pr-members">
    <h2>Members get today's full player props</h2>
    ${memberButtons("pp-cta-left")}
  </section>
  <section class="panel pr-bystat-panel"><h2>Hit rate by stat</h2><div id="prByStat">${statRow(green)}</div></section>
  <section class="panel pr-list-panel">
    <h2>Settled calls</h2>
    <div class="pr-list-head mono" aria-hidden="true"><span>Date</span><span>Player</span><span>Stat</span><span>Line</span><span>Call</span><span>Actual</span><span></span></div>
    <ul class="pr-list" id="prList">${list}</ul>
    <p class="pr-none small" id="prNone"${green.length ? " hidden" : ""}>No settled calls match these filters yet.</p>
    <p class="pr-more-wrap"><button type="button" class="btn btn-ghost pr-more" id="prMore"${green.length > PAGE_SIZE ? "" : " hidden"}>Show more</button></p>
  </section>`;
}
