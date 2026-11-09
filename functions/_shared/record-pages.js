// Shared track-record pages for every sport ProbaLab covers.
// Grading rules match the existing per-sport records exactly. Light thresholds are not changed.
// Units are not invented: the public record is wins and losses, not a staking record.
import { getFeed, gamesOf, shell, html, esc, chip, sportName, signupMain, ORIGIN } from "./site.js";

export const EPL_LIGHTS_FROM = "2026-10-23T23:42:00Z";

export const SPORT_ORDER = ["nba", "nfl", "nhl", "epl", "championship", "tennis"];

const NHLN = { ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres", CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks", COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars", DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers", LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montréal Canadiens", NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders", NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers", PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken", STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs", UTA: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights", WSH: "Washington Capitals", WPG: "Winnipeg Jets" };

const CONF = { SUPER: "Very high", GREEN: "High", ORANGE: "Medium", RED: "Low" };

// Display copy only. Cut-offs are the live ones already used on each sport page.
export const LIGHT_COPY = {
  nba: { scale: "two-way", green: "65%+", orange: "55–65%", red: "under 55%", super: true, note: "Super is an NBA flag: the model is confident (60%+) and rates the team well above its usual level." },
  nfl: { scale: "two-way", green: "65%+", orange: "55–65%", red: "under 55%", super: false },
  nhl: { scale: "two-way", green: "65%+", orange: "55–65%", red: "under 55%", super: false },
  epl: { scale: "three-way", green: "55%+", orange: "45–55%", red: "under 45%", super: false, switchOn: EPL_LIGHTS_FROM },
  championship: { scale: "three-way", green: "55%+", orange: "45–55%", red: "under 45%", super: false },
  tennis: { scale: "two-way", green: "70%+", orange: "60–70%", red: "under 60%", super: false },
};

const BANDS_NBA = [[0.5, 0.55], [0.55, 0.6], [0.6, 0.65], [0.65, 0.7], [0.7, 0.8], [0.8, 1.01]];
const BANDS_SOCCER = [[0, 0.45, "Under 45%"], [0.45, 0.55, "45–55%"], [0.55, 0.65, "55–65%"], [0.65, 2, "65% or more"]];
const BANDS_TENNIS = [[0, 0.6, "Under 60%"], [0.6, 0.7, "60–70%"], [0.7, 0.8, "70–80%"], [0.8, 2, "80% or more"]];

const isTip = (l) => l === "SUPER" || l === "GREEN";
const pct = (p) => (p == null || !Number.isFinite(Number(p)) ? "—" : `${Math.round(Number(p) * 100)}%`);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const asset = (ctx, p, d) => ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)).then((r) => (r.ok ? r.json() : d)).catch(() => d);
const asList = (raw) => (Array.isArray(raw) ? raw : raw?.games ?? raw?.matches ?? []);
const sgnPct = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(1)}%`;
const csvEsc = (s) => {
  const t = s == null ? "" : String(s);
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

function applyMarket(row, market, side) {
  if (!market || side == null) return row;
  const entry = market[row.id];
  const m = entry?.[side];
  if (m && m.posted_price && m.close_price && m.vs_close != null) {
    row.posted_price = Number(m.posted_price);
    row.close_price = Number(m.close_price);
    row.vs_close = Number(m.vs_close);
  }
  return row;
}

function soccerPickP(g) {
  if (g.pick === "home") return num(g.p_home);
  if (g.pick === "away") return num(g.p_away);
  if (g.pick === "draw") return num(g.p_draw);
  return null;
}

function soccerLight(sport, start, pickP) {
  if (sport === "epl" && (!start || start < EPL_LIGHTS_FROM)) return null;
  if (pickP == null) return null;
  return pickP >= 0.55 ? "GREEN" : pickP >= 0.45 ? "ORANGE" : "RED";
}

export function rowsFromFeed(sport, data) {
  const rows = [];
  for (const g of data.games ?? []) {
    if (!g.pick || g.status !== "post" || g.won == null) continue;
    rows.push({
      id: String(g.game_id ?? g.id),
      sport,
      start_utc: g.start_utc ?? null,
      posted_utc: g.first_posted ?? null,
      last_update_utc: g.last_updated ?? null,
      posted_note: g.first_posted ? null : "Frozen at start · exact post time is not on file",
      home: g.home_name ?? g.home,
      away: g.away_name ?? g.away,
      pick: g.pick_name ?? g.pick,
      pick_p: num(g.pick_p),
      light: g.light ?? null,
      won: !!g.won,
      home_score: g.home_score ?? null,
      away_score: g.away_score ?? null,
      score: g.home_score != null && g.away_score != null ? `${g.away_score}–${g.home_score}` : "",
      href: g.path ?? `/${sport}#game-${g.game_id ?? g.id}`,
      close_price: num(g.close_price),
      posted_price: num(g.posted_price),
      vs_close: num(g.vs_close),
      clv: num(g.clv),
    });
  }
  return rows;
}

