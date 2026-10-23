// HIDDEN NHL section (not linked, not in sitemap, noindex + X-Robots-Tag). Preview only until John OKs launch.
// Picks: /data/nhl-picks.json (same shape as epl-picks.json, no draw). Grades: /data/nhl-grades.json (ESPN + NHL API must agree).
// Past seasons: /data/nhl-backtest.json (walk-forward re-run).
import { shell, esc, slug } from "../_shared/site.js";
const TEAMS = { ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres", CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks", COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars", DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers", LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montréal Canadiens", NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders", NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers", PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken", STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs", UTA: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights", WSH: "Washington Capitals", WPG: "Winnipeg Jets" };
const nm = (a) => TEAMS[a] ?? a;
const pct = (p) => `${Math.round(Number(p) * 100)}%`;
const fmt = (iso, o) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", ...o }).format(new Date(iso));
const whenAU = (iso) => fmt(iso, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });
const LIGHT = { GREEN: ["Green", "the model rates this pick as likely"], ORANGE: ["Orange", "a lean"], RED: ["Red", "close to an open game"] };
const lightOf = (p) => (p == null ? null : p >= 0.6 ? "GREEN" : p >= 0.5 ? "ORANGE" : "RED");
const chip = (l) => (l ? `<span class="chip ${esc(l)}">${esc((LIGHT[l] ?? [l])[0])}</span>` : "");
const pickP = (g) => Number(g.pick === "home" ? g.p_home : g.p_away);
const pickName = (g) => nm(g.pick === "home" ? g.home : g.away);
const pathOf = (g) => `/nhl/${slug(nm(g.away))}-vs-${slug(nm(g.home))}-prediction-${g.game_id}`;
const out = (s, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120", "x-robots-tag": "noindex, nofollow" } });
const page = (o) => out(shell({ ...o, noindex: true, signup: false }), o.status);
async function asset(ctx, p, d) { try { const r = await ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)); return r.ok ? await r.json() : d; } catch { return d; } }
async function load(ctx) {
  const [raw, grades, bt] = await Promise.all([asset(ctx, "/data/nhl-picks.json", []), asset(ctx, "/data/nhl-grades.json", {}), asset(ctx, "/data/nhl-backtest.json", null)]);
  const gs = (Array.isArray(raw) ? raw : raw.games ?? []).map((g) => {
    const x = { ...g, game_id: String(g.game_id), start_utc: g.start_utc ?? g.puck_drop_utc ?? g.kickoff_utc, graded: false, correct: null, flag: null };
    const gr = grades[x.game_id]; if (gr) Object.assign(x, gr.graded ? { graded: true, correct: gr.correct, home_score: gr.home_score, away_score: gr.away_score } : { flag: gr.flag });
    x.light = lightOf(pickP(x)); return x;
  });
  return { gs, bt };
}
function record(gs) {
  const g = gs.filter((x) => x.graded), c = g.filter((x) => x.correct).length, gr = g.filter((x) => x.light === "GREEN"), gc = gr.filter((x) => x.correct).length;
  return g.length ? `All picks ${c} of ${g.length} correct (${pct(c / g.length)})${gr.length ? `; green picks ${gc} of ${gr.length} (${pct(gc / gr.length)})` : ""}. Counted from the first saved live pick.` : "No graded results yet. Every pick stays on the record, right or wrong.";
}
const row = (g) => `<li><a href="${esc(pathOf(g))}"><span class="d">${esc(fmt(g.start_utc, { weekday: "short", day: "numeric", month: "short" }))}</span><span class="m">${esc(nm(g.away))} @ ${esc(nm(g.home))}</span>
  <span class="p">${esc(g.pick === "home" ? g.home : g.away)} ${pct(pickP(g))}</span>${chip(g.light)}${g.graded ? `<span class="r ${g.correct ? "pos" : "neg"}">${g.correct ? "✓" : "✕"} ${g.away_score}–${g.home_score}</span>` : g.status === "post" || g.flag ? `<span class="r">result being checked</span>` : ""}</a></li>`;
