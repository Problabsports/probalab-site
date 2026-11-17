// Phone cards and the player view for the props pages (/props/nba, /props/nfl, /props/nhl). Data only:
// best bookie price per side, player form against the line, hit rates. No tips, units, edge or fair price.
//
// Every prop becomes one "item" (same shape for all three sports), rendered as a card on phones; the desktop
// tables stay as they are. The player view (bottom sheet on phones, panel on desktop; props-cards.js) reads the
// items of each game from one JSON block per game (only the rows the viewer can see: free view or members).
import { esc, chip, slug } from "./site.js";

const num = (x) => (x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
const pct0 = (x) => `${Math.round(x * 100)}%`;

/** Highest price on one side across every bookie (Sportsbet wins ties). */
export function bestBook(books, side) {
  let best = null;
  for (const b of books || []) {
    const v = num(b && b[side]);
    if (v == null) continue;
    if (!best || v > best[side] || (v === best[side] && b.key === "sportsbet")) best = b;
  }
  return best;
}

export function countHits(values, line) {
  const c = (xs) => ({ n: xs.length, over: xs.filter((v) => v > line).length, under: xs.filter((v) => v < line).length });
  return { l5: c(values.slice(0, 5)), l10: c(values.slice(0, 10)), season: c(values) };
}

/** Props-scale light for a rate (rounded % decides the colour). */
export const rateLight = (r) => { if (r == null) return ""; const p = Math.round(r * 100); return p >= 60 ? "GREEN" : p >= 55 ? "ORANGE" : "RED"; };

/** Item from an NFL / NHL board row (props-board-v1). */
export function itemFromSportRow(sport, r, label, light, side) {
  return {
    sport, player: r.player, team: r.team || "", team_abbr: r.team_abbr || "", position: r.position || "",
    market: label, kind: r.kind, line: r.kind === "yes" ? null : num(r.line), light: light || "", side: side || "",
    pred: null, books: r.books || [], log: (r.log || []).map((g) => ({ date: g.date, opp: g.opp, ha: g.ha, v: num(g.v) })).filter((g) => g.v != null),
    season: r.season || null, hits: r.hits || null, rates: r.rates || null,
    line_source: r.line_source || "book", no_au_price: !(r.books || []).length,
  };
}

/** One stat from an NBA game_log row; combos add up their parts (pra = points + rebounds + assists). */
export function nbaLogValue(g, stat) {
  const v = (k) => num(g[k]);
  const sum = (ks) => (ks.every((k) => v(k) != null) ? ks.reduce((a, k) => a + v(k), 0) : null);
  if (stat === "pra") return sum(["points", "rebounds", "assists"]);
  if (stat === "pr") return sum(["points", "rebounds"]);
  if (stat === "pa") return sum(["points", "assists"]);
  return v(stat);
}

/** Item from an NBA board prediction row (players[] + stats.<stat>, game_log for form). */
export function itemFromNbaRow(r, label, teamAbbr) {
  const s = r.s;
  const log = (Array.isArray(r.game_log) ? r.game_log : [])
    .map((g) => ({ date: String(g.date || "").slice(0, 10), opp: g.opp || "", ha: g.home === true ? "H" : g.home === false ? "A" : "", v: nbaLogValue(g, r.stat) }))
    .filter((g) => g.v != null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const values = log.map((g) => g.v);
  const avg = s.avg != null ? s.avg : values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return {
    sport: "nba", player: r.player, team: r.team || "", team_abbr: teamAbbr || "", position: "",
    market: label, kind: "ou", line: s.line, light: r.light || "", side: s.side || "",
    pred: s.p != null ? { side: s.side, p: s.p } : null, books: s.books || [], log,
    season: { gp: values.length || null, avg: avg == null ? null : Math.round(avg * 10) / 10 },
    hits: values.length ? countHits(values, s.line) : null, rates: null,
    line_source: s.line_source || "book", no_au_price: !(s.books || []).length,
  };
}

const lineTxt = (x) => (num(x) == null ? "" : Number(x).toFixed(1));
const logo = (it) => (it.team ? `<img class="ppc-logo" src="/img/logos/${esc(it.sport)}/${esc(slug(it.team))}.png" alt="" width="26" height="26" loading="lazy" decoding="async" data-abbr="${esc(it.team_abbr)}" onerror="var s=document.createElement('span');s.className='ppc-logo ppc-logo-fb';s.textContent=this.dataset.abbr||'';this.replaceWith(s)">` : "");

/** Small last-8 chart (oldest to newest): bars green above the line, red below; dots for anytime markets. */
export function miniChart(it, W = 104, H = 34) {
  const log = it.log.slice(0, 8).reverse();
  if (!log.length) return `<span class="ppc-nochart">No games yet</span>`;
  const gap = 3, bw = (W - gap * (log.length - 1)) / log.length;
  if (it.kind === "yes") {
    const dots = log.map((g, i) => `<circle cx="${(i * (bw + gap) + bw / 2).toFixed(1)}" cy="${H / 2}" r="${Math.min(6, bw / 2 - 0.5).toFixed(1)}" class="${g.v >= 1 ? "pf-hit" : "pf-miss"}"/>`).join("");
    return `<svg class="ppc-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Last ${log.length}: scored in ${log.filter((g) => g.v >= 1).length}">${dots}</svg>`;
  }
  const line = num(it.line) ?? 0, max = Math.max(line, ...log.map((g) => g.v)) * 1.12 || 1;
  const y = (v) => H - (v / max) * (H - 2);
  const bars = log.map((g, i) => `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${y(g.v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - y(g.v)).toFixed(1)}" rx="1.5" class="${g.v > line ? "pf-over" : g.v < line ? "pf-under" : "pf-push"}"/>`).join("");
  return `<svg class="ppc-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Last ${log.length} against ${lineTxt(line)}: ${log.map((g) => g.v).join(", ")}">${bars}<line x1="0" x2="${W}" y1="${y(line).toFixed(1)}" y2="${y(line).toFixed(1)}" class="pf-line"/></svg>`;
}

/** Hit rates shown on the card: the side the light describes (NFL/NHL: the season's stronger side; NBA: the prediction). */
function hitCells(it) {
  if (it.kind === "yes") {
    const r = it.rates || {};
    const cell = (lab, c) => `<span><small>${lab}</small><b>${c && c.n ? pct0(c.yes / c.n) : "—"}</b></span>`;
    return cell("Scored L8", r.l8) + cell("Season", r.season);
  }
  const h = it.hits;
  const side = it.side === "Under" ? "under" : "over";
  const cell = (lab, c) => {
    if (!c || !c.n) return `<span><small>${lab}</small><b>—</b></span>`;
    const r = c[side] / c.n;
    return `<span class="hl-${rateLight(r)}"><small>${lab}</small><b>${pct0(r)}</b></span>`;
  };
  return h ? cell("L5", h.l5) + cell("L10", h.l10) + cell("Season", h.season) : `<span><small>Form</small><b>—</b></span>`;
}

const NO_AU_CELLS = (a, b) => `<div class="ppc-prices ppc-noau"><div><small>${a}</small><b>-</b><span>No AU price</span></div><div><small>${b}</small><b>-</b><span>No AU price</span></div></div>`;

function priceCells(it) {
  if (it.no_au_price && it.sport !== "nba") return it.kind === "yes" ? NO_AU_CELLS("Best price", "Implied chance") : NO_AU_CELLS("Over", "Under");
  if (it.no_au_price && it.line_source === "avg") return NO_AU_CELLS("Over", "Under");
  if (it.kind === "yes") {
    const b = bestBook(it.books, "yes");
    if (!b) return `<p class="ppc-noprice">Prices appear once this market is posted.</p>`;
    return `<div class="ppc-prices"><div><small>Best price</small><b>${Number(b.yes).toFixed(2)}</b><span>${esc(b.name)}</span></div>
      <div><small>Implied chance</small><b>${pct0(1 / b.yes)}</b><span>margin included</span></div></div>`;
  }
  const o = bestBook(it.books, "over"), u = bestBook(it.books, "under");
  if (!o && !u) return `<p class="ppc-noprice">Prices appear once this line is posted.</p>`;
  const cell = (lab, b, side) => `<div><small>${lab}</small><b>${b ? Number(b[side]).toFixed(2) : "—"}</b><span>${b ? esc(b.name) : "&nbsp;"}</span></div>`;
  return `<div class="ppc-prices">${cell("Over", o, "over")}${cell("Under", u, "under")}</div>`;
}

/** One phone card. pvId links it to the player view data. */
export function cardHtml(it, pvId, attrs) {
  const who = `${it.team_abbr ? esc(it.team_abbr) : esc(it.team.split(" ").pop() || "")}${it.position ? ` · ${esc(it.position)}` : ""}`;
  const badge = it.light ? `${chip(it.light)}${it.side ? `<span class="ppc-side">${esc(it.side)}</span>` : ""}`
    : it.kind === "yes" ? `<span class="ppc-side">Anytime</span>` : "";
  return `<article class="ppc lt-${it.light || "none"}" ${attrs}>
    <header class="ppc-top"><button type="button" class="ppc-who" data-pv-open="${esc(pvId)}" aria-haspopup="dialog">${logo(it)}<span><b>${esc(it.player)}</b><small>${who}</small></span></button><span class="ppc-badge">${badge}</span></header>
    <p class="ppc-mk">${esc(it.market)}${it.line != null ? ` <b>${lineTxt(it.line)}</b>${it.line_source === "avg" ? `<small class="ppc-avg">Avg line</small>` : ""}` : ""}${it.pred ? `<span class="ppc-pred">Prediction <b>${esc(it.pred.side)}</b> · <b>${pct0(it.pred.p)}</b></span>` : ""}</p>
    ${priceCells(it)}
    <div class="ppc-form">${miniChart(it)}<div class="ppc-hits">${hitCells(it)}</div></div>
  </article>`;
}

/** JSON for the player view of one game (escaped for a <script type="application/json"> block). */
export function pvScript(gameId, items) {
  const data = {};
  for (const [id, it] of items) data[id] = it;
  return `<script type="application/json" class="pp-pv" data-game="${esc(gameId)}">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}
