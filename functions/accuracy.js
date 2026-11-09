// /accuracy: calibration of graded picks across every live sport.
 // Buckets 50–55, 55–60, … 75–80, 80%+. Numbers come from the same feeds/files as the record pages.
import { getFeed, gamesOf, shell, html, esc, chip, asHead } from "./_shared/site.js";

const BANDS = [[0.5, 0.55], [0.55, 0.6], [0.6, 0.65], [0.65, 0.7], [0.7, 0.75], [0.75, 0.8], [0.8, 1.01]];
const NHLN = { ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres", CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks", COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars", DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers", LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montréal Canadiens", NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders", NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers", PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken", STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs", UTA: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights", WSH: "Washington Capitals", WPG: "Winnipeg Jets" };

const pct = (p) => (p == null || !Number.isFinite(p) ? "—" : `${Math.round(p * 100)}%`);
const pct1 = (p) => (p == null || !Number.isFinite(p) ? "—" : `${(p * 100).toFixed(1)}%`);
const asset = (ctx, p, d) => ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)).then((r) => (r.ok ? r.json() : d)).catch(() => d);
const bandLabel = (lo, hi) => (hi >= 1 ? "80%+" : `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`);

function bucketize(rows) {
  return BANDS.map(([lo, hi]) => {
    const xs = rows.filter((g) => g.p >= lo && g.p < hi);
    const n = xs.length;
    const wins = xs.filter((g) => g.won).length;
    const exp = n ? xs.reduce((a, g) => a + g.p, 0) / n : null;
    const hit = n ? wins / n : null;
    return { lo, hi, n, wins, exp, hit };
  });
}

function summary(rows) {
  const n = rows.length, w = rows.filter((g) => g.won).length;
  const exp = rows.reduce((a, g) => a + g.p, 0);
  const brier = n ? rows.reduce((a, g) => a + (g.p - (g.won ? 1 : 0)) ** 2, 0) / n : null;
  return { n, w, exp, brier, rate: n ? w / n : null };
}

