// /injuries: injury reports for the next games, by sport. Only real data; sports with no data are hidden.
import { getFeed, gamesOf, shell, html, esc, NBA_TEAMS } from "./_shared/site.js";
import { NHL_TEAMS } from "./_shared/teams.js";
import { getInjuries, gameInjuriesHtml, INJ_CSS } from "./_shared/injuries.js";

const asset = (ctx, p, d) => ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)).then((r) => (r.ok ? r.json() : d)).catch(() => d);
const SPORTS = [["nba", "NBA"], ["nfl", "NFL"], ["nhl", "NHL"], ["epl", "Premier League"]];
const fmt = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

async function upcoming(ctx, sport) {
  const now = Date.now(), until = now + (sport === "nfl" ? 8 : 2) * 86400e3;
  const inWin = (t) => { const x = Date.parse(t); return x > now - 3 * 3600e3 && x < until; };
  try {
    if (sport === "nba" || sport === "nfl") {
      const d = gamesOf(sport, await getFeed(ctx, sport));
      return d.games.filter((g) => g.status !== "post" && inWin(g.start_utc)).sort((a, b) => a.start_utc.localeCompare(b.start_utc))
        .map((g) => ({ t: g.start_utc, A: g.away_name, H: g.home_name, g, href: g.path }));
    }
    if (sport === "nhl") {
      const raw = await asset(ctx, "/data/nhl-picks.json", []);
      return (Array.isArray(raw) ? raw : raw.games || []).filter((g) => g.status !== "post" && inWin(g.date)).sort((a, b) => a.date.localeCompare(b.date))
        .map((g) => ({ t: g.date, A: NHL_TEAMS[g.away] || g.away, H: NHL_TEAMS[g.home] || g.home, g: null, href: null }));
    }
    const raw = await asset(ctx, "/data/epl-picks.json", []);
    return (Array.isArray(raw) ? raw : []).filter((g) => g.status !== "post" && inWin(g.start_utc))
      .map((g) => ({ t: g.start_utc, A: g.away, H: g.home, g: null, href: null }));
  } catch (e) { return []; }
}

export async function onRequestGet(ctx) {
  const parts = await Promise.all(SPORTS.map(async ([s, S]) => {
    const [inj, games] = await Promise.all([getInjuries(ctx, s), upcoming(ctx, s)]);
    if (!inj || !Object.keys(inj.byTeam).length || !games.length) return "";
    const blocks = games.map((x) => {
      const b = gameInjuriesHtml(s, inj, x.g, x.A, x.H);
      if (!b) return "";
      const head = `<p class="eyebrow">${esc(fmt.format(new Date(x.t)))} · ${x.href ? `<a href="${esc(x.href)}">${esc(x.A)} @ ${esc(x.H)}</a>` : `${esc(x.A)} @ ${esc(x.H)}`}</p>`;
      return b.replace('<h2>Injury report</h2>', head);
    }).filter(Boolean);
    if (!blocks.length) return "";
    return `<h2 id="${s}">${esc(S)}</h2>${blocks.join("\n")}`;
  }));
  const shown = SPORTS.filter((_, i) => parts[i]);
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Injuries</span></nav>
  <p class="eyebrow">// injury reports · upcoming games</p>
  <h1>Injury reports</h1>
  <p>Players listed out, doubtful or questionable for the next games, from the official team injury reports. Key players are flagged. Refreshed every 15 minutes.</p>
  ${shown.length ? `<p class="links">${shown.map(([s, S]) => `<a href="#${s}">${esc(S)}</a>`).join(" · ")}</p>` : ""}
  ${parts.join("\n") || `<section class="panel"><p>No injury reports for the next games right now.</p></section>`}
  ${INJ_CSS}`;
  const res = html(shell({ title: "Injury reports: NBA, NFL, NHL | ProbaLab", description: "Who is out, doubtful or questionable for the next NBA, NFL and NHL games, refreshed every 15 minutes.", path: "/injuries", body }));
  return res;
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
