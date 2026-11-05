// /teams: every NBA, NFL, NHL and EPL team with its logo, linking to its team page.
import { getFeed, gamesOf, shell, html, esc, NBA_TEAMS } from "./_shared/site.js";
import { listTeams, teamPath, teamLogoHtml, nhlDataFromFiles, eplDataFromFiles, NHL_TEAMS } from "./_shared/teams.js";

const asset = (ctx, p, d) => ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)).then((r) => (r.ok ? r.json() : d)).catch(() => d);
const SPORTS = [["nba", "NBA"], ["nfl", "NFL"], ["nhl", "NHL"], ["epl", "Premier League"]];

async function teamsFor(ctx, sport) {
  try {
    if (sport === "nba" || sport === "nfl") return listTeams(sport, gamesOf(sport, await getFeed(ctx, sport)));
    if (sport === "nhl") {
      const [raw, pretip, season, grades] = await Promise.all([
        asset(ctx, "/data/nhl-picks.json", []), asset(ctx, "/data/nhl-pretip.json", {}),
        asset(ctx, "/data/nhl-season.json", { games: [] }), asset(ctx, "/data/nhl-grades.json", {})]);
      return listTeams("nhl", nhlDataFromFiles(raw, pretip, season, grades));
    }
    const [raw, grades, season] = await Promise.all([
      asset(ctx, "/data/epl-picks.json", []), asset(ctx, "/data/epl-grades.json", {}), asset(ctx, "/data/epl-season.json", { games: [] })]);
    return listTeams("epl", eplDataFromFiles(raw, grades, season));
  } catch (e) {
    if (sport === "nba") return Object.entries(NBA_TEAMS).map(([abbr, name]) => ({ abbr, name }));
    if (sport === "nhl") return Object.entries(NHL_TEAMS).map(([abbr, name]) => ({ abbr, name }));
    return [];
  }
}

export async function onRequestGet(ctx) {
  const lists = await Promise.all(SPORTS.map(([s]) => teamsFor(ctx, s)));
  const sections = SPORTS.map(([s, S], i) => {
    const teams = [...lists[i]].sort((a, b) => a.name.localeCompare(b.name));
    return `<section class="panel" id="${s}"><h2>${esc(S)} <small><a href="/${s}/team">${teams.length} teams →</a></small></h2>
  <ul class="team-index">${teams.map((t) => `<li><a href="${esc(teamPath(s, t.name))}">${teamLogoHtml(s, t, "team-logo-sm")}<span class="nm">${esc(t.name)}</span><span class="rec"></span></a></li>`).join("")}</ul></section>`;
  }).join("\n");
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Teams</span></nav>
  <p class="eyebrow">// all sports · teams</p>
  <h1>Teams</h1>
  <p>Pick a team for its season results, recent form, stats, injuries and ProbaLab's predictions.</p>
  <p class="links">${SPORTS.map(([s, S]) => `<a href="#${s}">${esc(S)}</a>`).join(" · ")}</p>
  ${sections}`;
  return html(shell({ title: "Teams: NBA, NFL, NHL and Premier League | ProbaLab", description: "Every NBA, NFL, NHL and Premier League team with season results, form and ProbaLab predictions.", path: "/teams", body }));
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