function chartSvg(bands) {
  const W = 560, Hh = 360, pad = 44;
  const X = (p) => pad + ((p - 0.5) / 0.5) * (W - 2 * pad);
  const Y = (p) => Hh - pad - p * (Hh - 2 * pad);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((v) =>
    `<line x1="${pad}" x2="${W - pad}" y1="${Y(v)}" y2="${Y(v)}" stroke="#232a42"/><text x="${pad - 8}" y="${Y(v) + 4}" text-anchor="end" fill="#8b93b0" font-size="11">${v * 100}%</text>`).join("")
    + [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => `<text x="${X(v)}" y="${Hh - pad + 18}" text-anchor="middle" fill="#8b93b0" font-size="11">${Math.round(v * 100)}%</text>`).join("");
  const dots = bands.filter((b) => b.n).map((b) =>
    `<circle cx="${X(b.exp).toFixed(1)}" cy="${Y(b.hit).toFixed(1)}" r="${(4 + Math.sqrt(b.n) * 2).toFixed(1)}" fill="#19e3ff" fill-opacity=".75"><title>${bandLabel(b.lo, b.hi)}: predicted ${pct(b.exp)}, happened ${pct(b.hit)} (${b.n} games)</title></circle>`).join("");
  return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Calibration chart: predicted chance against how often it happened">${grid}
    <line x1="${X(0.5)}" y1="${Y(0.5)}" x2="${X(1)}" y2="${Y(1)}" stroke="#ff2fc0" stroke-dasharray="5 5"/>${dots}
    <text x="${W / 2}" y="${Hh - 6}" text-anchor="middle" fill="#8b93b0" font-size="12">Model's chance for the predicted winner</text>
    <text x="14" y="${Hh / 2}" transform="rotate(-90 14 ${Hh / 2})" text-anchor="middle" fill="#8b93b0" font-size="12">How often it happened</text></svg>`;
}

function tableHtml(bands) {
  return `<table class="cal"><thead><tr><th>Model chance</th><th>Picks</th><th>Expected win rate</th><th>Actual win rate</th></tr></thead>
  <tbody>${bands.map((b) => `<tr><td>${bandLabel(b.lo, b.hi)}</td><td>${b.n}</td><td>${b.n ? pct1(b.exp) : "—"}</td><td>${b.n ? `${pct1(b.hit)} (${b.wins}–${b.n - b.wins})` : "—"}</td></tr>`).join("")}</tbody></table>`;
}

function sportPanel(id, name, rows, recordHref) {
  const s = summary(rows);
  const bands = bucketize(rows);
  if (!s.n) {
    return `<section class="panel" id="${id}"><h2>${esc(name)}</h2><p>No graded ${esc(name)} picks yet.</p>
      ${recordHref ? `<p class="small"><a href="${esc(recordHref)}">${esc(name)} results →</a></p>` : ""}</section>`;
  }
  return `<section class="panel" id="${id}"><h2>${esc(name)} · ${s.w} of ${s.n} (${pct(s.rate)})</h2>
    <p>Sample size: <b>${s.n}</b> graded picks. The model's own figures said to expect about ${s.exp.toFixed(1)} correct, so it is running ${s.w >= s.exp ? `${(s.w - s.exp).toFixed(1)} ahead of` : `${(s.exp - s.w).toFixed(1)} behind`} what it forecast.</p>
    ${chartSvg(bands)}
    ${tableHtml(bands)}
    <p class="small">Accuracy score (average squared error, lower is better): <b>${s.brier.toFixed(3)}</b> · coin-flip baseline 0.250.${recordHref ? ` <a href="${esc(recordHref)}">Full ${esc(name)} results →</a>` : ""}</p>
  </section>`;
}

async function nbaNflRows(ctx, sport) {
  try {
    const data = gamesOf(sport, await getFeed(ctx, sport));
    return data.games
      .filter((g) => g.pick && g.status === "post" && g.won != null && g.pick_p != null)
      .map((g) => ({ sport, p: Number(g.pick_p), won: !!g.won, id: g.game_id }));
  } catch (e) {
    return null; // signal load failure
  }
}

async function nhlRows(ctx) {
  const [raw, snap] = await Promise.all([asset(ctx, "/data/nhl-picks.json", []), asset(ctx, "/data/nhl-pretip.json", {})]);
  const SN = snap?.games ?? {};
  const out = [];
  for (const g of Array.isArray(raw) ? raw : raw.games ?? []) {
    const id = String(g.game_id ?? g.id);
    const sn = SN[id];
    if (!sn || typeof sn.won !== "boolean" || sn.pick_p == null) continue;
    out.push({ sport: "nhl", p: Number(sn.pick_p), won: !!sn.won, id });
  }
  return out;
}

async function eplRows(ctx) {
  const [raw, grades] = await Promise.all([asset(ctx, "/data/epl-picks.json", []), asset(ctx, "/data/epl-grades.json", {})]);
  const out = [];
  for (const g of Array.isArray(raw) ? raw : raw.games ?? []) {
    const id = String(g.game_id ?? g.id);
    const gr = grades[id];
    if (!gr?.graded) continue;
    const p = Number(g.pick === "home" ? g.p_home : g.pick === "away" ? g.p_away : g.p_draw);
    if (!Number.isFinite(p)) continue;
    out.push({ sport: "epl", p, won: !!gr.correct, id });
  }
  return out;
}

async function soccerRows(ctx, sport) {
  const [raw, grades] = await Promise.all([asset(ctx, `/data/${sport}-picks.json`, []), asset(ctx, `/data/${sport}-grades.json`, {})]);
  const out = [];
  for (const g of Array.isArray(raw) ? raw : raw.games ?? []) {
    const id = String(g.game_id ?? g.id);
    const gr = grades[id];
    if (!gr?.graded) continue;
    const p = Number(g.pick === "home" ? g.p_home : g.pick === "away" ? g.p_away : g.p_draw);
    if (!Number.isFinite(p)) continue;
    out.push({ sport, p, won: !!gr.correct, id });
  }
  return out;
}

async function tennisRows(ctx) {
  const raw = await asset(ctx, "/data/tennis-picks.json", { matches: [] });
  const out = [];
  for (const m of raw.matches ?? raw.games ?? (Array.isArray(raw) ? raw : [])) {
    const won = m.result === "won" ? true : m.result === "lost" ? false : null;
    if (won == null) continue;
    const p = m.pick_pct != null ? (Number(m.pick_pct) > 1 ? Number(m.pick_pct) / 100 : Number(m.pick_pct)) : Number(m.pick_p);
    if (!Number.isFinite(p)) continue;
    out.push({ sport: "tennis", p, won, id: String(m.id ?? m.game_id) });
  }
  return out;
}

export async function onRequestGet(ctx) {
  const [nba, nfl, nhl, epl, champ, tennis] = await Promise.all([nbaNflRows(ctx, "nba"), nbaNflRows(ctx, "nfl"), nhlRows(ctx), eplRows(ctx), soccerRows(ctx, "championship"), tennisRows(ctx)]);
  const parts = [];
  if (nba === null) parts.push(`<section class="panel" id="nba"><h2>NBA</h2><p>We couldn't load NBA results just now.</p></section>`);
  else parts.push(sportPanel("nba", "NBA", nba, "/results?sport=nba"));
  if (nfl === null) parts.push(`<section class="panel" id="nfl"><h2>NFL</h2><p>We couldn't load NFL results just now.</p></section>`);
  else parts.push(sportPanel("nfl", "NFL", nfl, "/results?sport=nfl"));
  parts.push(sportPanel("nhl", "NHL", nhl || [], "/results?sport=nhl"));
  parts.push(sportPanel("epl", "Premier League", epl || [], "/results?sport=epl"));
  parts.push(sportPanel("championship", "Championship", champ || [], "/results?sport=championship"));
  parts.push(sportPanel("tennis", "Tennis", tennis || [], "/results?sport=tennis"));

  const all = [...(nba || []), ...(nfl || []), ...(nhl || []), ...(epl || []), ...(champ || []), ...(tennis || [])];
  const overall = summary(all);
  const overallBands = bucketize(all);

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Accuracy</span></nav>
  <p class="eyebrow">// model calibration · graded picks only</p>
  <h1>How accurate are the predictions?</h1>
  <p>Every finished pick stays on the record, right or wrong. We group those picks by the win chance the model gave its predicted winner, then compare that chance with how often the pick actually won.</p>
  <p><b>A plain reading:</b> a 70% call should miss about 3 in 10. If the 70–75% bucket has won roughly seven times in ten over a large sample, the model is well calibrated there. Early-season buckets with few picks will jump around.</p>
  <section class="panel" id="overall">
    <h2>Overall · ${overall.n ? `${overall.w} of ${overall.n} (${pct(overall.rate)})` : "no graded picks yet"}</h2>
    ${overall.n ? `<p>Sample size: <b>${overall.n}</b> graded picks across every live sport. Expected correct from the model's own figures: about ${overall.exp.toFixed(1)}.</p>
    ${chartSvg(overallBands)}
    ${tableHtml(overallBands)}
    <p class="small">Accuracy score (average squared error): <b>${overall.brier.toFixed(3)}</b>.</p>` : `<p>No graded picks yet.</p>`}
  </section>
  <nav class="crumbs" aria-label="Jump to sport"><a href="#nba">NBA</a> · <a href="#nfl">NFL</a> · <a href="#nhl">NHL</a> · <a href="#epl">Premier League</a> · <a href="#championship">Championship</a> · <a href="#tennis">Tennis</a> · <a href="/results">Results →</a> · <a href="/lights">How the lights work</a> · <a href="/today">Today's games →</a></nav>
  ${parts.join("\n")}
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice. Figures match the sport record pages for the same graded set.</p>`;

  return html(shell({
    title: "Prediction Accuracy and Calibration | ProbaLab",
    description: "How often ProbaLab's predicted win chances come true, bucketed from 50% to 80%+, with sample sizes for every live sport.",
    path: "/accuracy",
    body,
  }), 200, 120);
}

export const onRequestHead = (ctx) => asHead(onRequestGet, ctx);
