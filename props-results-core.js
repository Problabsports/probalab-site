// Player props results (/props/results): shared, pure helpers used by BOTH the server
// (functions/_shared/props-results.js renders the first view) and the browser (/props-results.js
// re-renders on every filter change), so the numbers and charts are always drawn the same way.
// Input rows are already normalised, settled-only, public fields:
//   { sport, date, game, player, stat, line, call, p, light, actual, result,
//     team?, opp?, home?, season_avg? }
// result: W, L, P (push) or V (void: the player did not play). Only W and L count anywhere in a
// record, hit rate, chart or breakdown; P and V are listed and counted beside the record.
// No prices, units, ROI or profit exist here, and nothing private is ever passed in.

import LT from "./lights.mjs";
export const STATS = [
  ["points", "Points"],
  ["rebounds", "Rebounds"],
  ["assists", "Assists"],
  ["threes", "Threes"],
];
// NFL / NHL rows are data, not calls: the side is the one that cleared the line more often this season (or Yes / No
// by scoring rate), lit on the props scale. Their markets:
export const SPORT_STATS = {
  nba: STATS,
  nfl: [["pass_yds", "Passing yards"], ["pass_tds", "Passing TDs"], ["completions", "Pass completions"], ["rush_yds", "Rushing yards"],
    ["rec_yds", "Receiving yards"], ["receptions", "Receptions"], ["tds", "Anytime TD"]],
  nhl: [["shots", "Shots on goal"], ["points", "Points"], ["assists", "Assists"], ["goals", "Anytime goal"], ["saves", "Goalie saves"]],
};
export const DATA_SPORTS = ["nfl", "nhl"];
export const isDataSport = (sport) => DATA_SPORTS.includes(sport);
export const statsFor = (sport) => SPORT_STATS[sport] || STATS;
export const STAT_LABEL = Object.fromEntries(Object.values(SPORT_STATS).flat());
export const statLabel = (sport, stat) => (Object.fromEntries(statsFor(sport))[stat] || STAT_LABEL[stat] || stat);
/** Words that differ between NBA (model calls) and NFL / NHL (data rows). */
export const words = (sport) => (isDataSport(sport)
  ? { call: "Side", calls: "rows", Calls: "Rows", chance: "Season rate", byStat: "By market", allStats: "All markets", allCalls: "Every side" }
  : { call: "Our call", calls: "calls", Calls: "Calls", chance: "Chance", byStat: "By stat", allStats: "All stats", allCalls: "Over + Under" });
// Props lights (green / orange / red; no Best value), names from /lights.json via /lights.mjs.
export const LIGHTS = ["GREEN", "ORANGE", "RED"].map((l) => [l, LT.label(l)]);
const LIGHT_LABEL = Object.fromEntries(LIGHTS);
export const CALLS = ["Over", "Under"];
export const callsFor = (sport) => (isDataSport(sport) ? ["Over", "Under", "Yes", "No"] : CALLS);
// Period tabs: the whole season, or the last 30 / 7 days up to today (Sydney date).
export const PERIODS = [["season", "Season"], ["30", "Last 30 days"], ["7", "Last 7 days"]];
/** First date (YYYY-MM-DD) inside the period, or null for the season. */
export function periodStart(period, today) {
  if (!period || period === "season" || !today) return null;
  const [y, m, d] = String(today).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) - (Number(period) - 1) * 86400e3);
  return dt.toISOString().slice(0, 10);
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ------------------------------------------------------------------ tallies
/**
 * { w, l, n, pct, p, v }: only W and L count (n = w + l, pct = w / n, null with none);
 * p (pushes) and v (voids) are counted separately and never enter a record or rate.
 */
