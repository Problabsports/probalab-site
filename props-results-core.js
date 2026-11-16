// Player props results (/props/results): shared, pure helpers used by BOTH the server
// (functions/_shared/props-results.js renders the first view) and the browser (/props-results.js
// re-renders on every filter change), so the numbers and charts are always drawn the same way.
// Input rows are already normalised, settled-only, public fields:
//   { sport, date, game, player, stat, line, call, p, light, actual, result }
// No prices, units, ROI or profit exist here, and nothing private is ever passed in.

export const STATS = [
  ["points", "Points"],
  ["rebounds", "Rebounds"],
  ["assists", "Assists"],
  ["threes", "Threes"],
];
export const STAT_LABEL = Object.fromEntries(STATS);
export const LIGHTS = [
  ["GREEN", "Green"],
  ["ORANGE", "Orange"],
  ["RED", "Red"],
];
const LIGHT_LABEL = Object.fromEntries(LIGHTS);
export const CALLS = ["Over", "Under"];

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ------------------------------------------------------------------ tallies
/** { w, l, p, n, pct }: pct = w / (w + l), pushes left out; null with no decided calls. */
export function tally(rows) {
  let w = 0, l = 0, p = 0;
  for (const r of rows) r.result === "W" ? w++ : r.result === "L" ? l++ : p++;
  return { w, l, p, n: w + l + p, pct: w + l ? w / (w + l) : null };
}
export const pctText = (t) => (t.pct == null ? "—" : `${Math.round(t.pct * 100)}%`);
/** 41–24, or 41–24–6 when there are pushes. */
export const recText = (t) => `${t.w}–${t.l}${t.p ? `–${t.p}` : ""}`;
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
 * One point per settled date, oldest first:
 * { date, w, l, p, pct (that day), cw, cl, cp, cum (hit rate up to and including that day) }.
 * Days with only pushes keep the previous cumulative rate and a null daily rate.
 */
