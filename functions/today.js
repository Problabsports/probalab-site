// /today: one page with every sport's games for the next day with games, NBA first, then NFL, NHL and EPL.
// NBA/NFL from the live feed (same as /nba/today); NHL/EPL from the same /data files the /nhl and /epl pages use.
import { getFeed, gamesOf, gameRow, shell, html, esc, chip } from "./_shared/site.js";
const NHLN = { ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres", CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks", COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars", DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers", LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montréal Canadiens", NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders", NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers", PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken", STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs", UTA: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights", WSH: "Washington Capitals", WPG: "Winnipeg Jets" };
const pct = (p) => `${Math.round(p * 100)}%`;
const dKey = (iso, tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const dLabel = (iso, tz) => new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
const tLabel = (iso, tz) => new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).replace(" ", "").toLowerCase();
const asset = (ctx, p, d) => ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)).then((r) => (r.ok ? r.json() : d)).catch(() => d);
// next day (local to the league) that still has unplayed games
function nextDay(games, tz) {
  const now = Date.now();
  const up = games.filter((g) => !g.done && new Date(g.start_utc).getTime() > now - 4 * 3600e3).sort((a, b) => a.start_utc.localeCompare(b.start_utc));
  if (!up.length) return null;
  const k = dKey(up[0].start_utc, tz);
  return { label: dLabel(up[0].start_utc, tz), games: up.filter((g) => dKey(g.start_utc, tz) === k) };
}
const row = (href, when, match, pick, light) => `<li><a href="${esc(href)}"><span class="d">${esc(when)}</span><span class="m">${esc(match)}</span><span class="p">${esc(pick)}</span>${chip(light)}</a></li>`;
const rec = (w, l) => (w + l ? `${w}–${l}` : null);
function section(id, name, day, rows, links, recStr) {
  return `<section class="panel" id="${id}"><h2>${esc(name)}${day ? ` · ${esc(day.label)}` : ""}</h2>
  ${day ? `<ul class="games">${rows}</ul>` : `<p>No upcoming ${esc(name)} games on the schedule yet.</p>`}
  <p class="small">${recStr ? `Season record: <b>${recStr}</b> · ` : ""}${links}</p></section>`;
}
export async function onRequestGet(ctx) {
  const out = [];
  // NBA + NFL (live feed)
  for (const [sport, S] of [["nba", "NBA"], ["nfl", "NFL"]]) {
    let data = null; try { data = gamesOf(sport, await getFeed(ctx, sport)); } catch (e) {}
    if (!data) { out.push(`<section class="panel" id="${sport}"><h2>${S}</h2><p>We couldn't load ${S} games just now. Please refresh in a minute.</p></section>`); continue; }
    const gs = data.games.map((g) => ({ ...g, done: g.status === "post" }));
    const day = nextDay(gs, "America/New_York");
    const settled = data.games.filter((g) => g.pick && g.status === "post" && g.won != null), w = settled.filter((g) => g.won).length;
    out.push(section(sport, S, day && { label: `${day.label} (US Eastern)` }, day ? day.games.map(gameRow).join("") : "",
      `<a href="/${sport}/today">All ${S} games this week →</a> · <a href="/${sport}/record">${S} record →</a>`, sport === "nba" ? rec(w, settled.length - w) : null));
  }
  // NHL (same grading as /nhl: pre-puck-drop snapshot in /data/nhl-pretip.json)
  {
    const [raw, snap] = await Promise.all([asset(ctx, "/data/nhl-picks.json", []), asset(ctx, "/data/nhl-pretip.json", {})]);
    const SN = snap?.games ?? {};
    const gs = (Array.isArray(raw) ? raw : raw.games ?? []).map((g) => {
      const id = String(g.game_id ?? g.id), pc = (v) => (v == null ? null : Number(v) > 1 ? Number(v) / 100 : Number(v));
      const ph = pc(g.p_home ?? g.home_pct), pa = pc(g.p_away ?? g.away_pct), sn = SN[id];
      const pickHome = sn ? sn.pick === g.home : g.pick === "home";
      const p = sn ? Number(sn.pick_p) : pickHome ? ph : pa;
      const start = g.start_utc ?? g.puck_drop_utc ?? g.date;
      return { id, start_utc: start, home: g.home, away: g.away, p, pickName: NHLN[pickHome ? g.home : g.away] ?? (pickHome ? g.home : g.away),
        light: sn?.light ?? (p >= 0.65 ? "GREEN" : p >= 0.55 ? "ORANGE" : "RED"), won: sn && typeof sn.won === "boolean" ? sn.won : null,
        done: (sn && typeof sn.won === "boolean") || g.status === "post" || new Date(start).getTime() < Date.now() - 3 * 3600e3 };
    });
    const day = nextDay(gs, "America/New_York"), gr = gs.filter((g) => g.won != null), w = gr.filter((g) => g.won).length;
    out.push(section("nhl", "NHL", day && { label: `${day.label} (US Eastern)` },
      day ? day.games.map((g) => row(`/nhl#game-${g.id}`, tLabel(g.start_utc, "America/New_York") + " ET", `${NHLN[g.away] ?? g.away} @ ${NHLN[g.home] ?? g.home}`, `${g.pickName} ${pct(g.p)}`, g.light)).join("") : "",
      `<a href="/nhl">All NHL games →</a>`, null));
  }
  // EPL (same files as /epl)
  {
    const [raw, grades] = await Promise.all([asset(ctx, "/data/epl-picks.json", []), asset(ctx, "/data/epl-grades.json", {})]);
    const LF = "2026-10-23T23:42:00Z";
    const gs = (Array.isArray(raw) ? raw : raw.games ?? []).map((g) => {
      const id = String(g.game_id ?? g.id), ps = { home: Number(g.p_home), draw: Number(g.p_draw), away: Number(g.p_away) }, p = ps[g.pick];
      const gr = grades[id], start = g.start_utc ?? g.kickoff_utc;
      return { id, start_utc: start, home: g.home, away: g.away, p, pickName: g.pick === "home" ? g.home : g.pick === "away" ? g.away : "Draw",
        light: start >= LF ? (p >= 0.55 ? "GREEN" : p >= 0.45 ? "ORANGE" : "RED") : null, won: gr?.graded ? !!gr.correct : null,
        done: !!gr?.graded || g.status === "post" || new Date(start).getTime() < Date.now() - 3 * 3600e3 };
    });
    const day = nextDay(gs, "Europe/London"), gr = gs.filter((g) => g.won != null), w = gr.filter((g) => g.won).length;
    out.push(section("epl", "Premier League", day && { label: `${day.label} (UK time)` },
      day ? day.games.map((g) => row(`/epl#game-${g.id}`, tLabel(g.start_utc, "Europe/London") + " UK", `${g.home} v ${g.away}`, `${g.pickName} ${pct(g.p)}`, g.light)).join("") : "",
      `<a href="/epl">All Premier League matches →</a>`, null));
  }
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Today's games</span></nav>
  <p class="eyebrow">// all sports · next game day</p>
  <h1>Today's games</h1>
  <p>Every game on the next day of play in each sport, with the model's predicted winner and its win chance. NBA first, then NFL, NHL and the Premier League.</p>
  <nav class="crumbs" aria-label="Jump to sport"><a href="#nba">NBA</a> · <a href="#nfl">NFL</a> · <a href="#nhl">NHL</a> · <a href="#epl">Premier League</a></nav>
  ${out.join("\n")}
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;
  return html(shell({ title: "Today's Games: NBA, NFL, NHL and Premier League Predictions | ProbaLab", description: "Win chances for every NBA, NFL, NHL and Premier League game on the next day of play, from ProbaLab's model.", path: "/today", body }), 200, 60);
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