export function tally(rows) {
  let w = 0, l = 0, p = 0, v = 0;
  for (const r of rows) {
    if (r.result === "W") w++;
    else if (r.result === "L") l++;
    else if (r.result === "P") p++;
    else if (r.result === "V") v++;
  }
  return { w, l, n: w + l, pct: w + l ? w / (w + l) : null, p, v };
}
export const pctText = (t) => (t.pct == null ? "—" : `${Math.round(t.pct * 100)}%`);
/** Always W–L: pushes and voids are never part of a record. */
export const recText = (t) => `${t.w}–${t.l}`;
/** "2 void", "2 void · 1 push", or "" (a push is only mentioned when a real one exists). */
export const asideText = (t) => [t.v ? `${t.v} void` : "", t.p ? `${t.p} push${t.p === 1 ? "" : "es"}` : ""].filter(Boolean).join(" · ");
/** "41 of 65" (decided calls only). */
export const ofText = (t) => `${t.w} of ${t.w + t.l}`;

// ------------------------------------------------------------------ filters
/**
 * f: { sport, lights (array or {LIGHT:true}), stat = "all", call = "all", date = "all", game = "all" }.
 * Any key left out does not filter.
 */
export function filterRows(rows, f = {}) {
  const lights = f.lights == null ? null : Array.isArray(f.lights) ? new Set(f.lights) : new Set(Object.keys(f.lights).filter((k) => f.lights[k]));
  return rows.filter((r) =>
    (f.sport == null || r.sport === f.sport) &&
    (lights == null || lights.has(r.light)) &&
    (!f.stat || f.stat === "all" || r.stat === f.stat) &&
    (!f.call || f.call === "all" || r.call === f.call) &&
    (!f.date || f.date === "all" || r.date === f.date) &&
    (!f.since || r.date >= f.since) &&
    (!f.game || f.game === "all" || r.game === f.game));
}

/** Distinct non-blank game labels, sorted. */
export const gameLabels = (rows) => [...new Set(rows.map((r) => String(r.game || "").trim()).filter(Boolean))].sort();
/**
 * Show the Game column / filter only when a sport's settled rows carry at least two different
 * non-blank game labels. Decided on the whole sport (never the filtered rows) so it does not flicker.
 */
export const gameLabelsVary = (sportRows) => gameLabels(sportRows).length > 1;
/** Settled dates, newest first. */
export const datesOf = (rows) => [...new Set(rows.map((r) => r.date))].sort().reverse();

// ------------------------------------------------------------------ hit rate over time
/**
 * One point per date with at least one W or L, oldest first:
 * { date, w, l, pct (that day), cw, cl, cum (hit rate up to and including that day) }.
 * Pushes and voids are left out entirely.
 */
export function dailySeries(rows) {
  const byDay = new Map();
  for (const r of rows) {
    if (r.result !== "W" && r.result !== "L") continue;
    const d = byDay.get(r.date) || { date: r.date, w: 0, l: 0 };
    r.result === "W" ? d.w++ : d.l++;
    byDay.set(r.date, d);
  }
  let cw = 0, cl = 0;
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => {
    cw += d.w; cl += d.l;
    return { ...d, pct: d.w / (d.w + d.l), cw, cl, cum: cw / (cw + cl) };
  });
}

/** Best day: highest daily hit rate among days with 3+ decided calls (else any decided day); more wins breaks ties. */
export function bestDay(series) {
  const decided = series.filter((d) => d.pct != null);
  const pool = decided.filter((d) => d.w + d.l >= 3);
  const use = pool.length ? pool : decided;
  let best = null;
  for (const d of use) if (!best || d.pct > best.pct || (d.pct === best.pct && d.w > best.w)) best = d;
  return best;
}

// ------------------------------------------------------------------ labels
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-14" → "Sat 14 Nov" (a calendar date, no time zone shift). */
export function dateLabel(d) {
  const [y, m, day] = String(d).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return `${DAYS[dt.getUTCDay()]} ${day} ${MONTHS[m - 1]}`;
}
const shortDate = (d) => dateLabel(d).split(" ").slice(1).join(" ");
const dateHtml = (d) => {
  const [wd, ...rest] = dateLabel(d).split(" ");
  return `<span class="pr-wd">${wd} </span>${rest.join(" ")}`;
};
/** "Green", "Green + Orange", "All lights", "No lights". */
export function lightsLabel(lights) {
  const on = LIGHTS.filter(([id]) => (Array.isArray(lights) ? lights.includes(id) : lights && lights[id])).map(([, l]) => l);
  return on.length === LIGHTS.length ? "All lights" : on.length ? on.join(" + ") : "No lights";
}

