// HIDDEN EPL section (not linked, not in sitemap, noindex + X-Robots-Tag). Preview only until John OKs launch.
// Picks: /data/epl-picks.json (filled from the EPL model feed). League table: ESPN standings (edge-cached).
import { shell, esc, slug } from "../_shared/site.js";
const STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings";
const pct = (p) => `${Math.round(Number(p) * 100)}%`;
const fmt = (iso, o) => new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", ...o }).format(new Date(iso));
const whenAU = (iso) => fmt(iso, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });
const LIGHT = { GREEN: ["Green", "the model rates this pick as likely"], ORANGE: ["Orange", "a lean"], RED: ["Red", "close to an open game"] };
const chip = (l) => (l ? `<span class="chip ${esc(l)}">${esc((LIGHT[l] ?? [l])[0])}</span>` : "");
const pickName = (g) => (g.pick === "home" ? g.home : g.pick === "away" ? g.away : g.pick === "draw" ? "Draw" : "");
const pickP = (g) => (g.pick === "home" ? g.p_home : g.pick === "away" ? g.p_away : g.p_draw);
const pathOf = (g) => `/epl/${slug(g.home)}-vs-${slug(g.away)}-prediction-${g.game_id}`;
const out = (s, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120", "x-robots-tag": "noindex, nofollow" } });
const page = (o) => out(shell({ ...o, noindex: true, signup: false }), o.status);

// Claude feed shape: top-level array; result/score blank until graded. Light from the pick's own chance (EPL: GREEN >=60%, ORANGE 50-60%, RED <50%).
const lightOf = (p) => (p == null ? null : p >= 0.6 ? "GREEN" : p >= 0.5 ? "ORANGE" : "RED");
// graded/correct are set only by our two-source check (ESPN + second source); the feed's own result is never treated as final.
function norm(g) { const x = { ...g, start_utc: g.start_utc ?? g.kickoff_utc, game_id: String(g.game_id ?? g.id) }; const pp = pickP(x); x.light = lightOf(pp == null ? null : Number(pp)); x.graded = g.graded === true; return x; }
async function picks(ctx) {
  try { const r = await ctx.env.ASSETS.fetch(new URL("/data/epl-picks.json", ctx.request.url)); const j = await r.json(); return (Array.isArray(j) ? j : j.games ?? []).map(norm); } catch { return []; }
}
async function table(ctx) {
  try {
    const cache = caches.default, key = new Request(STANDINGS);
    let r = await cache.match(key);
    if (!r) { const up = await fetch(STANDINGS); if (!up.ok) return null; r = new Response(await up.text(), { headers: { "cache-control": "public, max-age=900" } }); ctx.waitUntil(cache.put(key, r.clone())); }
    const j = await r.json(), es = j.children?.[0]?.standings?.entries ?? [];
    const st = (e, n) => e.stats.find((s) => s.name === n)?.value ?? 0;
    return es.map((e) => ({ team: e.team.displayName, p: st(e, "gamesPlayed"), w: st(e, "wins"), d: st(e, "ties"), l: st(e, "losses"), gd: st(e, "pointDifferential"), pts: st(e, "points"), rank: st(e, "rank") })).sort((a, b) => a.rank - b.rank);
  } catch { return null; }
}
const tableHtml = (t) => !t ? `<section class="panel"><h2>League table</h2><p>The table couldn't be loaded just now.</p></section>`
  : `<section class="panel"><h2>League table</h2><div style="overflow-x:auto"><table class="tbl" style="width:100%;border-collapse:collapse;font-size:14px">
  <thead><tr><th align="left">#</th><th align="left">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>
  ${t.map((r) => `<tr><td>${r.rank}</td><td>${esc(r.team)}</td><td align="center">${r.p}</td><td align="center">${r.w}</td><td align="center">${r.d}</td><td align="center">${r.l}</td><td align="center">${r.gd > 0 ? "+" : ""}${r.gd}</td><td align="center"><b>${r.pts}</b></td></tr>`).join("")}
  </tbody></table></div></section>`;
function record(gs) {
  const g = gs.filter((x) => x.graded && x.correct != null), c = g.filter((x) => x.correct).length;
  const gr = g.filter((x) => x.light === "GREEN"), gc = gr.filter((x) => x.correct).length;
  return g.length ? `All picks ${c} of ${g.length} correct (${pct(c / g.length)})${gr.length ? `; green picks ${gc} of ${gr.length} (${pct(gc / gr.length)})` : ""}.` : "No graded results yet. Every pick stays on the record, right or wrong.";
}
const row = (g) => `<li><a href="${esc(pathOf(g))}"><span class="d">${esc(fmt(g.start_utc, { weekday: "short", day: "numeric", month: "short" }))}</span><span class="m">${esc(g.home)} v ${esc(g.away)}</span>
  <span class="p">${g.pick ? `${esc(pickName(g))} ${pct(pickP(g))}` : "soon"}</span>${chip(g.light)}${g.graded ? `<span class="r ${g.correct ? "pos" : "neg"}">${g.correct ? "✓" : "✕"} ${g.home_score}–${g.away_score}</span>` : g.flag ? `<span class="r">result being checked</span>` : ""}</a></li>`;
const lights = `<p>Lights: <b>green</b> means the model rates this pick as likely, <b>orange</b> is a lean and <b>red</b> is close to an open game. Every match shows all three chances: home win, draw and away win.</p>`;

function hub(gs, t) {
  const up = gs.filter((g) => g.status !== "post").sort((a, b) => a.start_utc.localeCompare(b.start_utc));
  const done = gs.filter((g) => g.status === "post").sort((a, b) => b.start_utc.localeCompare(a.start_utc));
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Premier League predictions</span></nav>
  <p class="eyebrow">// Premier League · match predictions · 2026–27 season</p>
  <h1>Premier League predictions</h1>
  <p>Every Premier League match gets three chances from the model: home win, draw and away win. Results are only marked once two independent score sources agree.</p>
  ${lights}<p><b>Record:</b> ${record(gs)}</p>
  ${up.length ? `<section class="panel"><h2>Upcoming matches</h2><ul class="games">${up.map(row).join("")}</ul></section>`
    : `<section class="panel"><h2>No games yet</h2><p>Predictions for the next round will appear here before kick-off.</p></section>`}
  ${done.length ? `<section class="panel"><h2>Recent results</h2><ul class="games">${done.slice(0, 30).map(row).join("")}</ul></section>` : ""}
  ${tableHtml(t)}
  <p class="note">Probabilities come from ProbaLab's own model. They are not advice.</p>`;
  return page({ title: "Premier League Predictions | ProbaLab", description: "Premier League match predictions: home, draw and away chances for every match.", path: "/epl", body });
}
function game(g, gs, t) {
  const bar = (lab, p, on) => `<div style="flex:1;text-align:center;padding:12px;border-radius:10px;${on ? "outline:2px solid currentColor;" : "opacity:.8;"}"><div style="font-size:13px">${esc(lab)}</div><div style="font-size:28px;font-weight:700">${p == null ? "–" : pct(p)}</div></div>`;
  const res = g.status === "post" ? `<section class="panel"><h2>Result</h2>${g.graded ? `<p>Final: ${esc(g.home)} <b>${g.home_score}</b> – <b>${g.away_score}</b> ${esc(g.away)}. The pick (${esc(pickName(g))}) was ${g.correct ? `<b class="pos">correct ✓</b>` : `<b class="neg">wrong ✕</b>`}.</p>` : `<p>The result is being checked against two score sources before it's marked.</p>`}</section>` : "";
  const body = `<a class="back" href="/epl">← Back to Premier League predictions</a>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/epl">Premier League</a> › <span>${esc(g.home)} v ${esc(g.away)}</span></nav>
  <p class="eyebrow">// Premier League${g.round ? ` · Round ${esc(g.round)}` : ""}</p>
  <h1>${esc(g.home)} vs ${esc(g.away)} prediction</h1>
  <p class="when">Kick-off <time data-local datetime="${esc(g.start_utc)}">${esc(whenAU(g.start_utc))}</time></p>
  <section class="panel"><h2>The model's chances</h2><div style="display:flex;gap:8px">${bar(`${g.home} win`, g.p_home, g.pick === "home")}${bar("Draw", g.p_draw, g.pick === "draw")}${bar(`${g.away} win`, g.p_away, g.pick === "away")}</div>
  ${g.pick ? `<p>Pick: <b>${esc(pickName(g))}</b> at ${pct(pickP(g))} ${chip(g.light)}${g.light ? ` – ${esc(LIGHT[g.light]?.[1] ?? "")}` : ""}.</p>` : "<p>The prediction is posted before kick-off.</p>"}</section>
  ${res}${lights}<p><b>Record:</b> ${record(gs)}</p>${tableHtml(t)}
  <p class="note">Probabilities come from ProbaLab's own model. They are not advice.</p>`;
  return page({ title: `${g.home} vs ${g.away} Prediction | Premier League | ProbaLab`, description: `${g.home} vs ${g.away}: home, draw and away chances from ProbaLab's model.`, path: pathOf(g), body });
}
export async function onRequestGet(ctx) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  const [gs, t] = await Promise.all([picks(ctx), table(ctx)]);
  if (!parts.length) return hub(gs, t);
  const id = (String(parts[0]).match(/-(\d+)$/) ?? [])[1];
  const g = parts.length === 1 && gs.find((x) => String(x.game_id) === id);
  if (!g) return page({ title: "Page not found | ProbaLab", description: "Not found", path: "/epl", status: 404, body: `<h1>Page not found</h1><section class="panel"><p><a href="/epl">Premier League predictions</a></p></section>` });
  return game(g, gs, t);
}