const lights = `<p>Lights: <b>green</b> means the model rates this pick as likely, <b>orange</b> is a lean and <b>red</b> is close to an open game.</p>`;
function backtest(bt) {
  if (!bt) return "";
  const rows = Object.entries(bt.seasons).map(([s, v]) => `<tr><td>${s}–${String(+s + 1).slice(2)}${v.n < 1000 ? " (so far)" : ""}</td><td align="center">${v.n}</td><td align="center"><b>${pct(v.c / v.n)}</b></td><td align="center">${pct(v.home / v.n)}</td>
    ${["GREEN", "ORANGE", "RED"].map((l) => `<td align="center">${v.lights[l][0] ? `${pct(v.lights[l][1] / v.lights[l][0])} <small>(${v.lights[l][0]})</small>` : "–"}</td>`).join("")}</tr>`).join("");
  return `<section class="panel"><h2>Past-season testing</h2><p><b>This is a re-run on past seasons, not the live record.</b> The model was run game by game through each season using only results from earlier days, then checked against the real results. "Always home" is how often simply picking the home team was right.</p>
  <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th align="left">Season</th><th>Games</th><th>Model right</th><th>Always home</th><th>Green</th><th>Orange</th><th>Red</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="note">Light columns show how often picks with that light were right, with the number of games in brackets.</p></section>`;
}
function hub({ gs, bt }) {
  const now = Date.now(), up = gs.filter((g) => g.status !== "post" && !g.graded && new Date(g.start_utc).getTime() > now - 4 * 3600e3).sort((a, b) => a.start_utc.localeCompare(b.start_utc));
  const done = gs.filter((g) => g.graded || g.status === "post").sort((a, b) => b.start_utc.localeCompare(a.start_utc));
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>NHL predictions</span></nav>
  <p class="eyebrow">// NHL · win predictions · 2026–27 season</p><h1>NHL predictions</h1>
  <p>Every NHL game gets a win chance for each team from the model. Results are only marked once two independent score sources agree.</p>
  ${lights}<p><b>Live record:</b> ${record(gs)}</p>
  ${up.length ? `<section class="panel"><h2>Upcoming games</h2><ul class="games">${up.map(row).join("")}</ul></section>` : `<section class="panel"><h2>No games yet</h2><p>Predictions appear here before puck drop.</p></section>`}
  ${done.length ? `<section class="panel"><h2>Recent results</h2><ul class="games">${done.slice(0, 30).map(row).join("")}</ul></section>` : ""}
  ${backtest(bt)}<p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;
  return page({ title: "NHL Predictions | ProbaLab", description: "NHL win predictions for every game.", path: "/nhl", body });
}
function game(g, gs) {
  const bar = (lab, p, on) => `<div style="flex:1;text-align:center;padding:12px;border-radius:10px;${on ? "outline:2px solid currentColor;" : "opacity:.8;"}"><div style="font-size:13px">${esc(lab)}</div><div style="font-size:28px;font-weight:700">${pct(p)}</div></div>`;
  const res = g.graded ? `<section class="panel"><h2>Result</h2><p>Final: ${esc(nm(g.away))} <b>${g.away_score}</b> – <b>${g.home_score}</b> ${esc(nm(g.home))}. The pick (${esc(pickName(g))}) was ${g.correct ? `<b class="pos">right ✓</b>` : `<b class="neg">wrong ✕</b>`}.</p></section>`
    : g.status === "post" || g.flag ? `<section class="panel"><h2>Result</h2><p>The result is being checked against two score sources before it's marked.</p></section>` : "";
  const body = `<a class="back" href="/nhl">← Back to NHL predictions</a>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/nhl">NHL</a> › <span>${esc(nm(g.away))} @ ${esc(nm(g.home))}</span></nav>
  <p class="eyebrow">// NHL</p><h1>${esc(nm(g.away))} vs ${esc(nm(g.home))} prediction</h1>
  <p class="when">Puck drop <time data-local datetime="${esc(g.start_utc)}">${esc(whenAU(g.start_utc))}</time></p>
  <section class="panel"><h2>The model's chances</h2><div style="display:flex;gap:8px">${bar(`${nm(g.away)} win`, g.p_away, g.pick === "away")}${bar(`${nm(g.home)} win`, g.p_home, g.pick === "home")}</div>
  <p>Pick: <b>${esc(pickName(g))}</b> at ${pct(pickP(g))} ${chip(g.light)} – ${esc(LIGHT[g.light]?.[1] ?? "")}.</p></section>
  ${res}${lights}<p><b>Live record:</b> ${record(gs)}</p>
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;
  return page({ title: `${nm(g.away)} vs ${nm(g.home)} Prediction | NHL | ProbaLab`, description: `${nm(g.away)} vs ${nm(g.home)}: win chances from ProbaLab's model.`, path: pathOf(g), body });
}
export async function onRequestGet(ctx) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean), d = await load(ctx);
  if (!parts.length) return hub(d);
  const id = (String(parts[0]).match(/-(\d+)$/) ?? [])[1], g = parts.length === 1 && d.gs.find((x) => x.game_id === id);
  if (!g) return page({ title: "Page not found | ProbaLab", description: "Not found", path: "/nhl", status: 404, body: `<h1>Page not found</h1><section class="panel"><p><a href="/nhl">NHL predictions</a></p></section>` });
  return game(g, d.gs);
}