// ------------------------------------------------------------------ headline record (whole sport)
const miniTile = (cls, label, t) =>
  `<div class="pr-tile ${cls}"><span class="ut-k">${label}</span><b>${pctText(t)}</b><span class="pr-tile-r mono">${recText(t)}</span></div>`;
const aside = (t) => (asideText(t) ? ` <em class="pr-aside">${asideText(t)}</em>` : "");

/**
 * Headline record for one sport. Always the full settled record: it never follows the light,
 * stat, Over/Under or date filters. Green first and in green (W–L, hit %, "N void" beside it);
 * the all-settled hit rate beside it at the same size; then smaller Orange, Red, Over, Under and
 * a Void tile. Voids and pushes never enter a record or rate.
 */
export function heroHtml(sportRows, sportName, sport = "nba", periodName = "") {
  const W = words(sport);
  const all = tally(sportRows);
  const g = tally(sportRows.filter((r) => r.light === "GREEN"));
  const o = tally(sportRows.filter((r) => r.light === "ORANGE"));
  const rd = tally(sportRows.filter((r) => r.light === "RED"));
  const sideTiles = callsFor(sport).map((c) => {
    const t = tally(sportRows.filter((r) => r.call === c));
    return isDataSport(sport) && !t.n && !t.v ? "" : miniTile(c.toUpperCase(), `${c} ${W.calls}`, t);
  }).join("");
  const right = isDataSport(sport) ? "green rows where the side hit" : "green calls right";
  return `<h2>${esc(sportName)} player props record${periodName ? ` <span class="pr-period-name">· ${esc(periodName)}</span>` : ""}</h2>
    ${isDataSport(sport) ? `<p class="small pr-data-note">Data, not tips: each row's side is the one that cleared the line more often this season (Yes / No by scoring rate), lit on the props scale. Hit = that side came in.</p>` : ""}
    <div class="pr-hero-main">
      <div class="pr-hero-block pr-hero-green" data-hero="green">
        <p class="pr-hero-k"><span class="chip GREEN">Green</span> Green ${W.calls}</p>
        <p class="record-hero green-hero pr-big"><b>${g.n ? recText(g) : "—"}</b> <span>${pctText(g)}</span>${aside(g)}</p>
        <p class="pr-hero-sub">${g.n ? `${ofText(g)} ${right}` : `No settled green ${W.calls} yet`}</p>
      </div>
      <div class="pr-hero-block pr-hero-all" data-hero="all">
        <p class="pr-hero-k">All settled ${W.calls}</p>
        <p class="record-hero pr-big"><b>${ofText(all)}</b> <span>${pctText(all)}</span>${aside(all)}</p>
        <p class="pr-hero-sub mono">${recText(all)} · every light</p>
      </div>
    </div>
    <div class="pr-tiles" aria-label="More records">
      ${miniTile("ORANGE", "Orange", o)}
      ${miniTile("RED", "Red", rd)}
      ${sideTiles}
      <div class="pr-tile VOID"><span class="ut-k">Void</span><b>${all.v}</b><span class="pr-tile-r">${all.p ? `${all.p} push${all.p === 1 ? "" : "es"} · ` : ""}not in records</span></div>
    </div>`;
}

// ------------------------------------------------------------------ hit-rate chart
const smooth = (pts) => {
  if (!pts.length) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return d;
};
const r1 = (v) => Math.round(v * 10) / 10;

/** Inline SVG: cumulative hit rate (smooth line + soft green area) or daily hit rate (bars). */
export function chartSvg(series, mode = "cum", lightsText = "Green", { narrow = false } = {}) {
  const daily = mode === "day";
  const pts = series.filter((d) => (daily ? d.pct : d.cum) != null);
  if (!pts.length) return "";
  // Phones get a narrower, taller drawing so the labels stay readable.
  const [W, H, L, R, T, B] = narrow ? [400, 290, 40, 14, 22, 48] : [800, 300, 52, 28, 22, 44];
  const vals = pts.map((d) => (daily ? d.pct : d.cum) * 100);
  const lo = Math.max(0, Math.min(40, Math.floor((Math.min(...vals) - 5) / 10) * 10));
  const hi = Math.min(100, Math.max(60, Math.ceil((Math.max(...vals) + 5) / 10) * 10));
  const y = (v) => r1(T + (hi - v) / (hi - lo) * (H - T - B));
  const n = pts.length;
  const slot = (W - L - R) / n;
  // One date: centred. Several: spread edge to edge (line) or one slot each (bars).
  const x = (i) => r1(daily || n === 1 ? L + slot * (i + 0.5) : L + i / (n - 1) * (W - L - R));

  let grid = "";
  const yStep = narrow && hi - lo > 60 ? 20 : 10;
  for (let v = lo; v <= hi; v += yStep) {
    const mid = v === 50;
    grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${mid ? "rgba(138,150,171,.55)" : "rgba(138,150,171,.22)"}"${mid ? ' stroke-width="1.4"' : ' stroke-dasharray="4 6"'}/>`
      + `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end"${mid ? ' font-weight="700"' : ""}>${v}%</text>`;
  }
  const every = Math.max(1, Math.ceil(n / (narrow ? 4 : 8)));
  const edge = !daily && n > 1; // line charts run edge to edge: pin the end labels inside
  pts.forEach((d, i) => {
    if (i % every && i !== n - 1) return;
    const anchor = edge && i === 0 ? "start" : edge && i === n - 1 ? "end" : "middle";
    grid += `<text x="${x(i)}" y="${H - B + 20}" text-anchor="${anchor}">${esc(shortDate(d.date))}</text>`;
  });

  let marks = "";
  if (daily) {
    const bw = Math.max(4, Math.min(48, slot * 0.6));
    pts.forEach((d, i) => {
      const v = d.pct * 100, top = y(v), base = y(lo);
      const good = v >= 50;
      marks += `<rect x="${r1(x(i) - bw / 2)}" y="${top}" width="${r1(bw)}" height="${r1(Math.max(1, base - top))}" fill="${good ? "#2fd7a0" : "#ff4f6e"}" fill-opacity="${good ? ".75" : ".6"}"><title>${esc(dateLabel(d.date))}: ${d.w}–${d.l} (${Math.round(v)}%)</title></rect>`;
      if (n <= 14) marks += `<text x="${x(i)}" y="${top - 6}" text-anchor="middle" style="fill:${good ? "#2fd7a0" : "#ff4f6e"}" font-weight="700">${Math.round(v)}%</text>`;
    });
  } else {
    const xy = pts.map((d, i) => [x(i), y(d.cum * 100)]);
    const line = smooth(xy);
    if (n > 1) {
      marks += `<path d="${line} L ${xy[n - 1][0]} ${y(lo)} L ${xy[0][0]} ${y(lo)} Z" fill="url(#prAreaGrad)"/>`
        + `<path d="${line}" fill="none" stroke="#2fd7a0" stroke-width="3" stroke-linejoin="round" filter="url(#prGlow)"/>`;
    } else {
      // A single settled day: a soft stub under the dot, nothing invented either side.
      marks += `<line x1="${xy[0][0]}" x2="${xy[0][0]}" y1="${xy[0][1]}" y2="${y(lo)}" stroke="#2fd7a0" stroke-opacity=".35" stroke-width="2" stroke-dasharray="3 4"/>`;
    }
    const last = pts[n - 1], [ex, ey] = xy[n - 1];
    marks += `<circle cx="${ex}" cy="${ey}" r="5" fill="#2fd7a0" stroke="#07080f" stroke-width="2"><title>${esc(dateLabel(last.date))}: ${last.cw}–${last.cl} so far</title></circle>`
      + `<text x="${n === 1 ? ex : ex - 8}" y="${ey - 12}" text-anchor="${n === 1 ? "middle" : "end"}" style="fill:#2fd7a0" font-weight="700">${Math.round(last.cum * 100)}%</text>`;
  }
  const caption = `${daily ? "Daily" : "Cumulative"} hit rate · ${lightsText} · voids and pushes not counted`;
  return `<svg class="units-chart results-growth pr-chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(caption)}">
      <defs><linearGradient id="prAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2fd7a0" stop-opacity="0.35"/><stop offset="100%" stop-color="#2fd7a0" stop-opacity="0"/></linearGradient>
      <filter id="prGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      ${grid}${marks}
      <text x="${L}" y="${H - 6}" fill="rgba(138,150,171,.85)" font-size="11">${esc(caption)}</text>
    </svg>`;
}