export function rowsFromNhl({ picks, pretip, grades, market }) {
  const SN = pretip?.games ?? {};
  const pickList = asList(picks);
  const byId = new Map(pickList.map((g) => [String(g.game_id ?? g.id), g]));
  const ids = new Set([...Object.keys(SN), ...byId.keys()]);
  const rows = [];
  for (const id of ids) {
    const sn = SN[id];
    if (!sn || typeof sn.won !== "boolean") continue;
    const g = byId.get(id) ?? {};
    const gr = (grades ?? {})[id];
    const home = g.home, away = g.away;
    const pickSide = sn.pick === home ? "home" : sn.pick === away ? "away" : (sn.pick === "home" || sn.pick === "away" ? sn.pick : null);
    const pickAbbr = pickSide === "home" ? home : pickSide === "away" ? away : sn.pick;
    const home_score = gr?.home_score ?? g.home_score ?? null;
    const away_score = gr?.away_score ?? g.away_score ?? null;
    const row = {
      id,
      sport: "nhl",
      start_utc: g.start_utc ?? g.kickoff_utc ?? g.puck_drop_utc ?? g.date ?? null,
      posted_utc: g.created_at ?? null,
      last_update_utc: null,
      posted_note: "Recorded chance is the snapshot frozen at puck drop.",
      home: NHLN[home] ?? home,
      away: NHLN[away] ?? away,
      pick: NHLN[pickAbbr] ?? pickAbbr,
      pick_p: num(sn.pick_p),
      light: sn.light ?? null,
      won: !!sn.won,
      home_score,
      away_score,
      score: home_score != null && away_score != null ? `${away_score}–${home_score}` : "",
      href: `/nhl#game-${id}`,
      close_price: null, posted_price: null, vs_close: null, clv: null,
    };
    applyMarket(row, market, pickSide);
    rows.push(row);
  }
  return rows;
}

export function rowsFromSoccer(sport, { picks, grades, market }) {
  const rows = [];
  for (const g of asList(picks)) {
    const id = String(g.game_id ?? g.id);
    const gr = (grades ?? {})[id];
    if (!gr?.graded) continue;
    const pickP = soccerPickP(g);
    const pickName = g.pick === "home" ? g.home : g.pick === "away" ? g.away : "Draw";
    const home_score = gr.home_score ?? g.home_score ?? null;
    const away_score = gr.away_score ?? g.away_score ?? null;
    const row = {
      id,
      sport,
      start_utc: g.start_utc ?? null,
      posted_utc: g.first_posted ?? g.created_at ?? null,
      last_update_utc: g.last_updated ?? null,
      posted_note: (g.first_posted || g.created_at) ? null : "Frozen at start · exact post time is not on file",
      home: g.home,
      away: g.away,
      pick: pickName,
      pick_p: pickP,
      light: soccerLight(sport, g.start_utc, pickP),
      won: !!gr.correct,
      home_score,
      away_score,
      score: home_score != null && away_score != null ? `${home_score}–${away_score}` : "",
      href: `/${sport}#game-${id}`,
      close_price: null, posted_price: null, vs_close: null, clv: null,
      result: gr.result ?? null,
    };
    applyMarket(row, market, g.pick);
    rows.push(row);
  }
  return rows;
}