export function dailySeries(rows) {
  const byDay = new Map();
  for (const r of rows) {
    const d = byDay.get(r.date) || { date: r.date, w: 0, l: 0, p: 0 };
    r.result === "W" ? d.w++ : r.result === "L" ? d.l++ : d.p++;
    byDay.set(r.date, d);
  }
  let cw = 0, cl = 0, cp = 0;
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => {
    cw += d.w; cl += d.l; cp += d.p;
    return { ...d, pct: d.w + d.l ? d.w / (d.w + d.l) : null, cw, cl, cp, cum: cw + cl ? cw / (cw + cl) : null };
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
const miniTile = (cls, label, t, extra = "") =>
  `<div class="pr-tile ${cls}"><span class="ut-k">${label}</span><b>${pctText(t)}</b><span class="pr-tile-r mono">${recText(t)}${extra}</span></div>`;

/**
 * Headline record for one sport. Always the full settled record: it never follows the light,
 * stat, Over/Under or date filters. Green first and in green; the all-settled hit rate beside it
 * at the same size; then smaller Orange, Red, Pushes, Over and Under.
 */
export function heroHtml(sportRows, sportName) {
  const all = tally(sportRows);
  const g = tally(sportRows.filter((r) => r.light === "GREEN"));
  const o = tally(sportRows.filter((r) => r.light === "ORANGE"));
  const rd = tally(sportRows.filter((r) => r.light === "RED"));
  const ov = tally(sportRows.filter((r) => r.call === "Over"));
  const un = tally(sportRows.filter((r) => r.call === "Under"));
  return `<h2>${esc(sportName)} player props record</h2>
    <div class="pr-hero-main">
      <div class="pr-hero-block pr-hero-green" data-hero="green">
        <p class="pr-hero-k"><span class="chip GREEN">Green</span> Green calls</p>
        <p class="record-hero green-hero pr-big"><b>${g.n ? recText(g) : "—"}</b> <span>${pctText(g)}</span></p>
        <p class="pr-hero-sub">${g.w + g.l ? `${ofText(g)} green calls right` : "No settled green calls yet"}</p>
      </div>
      <div class="pr-hero-block pr-hero-all" data-hero="all">
        <p class="pr-hero-k">All settled calls</p>
        <p class="record-hero pr-big"><b>${ofText(all)}</b> <span>${pctText(all)}</span></p>
        <p class="pr-hero-sub mono">${recText(all)} · every light</p>
      </div>
    </div>
    <div class="pr-tiles" aria-label="More records">
      ${miniTile("ORANGE", "Orange", o)}
      ${miniTile("RED", "Red", rd)}
      ${miniTile("OVER", "Over calls", ov)}
      ${miniTile("UNDER", "Under calls", un)}
      <div class="pr-tile PUSH"><span class="ut-k">Pushes</span><b>${all.p}</b><span class="pr-tile-r">not in hit rates</span></div>
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
      marks += `<rect x="${r1(x(i) - bw / 2)}" y="${top}" width="${r1(bw)}" height="${r1(Math.max(1, base - top))}" fill="${good ? "#2fd7a0" : "#ff4f6e"}" fill-opacity="${good ? ".75" : ".6"}"><title>${esc(dateLabel(d.date))}: ${d.w}–${d.l}${d.p ? `–${d.p}` : ""} (${Math.round(v)}%)</title></rect>`;
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
    marks += `<circle cx="${ex}" cy="${ey}" r="5" fill="#2fd7a0" stroke="#07080f" stroke-width="2"><title>${esc(dateLabel(last.date))}: ${last.cw}–${last.cl}${last.cp ? `–${last.cp}` : ""} so far</title></circle>`
      + `<text x="${n === 1 ? ex : ex - 8}" y="${ey - 12}" text-anchor="${n === 1 ? "middle" : "end"}" style="fill:#2fd7a0" font-weight="700">${Math.round(last.cum * 100)}%</text>`;
  }
  const caption = `${daily ? "Daily" : "Cumulative"} hit rate · ${lightsText} · pushes not counted`;
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
  if (!t.n) return `<p class="pr-none">No settled ${esc(lightsText.toLowerCase())} calls for this sport yet.</p>`;
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
      <div><span class="ut-k">Settled calls</span><b>${t.n}</b><span class="pr-tile-r mono">${recText(t)}</span></div>
      ${third}
    </div>
    ${svg ? `<div class="chart-wrap">${svg}</div>` : `<p class="pr-none">Only pushes so far, so there is no hit rate to chart yet.</p>`}`;
}

// ------------------------------------------------------------------ breakdowns
/** Small W/L/P bar with a 50% marker. */
export function wlpBar(t) {
  const W = 200, H = 10;
  if (!t.n) return `<svg class="pr-bar" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><rect width="${W}" height="${H}" fill="rgba(138,150,171,.12)"/></svg>`;
  const ww = r1(t.w / t.n * W), lw = r1(t.l / t.n * W), pw = r1(W - ww - lw);
  return `<svg class="pr-bar" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <rect width="${W}" height="${H}" fill="rgba(138,150,171,.12)"/>
      ${ww ? `<rect width="${ww}" height="${H}" fill="#2fd7a0"/>` : ""}
      ${lw ? `<rect x="${ww}" width="${lw}" height="${H}" fill="#ff4f6e" fill-opacity=".8"/>` : ""}
      ${pw > 0.05 ? `<rect x="${r1(ww + lw)}" width="${pw}" height="${H}" fill="rgba(138,150,171,.45)"/>` : ""}
      <line x1="${W / 2}" x2="${W / 2}" y1="0" y2="${H}" stroke="#07080f" stroke-width="2"/>
    </svg>`;
}

function bkTile(kind, id, label, t, on) {
  return `<button type="button" class="pr-bk${on ? " on" : ""}" data-filter="${kind}" data-value="${esc(id)}" aria-pressed="${on}">
      <span class="pr-bk-k">${esc(label)}</span>
      <span class="pr-bk-v">${pctText(t)}</span>
      <span class="pr-bk-r mono">${t.n ? recText(t) : "No settled calls"}</span>
      ${wlpBar(t)}
    </button>`;
}

/** By stat and by Over/Under, for the selected sport + lights. The chosen stat / call is highlighted. */
export function breakdownHtml(rows, { stat = "all", call = "all" } = {}) {
  const byStat = STATS.map(([id, label]) => bkTile("stat", id, label, tally(rows.filter((r) => r.stat === id)), stat === id)).join("");
  const byCall = CALLS.map((c) => bkTile("call", c, c, tally(rows.filter((r) => r.call === c)), call === c)).join("");
  return `<h3 class="pr-sub">By stat</h3><div class="pr-bk-grid pr-bk-stats">${byStat}</div>
    <h3 class="pr-sub">Over vs Under</h3><div class="pr-bk-grid pr-bk-calls">${byCall}</div>`;
}

// ------------------------------------------------------------------ settled list
const BADGE = { W: ["W", "Win"], L: ["L", "Loss"], P: ["P", "Push"] };
const numText = (x) => (x == null ? "—" : String(x));

export function headHtml(showGame) {
  return `<tr><th>Date</th>${showGame ? "<th>Game</th>" : ""}<th>Player</th><th>Stat</th><th class="n">Line</th><th>Our call</th><th class="n">Chance</th><th>Light</th><th class="n">Actual</th><th class="pr-res">Result</th></tr>`;
}

export function rowHtml(r, showGame) {
  const [b, title] = BADGE[r.result];
  return `<tr class="pr-r ${r.light}" data-stat="${esc(r.stat)}">
      <td class="pr-date mono">${dateHtml(r.date)}</td>
      ${showGame ? `<td class="pr-game">${esc(r.game || "—")}</td>` : ""}
      <td class="pr-player">${esc(r.player)}</td>
      <td class="pr-statn">${esc(STAT_LABEL[r.stat])}</td>
      <td class="n mono">${esc(numText(r.line))}</td>
      <td class="pr-call mono">${r.call}</td>
      <td class="n mono">${r.p == null ? "—" : `${Math.round(r.p * 100)}%`}</td>
      <td><span class="chip ${r.light}">${LIGHT_LABEL[r.light]}</span></td>
      <td class="n mono pr-actual">${esc(numText(r.actual))}</td>
      <td class="pr-res"><span class="pr-badge ${r.result}" title="${title}">${b}</span></td>
    </tr>`;
}

/** List summary line for the current filters. */
export function listSummary(shown, totalInSport) {
  const t = tally(shown);
  return `Showing <b>${t.n}</b> of ${totalInSport} settled call${totalInSport === 1 ? "" : "s"}${t.n ? ` · <b>${recText(t)}</b> (${pctText(t)})` : ""}`;
}

export const sportEmptyText = (name) => `${name} props results will appear here once settled calls are up.`;