/** Chart panel body: summary tiles, then the chart (or an honest empty state). */
export function chartBlockHtml(rows, mode, lightsText, opts = {}) {
  const t = tally(rows);
  const W = words(opts.sport || "nba");
  if (!t.n) return `<p class="pr-none">No settled ${esc(lightsText.toLowerCase())} ${W.calls} with a result ${opts.periodName ? `in the ${esc(opts.periodName.toLowerCase())}` : "for this sport yet"}.</p>`;
  const series = dailySeries(rows);
  const best = series.length > 1 ? bestDay(series) : null;
  const one = series.length === 1 ? series[0] : null;
  const third = one
    ? `<div><span class="ut-k">Days settled</span><b>1</b><span class="pr-tile-r mono">${esc(dateLabel(one.date))} · ${recText(one)}</span></div>`
    : best
      ? `<div><span class="ut-k">Best day</span><b>${Math.round(best.pct * 100)}%</b><span class="pr-tile-r mono">${esc(dateLabel(best.date))} · ${recText(best)}</span></div>`
      : `<div><span class="ut-k">Days settled</span><b>${series.length}</b></div>`;
  const svg = chartSvg(series, mode, lightsText, opts);
  return `<div class="units-tiles pr-chart-tiles">
      <div><span class="ut-k">Hit rate</span><b>${pctText(t)}</b><span class="pr-tile-r mono">${ofText(t)} right</span></div>
      <div><span class="ut-k">Settled ${W.calls}</span><b>${t.n}</b><span class="pr-tile-r mono">${recText(t)}${asideText(t) ? ` · ${asideText(t)}` : ""}</span></div>
      ${third}
    </div>
    ${svg ? `<div class="chart-wrap">${svg}</div>` : ""}`;
}