export function rowsFromTennis({ picks, market }) {
  const matches = asList(picks);
  const rows = [];
  for (const m of matches) {
    const won = m.result === "won" ? true : m.result === "lost" ? false : (m.right == null ? null : !!m.right);
    if (won == null) continue;
    const id = String(m.id ?? m.game_id);
    const side = m.pick;
    const pickP = m.pick_pct != null ? (Number(m.pick_pct) > 1 ? Number(m.pick_pct) / 100 : Number(m.pick_pct)) : num(m.pick_p);
    const row = {
      id,
      sport: "tennis",
      start_utc: m.start_utc ?? null,
      posted_utc: m.first_posted ?? m.created_at ?? null,
      last_update_utc: m.last_updated ?? null,
      posted_note: (m.first_posted || m.created_at) ? "Frozen at the first serve." : "Frozen at the first serve · exact post time is not on file",
      home: m.player_a,
      away: m.player_b,
      pick: side === "a" ? m.player_a : side === "b" ? m.player_b : m.pick_name ?? side,
      pick_p: pickP,
      light: m.light ?? null,
      won,
      home_score: null,
      away_score: null,
      score: `${m.score ?? ""}${m.retired ? " ret." : ""}`.trim(),
      href: `/tennis#game-${id}`,
      close_price: null, posted_price: null, vs_close: null, clv: null,
      extra: [m.tournament, m.round].filter(Boolean).join(" · "),
    };
    applyMarket(row, market, side);
    rows.push(row);
  }
  return rows;
}

export function tally(rows) {
  const done = rows.slice().sort((a, b) => String(b.start_utc ?? "").localeCompare(String(a.start_utc ?? "")));
  const n = done.length, w = done.filter((g) => g.won).length;
  const exp = done.reduce((a, g) => a + (g.pick_p ?? 0), 0);
  const brier = n ? done.reduce((a, g) => a + ((g.pick_p ?? 0) - (g.won ? 1 : 0)) ** 2, 0) / n : null;
  const byLight = {};
  for (const l of ["SUPER", "GREEN", "ORANGE", "RED", null]) {
    const xs = done.filter((g) => (g.light ?? null) === l);
    if (!xs.length && l === null) continue;
    byLight[l ?? "NONE"] = { n: xs.length, w: xs.filter((g) => g.won).length, exp: xs.reduce((a, g) => a + (g.pick_p ?? 0), 0) };
  }
  const vcs = done.filter((g) => g.vs_close != null);
  const close = {
    n: vcs.length,
    beat: vcs.filter((g) => g.vs_close > 0).length,
    mean: vcs.length ? vcs.reduce((a, g) => a + g.vs_close, 0) / vcs.length : null,
  };
  const posted = done.filter((g) => g.posted_utc).length;
  return { done, n, w, exp, brier, byLight, close, posted, tips: { n: done.filter((g) => isTip(g.light)).length, w: done.filter((g) => isTip(g.light) && g.won).length } };
}

export function seasonLabel(sport, rows, feedSeason) {
  if ((sport === "nba" || sport === "nfl") && feedSeason) return `${feedSeason - 1}–${String(feedSeason).slice(2)}`;
  if (sport === "tennis") {
    const years = rows.map((r) => r.start_utc && new Date(r.start_utc).getUTCFullYear()).filter(Boolean);
    return years.length ? String(Math.max(...years)) : "2026";
  }
  return "2026–27";
}

function bandLabel(lo, hi, given) {
  if (given) return given;
  return hi >= 1 || hi > 1 ? `${Math.round(lo * 100)}%+` : `${Math.round(lo * 100)}–${Math.min(100, Math.round(hi * 100))}%`;
}

function bandsFor(sport, done) {
  const spec = sport === "epl" || sport === "championship" ? BANDS_SOCCER : sport === "tennis" ? BANDS_TENNIS : BANDS_NBA.map(([lo, hi]) => [lo, hi, null]);
  return spec.map(([lo, hi, label]) => {
    const xs = done.filter((g) => g.pick_p != null && g.pick_p >= lo && g.pick_p < hi);
    return { lo, hi, label: bandLabel(lo, hi, label), n: xs.length, exp: xs.length ? xs.reduce((a, g) => a + g.pick_p, 0) / xs.length : null, hit: xs.length ? xs.filter((g) => g.won).length / xs.length : null, wins: xs.filter((g) => g.won).length };
  });
}