// ------------------------------------------------------------------ breakdowns
/** Small W/L bar with a 50% marker (pushes and voids are not part of it). */
export function wlBar(t) {
  const W = 200, H = 10;
  if (!t.n) return `<svg class="pr-bar" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><rect width="${W}" height="${H}" fill="rgba(138,150,171,.12)"/></svg>`;
  const ww = r1(t.w / t.n * W), lw = r1(W - ww);
  return `<svg class="pr-bar" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      ${ww ? `<rect width="${ww}" height="${H}" fill="#2fd7a0"/>` : ""}
      ${lw > 0.05 ? `<rect x="${ww}" width="${lw}" height="${H}" fill="#ff4f6e" fill-opacity=".8"/>` : ""}
      <line x1="${W / 2}" x2="${W / 2}" y1="0" y2="${H}" stroke="#07080f" stroke-width="2"/>
    </svg>`;
}

function bkTile(kind, id, label, t, on) {
  return `<button type="button" class="pr-bk${on ? " on" : ""}" data-filter="${kind}" data-value="${esc(id)}" aria-pressed="${on}">
      <span class="pr-bk-k">${esc(label)}</span>
      <span class="pr-bk-v">${pctText(t)}</span>
      <span class="pr-bk-r mono">${t.n ? recText(t) : "None settled"}</span>
      ${wlBar(t)}
    </button>`;
}

/** By stat and by Over/Under, for the selected sport + lights. The chosen stat / call is highlighted. */
export function breakdownHtml(rows, { stat = "all", call = "all", sport = "nba" } = {}) {
  const W = words(sport);
  const byStat = statsFor(sport).map(([id, label]) => bkTile("stat", id, label, tally(rows.filter((r) => r.stat === id)), stat === id)).join("");
  const calls = callsFor(sport).filter((c) => !isDataSport(sport) || rows.some((r) => r.call === c));
  const byCall = calls.map((c) => bkTile("call", c, c, tally(rows.filter((r) => r.call === c)), call === c)).join("");
  return `<h3 class="pr-sub">${W.byStat}</h3><div class="pr-bk-grid pr-bk-stats">${byStat}</div>
    <h3 class="pr-sub">${isDataSport(sport) ? "By side" : "Over vs Under"}</h3><div class="pr-bk-grid pr-bk-calls">${byCall}</div>`;
}

// ------------------------------------------------------------------ settled list
const BADGE = { W: ["W", "Win"], L: ["L", "Loss"], P: ["P", "Push"], V: ["VOID", "Void: did not play"] };
const numText = (x) => (x == null ? "—" : String(x));

/** Show the Season avg column when any settled row of the sport has one (decided per sport, so it does not flicker). */
export const hasSeasonAvg = (sportRows) => sportRows.some((r) => r.season_avg != null);
/** "vs Indiana Pacers" (home, or home unknown) / "@ Philadelphia 76ers" (away); "" without an opponent. */
export const matchupText = (r) => (r.opp ? `${r.home === false ? "@" : "vs"} ${r.opp}` : "");

export function headHtml(showGame, showAvg = false, sport = "nba") {
  const W = words(sport);
  return `<tr><th>Date</th>${showGame ? "<th>Game</th>" : ""}<th>Player</th><th>${isDataSport(sport) ? "Market" : "Stat"}</th><th class="n">Line</th>${showAvg ? '<th class="n">Season avg</th>' : ""}<th>${W.call}</th><th class="n">${W.chance}</th><th>Light</th><th class="n">Actual</th><th class="pr-res">Result</th></tr>`;
}

export function rowHtml(r, showGame, showAvg = false) {
  const [b, title] = BADGE[r.result];
  const vs = matchupText(r);
  return `<tr class="pr-r ${r.light}" data-stat="${esc(r.stat)}">
      <td class="pr-date mono">${dateHtml(r.date)}</td>
      ${showGame ? `<td class="pr-game">${esc(r.game || "—")}</td>` : ""}
      <td class="pr-player">${esc(r.player)}${vs ? `<span class="pr-opp">${esc(vs)}</span>` : ""}</td>
      <td class="pr-statn">${esc(statLabel(r.sport, r.stat))}</td>
      <td class="n mono">${esc(numText(r.line))}</td>
      ${showAvg ? `<td class="n mono pr-avg">${esc(numText(r.season_avg))}</td>` : ""}
      <td class="pr-call mono">${r.call}</td>
      <td class="n mono">${r.p == null ? "—" : LT.chanceText(r.p)}</td>
      <td><span class="chip ${r.light}">${LIGHT_LABEL[r.light]}</span></td>
      <td class="n mono pr-actual">${r.result === "V" ? "-" : esc(numText(r.actual))}</td>
      <td class="pr-res"><span class="pr-badge ${r.result}" title="${title}">${b}</span></td>
    </tr>`;
}

/** List summary line for the current filters. */
export function listSummary(shown, totalInSport, sport = "nba") {
  const t = tally(shown);
  const unit = isDataSport(sport) ? "row" : "call";
  return `Showing <b>${shown.length}</b> of ${totalInSport} settled ${unit}${totalInSport === 1 ? "" : "s"}${t.n ? ` · <b>${recText(t)}</b> (${pctText(t)})` : ""}${asideText(t) ? ` · ${asideText(t)}` : ""}`;
}

export const sportEmptyText = (name, sport) => (isDataSport(sport)
  ? `${name} props results will appear here after the first settled game.`
  : `${name} props results will appear here once settled calls are up.`);