function calibChart(bands, xmin) {
  const W = 560, Hh = 360, pad = 44;
  const minX = xmin ?? Math.min(0.5, ...bands.filter((b) => b.n).map((b) => b.lo));
  const span = 1 - minX || 0.5;
  const X = (p) => pad + ((p - minX) / span) * (W - 2 * pad);
  const Y = (p) => Hh - pad - p * (Hh - 2 * pad);
  const xticks = [];
  for (let v = Math.ceil(minX * 10) / 10; v <= 1.001; v += 0.1) xticks.push(Math.round(v * 10) / 10);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((v) => `<line x1="${pad}" x2="${W - pad}" y1="${Y(v)}" y2="${Y(v)}" stroke="#232a42"/><text x="${pad - 8}" y="${Y(v) + 4}" text-anchor="end" fill="#8b93b0" font-size="11">${v * 100}%</text>`).join("")
    + xticks.map((v) => `<text x="${X(v)}" y="${Hh - pad + 18}" text-anchor="middle" fill="#8b93b0" font-size="11">${Math.round(v * 100)}%</text>`).join("");
  const dots = bands.filter((b) => b.n).map((b) => `<circle cx="${X(b.exp).toFixed(1)}" cy="${Y(b.hit).toFixed(1)}" r="${(4 + Math.sqrt(b.n) * 2).toFixed(1)}" fill="#19e3ff" fill-opacity=".75"><title>${b.label}: predicted ${pct(b.exp)}, happened ${pct(b.hit)} (${b.n} games)</title></circle>`).join("");
  return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Calibration chart: predicted chance against how often it happened">${grid}
    <line x1="${X(Math.max(minX, 0.4))}" y1="${Y(Math.max(minX, 0.4))}" x2="${X(1)}" y2="${Y(1)}" stroke="#ff2fc0" stroke-dasharray="5 5"/>${dots}
    <text x="${W / 2}" y="${Hh - 6}" text-anchor="middle" fill="#8b93b0" font-size="12">Model's chance for the predicted winner</text>
    <text x="14" y="${Hh / 2}" transform="rotate(-90 14 ${Hh / 2})" text-anchor="middle" fill="#8b93b0" font-size="12">How often it happened</text></svg>`;
}

function sportSwitcher(current) {
  const links = SPORT_ORDER.map((s) => {
    const name = sportName(s);
    return s === current ? `<span class="on">${esc(name)}</span>` : `<a href="/${s}/record">${esc(name)}</a>`;
  });
  return `<nav class="record-sports" aria-label="Records by sport">${links.join("")}<a href="/record">All sports</a></nav>`;
}

function timeCell(iso, fallback) {
  if (!iso) return fallback ? `<span class="posted-note">${esc(fallback)}</span>` : "—";
  return `<time datetime="${esc(iso)}" data-local>${esc(iso.replace("T", " ").replace(/\.\d+Z$/, " UTC").replace(/Z$/, " UTC"))}</time>`;
}

function closeCell(g) {
  if (g.vs_close == null) return "—";
  const cls = g.vs_close > 0 ? "pos" : g.vs_close < 0 ? "neg" : "";
  const price = g.posted_price != null ? `$${Number(g.posted_price).toFixed(2)} ` : "";
  return `${price}<b class="${cls}">${sgnPct(g.vs_close)}</b>`;
}

function resultCell(g) {
  const mark = `<span class="${g.won ? "pos" : "neg"}">${g.won ? "✓" : "✕"}</span>`;
  return g.score ? `${mark} ${esc(g.score)}` : mark;
}

function matchLabel(g) {
  if (g.sport === "tennis") return `${g.home} v ${g.away}`;
  if (g.sport === "epl" || g.sport === "championship") return `${g.home} v ${g.away}`;
  return `${g.away} @ ${g.home}`;
}

function ledeFor(sport, S, t) {
  const ahead = t.w >= t.exp ? `${(t.w - t.exp).toFixed(1)} ahead of` : `${(t.exp - t.w).toFixed(1)} behind`;
  const core = `Every finished ${S} pick stays on this page once it is marked, right or wrong. So far the model has named the winner in <b>${t.w} of ${t.n}</b> games (${t.n ? pct(t.w / t.n) : "0%"}). Its own figures said to expect about ${t.exp.toFixed(1)} correct, so it is running ${ahead} what it forecast.`;
  const extra = {
    nhl: " Each pick, chance and light is taken from the snapshot frozen at puck drop.",
    epl: " Live picks are counted from the first saved live pick (round 8, 2026–27). A result is marked only when two score sources agree.",
    championship: " Live picks are counted from the first saved live pick (round 15, 2026–27). A result is marked only when two score sources agree.",
    tennis: " Live picks are counted from 7 November 2026. A retirement counts as a result; a walkover does not.",
  }[sport] ?? " Picks are timestamped before the start and frozen when the game begins.";
  return core + extra + " The public record is wins and losses, not staking units.";
}

export function renderSportRecord(view) {
  const { sport, rows, season, error } = view;
  const S = sportName(sport);
  const t = tally(rows);
  const bands = bandsFor(sport, t.done);
  const xmin = (sport === "epl" || sport === "championship" || sport === "tennis") ? 0.4 : 0.5;
  const copy = LIGHT_COPY[sport];
  const lightKeys = sport === "nba" ? ["SUPER", "GREEN", "ORANGE", "RED"] : ["GREEN", "ORANGE", "RED"];
  const lights = lightKeys
    .map((l) => [l, t.byLight[l] ?? { n: 0, w: 0 }])
    .filter(([, x]) => x.n);
  if (t.byLight.NONE?.n) lights.push(["NONE", t.byLight.NONE]);

  const title = `${S} Prediction Record and Calibration ${season} | ProbaLab`;
  const description = `Every ${S} prediction ProbaLab has made this season: ${t.w} of ${t.n} correct (${t.n ? pct(t.w / t.n) : "0%"}), with a calibration chart showing how often each predicted chance came true.`;
  if (error) {
    return shell({ title: `${S} record | ProbaLab`, description: `The ${S} record could not be loaded just now.`, path: `/${sport}/record`, noindex: true,
      body: `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/${sport}">${esc(S)} predictions</a> › <span>Record</span></nav>
      ${sportSwitcher(sport)}
      <h1>${esc(S)} prediction record</h1>
      <section class="panel"><p>${esc(error)}</p></section>` });
  }
  const closeNote = t.close.n
    ? `<p class="small">A closing price is on file for <b>${t.close.n} of ${t.n}</b> finished picks. ${t.close.n < t.n ? "Gaps are left as they are; this page does not fetch new prices." : ""}</p>`
    : `<p class="small">No closing prices are on file for these ${S} picks yet. Gaps are left as they are; this page does not fetch new prices.</p>`;
  const beat = t.close.n
    ? `<p>On ${t.close.n} pick${t.close.n === 1 ? "" : "s"} with a closing price we beat the close <b>${t.close.beat} time${t.close.beat === 1 ? "" : "s"}</b> (mean ${sgnPct(t.close.mean)} vs close).</p>` : "";
  const postedNote = t.posted === t.n && t.n
    ? `<p class="small">A posted time is on file for every pick, taken from the first time it was published, then frozen at the start.</p>`
    : `<p class="small">A posted time is on file for <b>${t.posted} of ${t.n}</b> finished picks. Where it is missing we show that the pick was frozen at the start and do not invent a time.</p>`;

  const tbl = `<table class="cal"><thead><tr><th>Model chance</th><th>Games</th><th>Average prediction</th><th>Actually won</th></tr></thead><tbody>${bands.filter((b) => b.n).map((b) => `<tr><td>${esc(b.label)}</td><td>${b.n}</td><td>${pct(b.exp)}</td><td>${pct(b.hit)}</td></tr>`).join("")}</tbody></table>`;
  const lightList = lights.length
    ? `<ul>${lights.map(([l, x]) => `<li>${l === "NONE" ? "No light" : `${chip(l)} ${esc(CONF[l] ?? "")} confidence`}: ${x.w} of ${x.n} correct (${pct(x.n ? x.w / x.n : null)})</li>`).join("")}</ul>
       <p class="small">${copy.scale === "three-way" ? `Football lights: green ${copy.green}, orange ${copy.orange}, red ${copy.red}.` : `Lights: green ${copy.green}, orange ${copy.orange}, red ${copy.red}.`}${copy.super ? " Super is used on the NBA." : ""} ${copy.switchOn ? "Premier League lights apply only to matches kicking off from 23 Oct 2026, 23:42 UTC; earlier picks stay unlit." : ""} <a href="/lights">How the lights work</a></p>`
    : `<p>Lights are not shown for this set. <a href="/lights">How the lights work</a></p>`;

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/${sport}">${esc(S)} predictions</a> › <span>Record</span></nav>
  ${sportSwitcher(sport)}
  <p class="eyebrow">// ${esc(S)} · model record · ${t.n} finished game${t.n === 1 ? "" : "s"} · ${esc(season)}</p>
  <h1>${esc(S)} prediction record</h1>
  <p>${ledeFor(sport, S, t)}</p>
  <p class="record-actions"><a class="csv-btn" href="/${sport}/record.csv">Download CSV</a> <a href="/record">All sports</a> · <a href="/lights">How the lights work</a> · <a href="/accuracy">Accuracy</a></p>
  <section class="panel"><h2>Calibration: when we said 70%, did it happen 70% of the time?</h2>
    ${t.n ? calibChart(bands, xmin) : ""}
    <p>Each dot groups games by the chance the model gave its predicted winner. A dot on the dashed diagonal means those chances came true exactly as often as stated; bigger dots hold more games. The accuracy score (average squared error, lower is better) is <b>${t.brier == null ? "n/a" : t.brier.toFixed(3)}</b>, against 0.250 for a coin flip.</p>
    ${tbl}
    <p class="small">Early groups are small, so single results move the dots a lot. The chart fills in as more games are marked.</p></section>
  <section class="panel"><h2>By confidence level</h2>${lightList}</section>
  <section class="panel"><h2>Closing prices</h2>${beat}${closeNote}</section>
  ${signupMain("record")}
  <section class="panel"><h2>Every finished pick</h2>
    ${postedNote}
    <div class="tablewrap"><table class="record-picks">
      <thead><tr><th>Kick-off</th><th>Posted</th><th>Match</th><th>Pick</th><th class="n">Chance</th><th>Light</th><th>Result</th><th class="n">vs close</th></tr></thead>
      <tbody>${t.done.map((g) => `<tr>
        <td>${timeCell(g.start_utc)}</td>
        <td>${timeCell(g.posted_utc, g.posted_note)}</td>
        <td>${g.href ? `<a href="${esc(g.href)}">${esc(matchLabel(g))}</a>` : esc(matchLabel(g))}${g.extra ? `<br><small>${esc(g.extra)}</small>` : ""}</td>
        <td>${esc(g.pick)}</td>
        <td class="n">${pct(g.pick_p)}</td>
        <td>${g.light ? chip(g.light) : "—"}</td>
        <td>${resultCell(g)}</td>
        <td class="n">${closeCell(g)}</td>
      </tr>`).join("")}</tbody>
    </table></div>
  </section>
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;
  const jsonld = { "@context": "https://schema.org", "@type": "WebPage", name: `${S} prediction record`, url: `${ORIGIN}/${sport}/record`, description };
  return shell({ title, description, path: `/${sport}/record`, body, jsonld, signup: false });
}

export function renderRecordCsv(view) {
  const { sport, rows } = view;
  const t = tally(rows);
  const header = ["sport", "game_id", "kickoff_utc", "posted_utc", "last_update_utc", "posted_note", "home", "away", "pick", "chance", "light", "won", "score", "posted_price", "close_price", "vs_close"];
  const lines = [header.join(",")];
  for (const g of t.done) {
    lines.push([
      sport, g.id, g.start_utc, g.posted_utc, g.last_update_utc, g.posted_note,
      g.home, g.away, g.pick,
      g.pick_p == null ? "" : g.pick_p.toFixed(4),
      g.light ?? "",
      g.won ? "W" : "L",
      g.score ?? "",
      g.posted_price ?? "",
      g.close_price ?? "",
      g.vs_close == null ? "" : g.vs_close.toFixed(4),
    ].map(csvEsc).join(","));
  }
  return lines.join("\n") + "\n";
}

export function csvResponse(view) {
  const name = `${view.sport}-record.csv`;
  return new Response(renderRecordCsv(view), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "public, max-age=0, s-maxage=120, must-revalidate",
    },
  });
}

export async function loadSportRecord(ctx, sport) {
  const name = sportName(sport);
  try {
    if (sport === "nba" || sport === "nfl") {
      const data = gamesOf(sport, await getFeed(ctx, sport));
      const rows = rowsFromFeed(sport, data);
      return { sport, name, rows, season: seasonLabel(sport, rows, data.season) };
    }
    if (sport === "nhl") {
      const [picks, pretip, grades, market] = await Promise.all([
        asset(ctx, "/data/nhl-picks.json", []),
        asset(ctx, "/data/nhl-pretip.json", {}),
        asset(ctx, "/data/nhl-grades.json", {}),
        asset(ctx, "/data/nhl-market.json", {}),
      ]);
      const rows = rowsFromNhl({ picks, pretip, grades, market });
      return { sport, name, rows, season: seasonLabel(sport, rows) };
    }
    if (sport === "epl" || sport === "championship") {
      const [picks, grades, market] = await Promise.all([
        asset(ctx, `/data/${sport}-picks.json`, []),
        asset(ctx, `/data/${sport}-grades.json`, {}),
        asset(ctx, `/data/${sport}-market.json`, {}),
      ]);
      const rows = rowsFromSoccer(sport, { picks, grades, market });
      return { sport, name, rows, season: seasonLabel(sport, rows) };
    }
    if (sport === "tennis") {
      const [picks, market] = await Promise.all([
        asset(ctx, "/data/tennis-picks.json", { matches: [] }),
        asset(ctx, "/data/tennis-market.json", {}),
      ]);
      const rows = rowsFromTennis({ picks, market });
      return { sport, name, rows, season: seasonLabel(sport, rows) };
    }
  } catch (e) {
    return { sport, name, rows: [], season: seasonLabel(sport, []), error: `We couldn't load the ${name} record just now. Please refresh in a minute.` };
  }
  return { sport, name, rows: [], season: "", error: "Unknown sport." };
}

export async function handleSportRecordRequest(ctx, sport) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  if (!(parts.length === 1 && (parts[0] === "record" || parts[0] === "record.csv"))) return null;
  const view = await loadSportRecord(ctx, sport);
  if (parts[0] === "record.csv") return csvResponse(view);
  return html(renderSportRecord(view));
}

export function renderRecordHub(views) {
  const cards = views.map((v) => {
    const t = tally(v.rows);
    const S = v.name;
    if (v.error) {
      return `<article class="panel"><h2><a href="/${v.sport}/record">${esc(S)}</a></h2><p>${esc(v.error)}</p></article>`;
    }
    return `<article class="panel record-card">
      <h2><a href="/${v.sport}/record">${esc(S)}</a></h2>
      <p class="record-hero"><b>${t.w}–${t.n - t.w}</b> <span>(${t.n ? pct(t.w / t.n) : "—"})</span></p>
      <p>${t.n} finished pick${t.n === 1 ? "" : "s"} · expected about ${t.exp.toFixed(1)} correct · ${esc(v.season)}</p>
      <p><a href="/${v.sport}/record">Full ${esc(S)} record →</a> · <a href="/${v.sport}/record.csv">CSV</a></p>
    </article>`;
  }).join("");
  const all = views.flatMap((v) => v.error ? [] : v.rows);
  const t = tally(all);
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Record</span></nav>
  <p class="eyebrow">// every sport · public record</p>
  <h1>Track record</h1>
  <p>One record page for every sport we cover, in the same layout: every finished pick, whether it won or lost, the chance we gave it, the light, and the date and time the pick was posted when we have it. Where a posted time is not on file we say the pick was frozen at the start rather than invent a time. The public record is wins and losses, not staking units.</p>
  <p>Figures on each sport page match that sport's existing record. <a href="/lights">How the lights work</a> · <a href="/accuracy">Accuracy and calibration</a></p>
  ${t.n ? `<section class="panel"><h2>All sports so far</h2><p><b>${t.w} of ${t.n}</b> (${pct(t.w / t.n)}). The model's own figures said to expect about ${t.exp.toFixed(1)} correct. This totals different sports and should be read alongside the per-sport pages.</p></section>` : ""}
  <div class="record-grid">${cards}</div>`;
  return shell({
    title: "Track Record | ProbaLab",
    description: "The public record of every ProbaLab pick across NBA, NFL, NHL, Premier League, Championship and tennis: wins, losses, chances, lights and posted times.",
    path: "/record",
    body,
    jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "ProbaLab track record", url: `${ORIGIN}/record` },
  });
}

export function renderLightsPage() {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>How the lights work</span></nav>
  <p class="eyebrow">// confidence lights · by sport</p>
  <h1>How the lights work</h1>
  <p>Every pick gets a coloured light so you can see, at a glance, how strongly the model rates its own call. The cut-offs are not the same in every sport, and that is deliberate. A 55% call in a two-way sport (one team or the other wins) is only a lean. In a three-way football match, with a draw on the table, 55% is already a strong favourite.</p>
  <p>We do not move these cut-offs to chase a short run of results. A light tells you how confident the model was at the time, on that sport's own scale.</p>

  <section class="panel"><h2>NBA, NFL and NHL</h2>
    <div class="lights">
      <div><span>${chip("SUPER")}</span><p>NBA only. The model is confident (60%+) and rates the team well above its usual level. Our strongest picks.</p></div>
      <div><span>${chip("GREEN")}</span><p>65% or more. One of our top picks.</p></div>
      <div><span>${chip("ORANGE")}</span><p>A lean, 55 to 65%.</p></div>
      <div><span>${chip("RED")}</span><p>Under 55%. Close to a coin flip.</p></div>
    </div>
    <p>These are two-way sports: one side wins. 65% is a high bar, and Super is reserved for NBA sides the model both likes and sees as well above their usual level. The NFL and NHL use the same 65 / 55 scale and typically have no Super flag.</p>
  </section>

  <section class="panel"><h2>Premier League and Championship</h2>
    <div class="lights">
      <div><span>${chip("GREEN")}</span><p>55% or more. A genuine favourite in a three-way market.</p></div>
      <div><span>${chip("ORANGE")}</span><p>A lean, 45 to 55%.</p></div>
      <div><span>${chip("RED")}</span><p>Under 45%. The match is open, and a draw is a real third result.</p></div>
    </div>
    <p>Green starts at 55% because a draw is possible. In the Premier League and the Championship the model publishes three chances — home, draw and away — and the pick is the most likely of those three. A 55% side in that setting is already clearer than a 55% side in the NBA.</p>
    <p>Premier League lights apply only to matches kicking off from <b>23 October 2026, 23:42 UTC</b>. Earlier Premier League picks stay on the record without a light; we do not go back and re-colour them. Championship picks have been lit from the first live round.</p>
  </section>

  <section class="panel"><h2>Tennis</h2>
    <div class="lights">
      <div><span>${chip("GREEN")}</span><p>70% or more. A clear favourite.</p></div>
      <div><span>${chip("ORANGE")}</span><p>A lean, 60 to 70%.</p></div>
      <div><span>${chip("RED")}</span><p>Under 60%. In tennis that really does mean a close match: favourites win often, so the bar for a top pick is higher.</p></div>
    </div>
    <p>There is no draw in a completed singles match. Favourites also win more often than in team sports, so green starts at 70% and a red light is a genuinely tight call rather than a coin-flip team game.</p>
  </section>

  <section class="panel"><h2>What a light is not</h2>
    <ul class="reading">
      <li>A light is not a staking plan, and the public record does not keep units.</li>
      <li>A green pick can still lose. A 70% call is meant to miss about three times in ten.</li>
      <li>Lights are assigned from the frozen pre-start chance. They are not changed after the result.</li>
    </ul>
    <p><a href="/record">Track record for every sport →</a> · <a href="/accuracy">Accuracy and calibration →</a></p>
  </section>`;
  return shell({
    title: "How the Lights Work | ProbaLab",
    description: "Why ProbaLab's green, orange and red lights use different cut-offs on the NBA, NFL and NHL, in the Premier League and Championship, and in tennis.",
    path: "/lights",
    body,
    jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "How the lights work", url: `${ORIGIN}/lights` },
  });
}
