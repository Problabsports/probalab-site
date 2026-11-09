// /sitemap.xml: home, hubs, legal pages, team indexes/pages, and every current-season game page that has a pick.
import { getFeed, gamesOf, ORIGIN, esc, NBA_TEAMS } from "./_shared/site.js";
import { listTeams, teamPath, nhlDataFromFiles, eplDataFromFiles } from "./_shared/teams.js";

const asset = (ctx, p, d) => ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)).then((r) => (r.ok ? r.json() : d)).catch(() => d);

export async function onRequestGet(ctx) {
  const urls = [
    { loc: "/", pri: "1.0", freq: "hourly" }, { loc: "/today", pri: "0.95", freq: "hourly" }, { loc: "/teams", pri: "0.8", freq: "daily" }, { loc: "/injuries", pri: "0.7", freq: "hourly" }, { loc: "/tools", pri: "0.5", freq: "monthly" }, { loc: "/accuracy", pri: "0.8", freq: "daily" }, { loc: "/results", pri: "0.8", freq: "daily" }, { loc: "/lights", pri: "0.6", freq: "monthly" }, { loc: "/faq", pri: "0.5", freq: "monthly" },
    { loc: "/nba", pri: "0.9", freq: "hourly" }, { loc: "/nba/today", pri: "0.9", freq: "hourly" }, { loc: "/nba/team", pri: "0.75", freq: "daily" },
    { loc: "/nfl", pri: "0.9", freq: "hourly" }, { loc: "/nfl/today", pri: "0.9", freq: "hourly" }, { loc: "/nfl/team", pri: "0.75", freq: "daily" },
    { loc: "/nhl", pri: "0.9", freq: "hourly" }, { loc: "/nhl/team", pri: "0.75", freq: "daily" },
    { loc: "/epl", pri: "0.9", freq: "hourly" }, { loc: "/epl/team", pri: "0.75", freq: "daily" },
    { loc: "/championship", pri: "0.85", freq: "hourly" },
    { loc: "/tennis", pri: "0.85", freq: "hourly" },
    { loc: "/privacy", pri: "0.2", freq: "yearly" }, { loc: "/terms", pri: "0.2", freq: "yearly" }, { loc: "/contact", pri: "0.2", freq: "yearly" },
  ];
  for (const sport of ["nba", "nfl"]) {
    try {
      const d = gamesOf(sport, await getFeed(ctx, sport));
      for (const g of d.games) if (g.pick) urls.push({ loc: g.path, mod: g.last_updated ?? g.first_posted, pri: g.status === "post" ? "0.5" : "0.8", freq: g.status === "post" ? "monthly" : "hourly" });
      for (const t of listTeams(sport, d)) urls.push({ loc: teamPath(sport, t.name), pri: "0.65", freq: "daily" });
    } catch (e) { /* skip a sport whose feed is down */ }
  }
  try {
    const [raw, pretip, season, grades] = await Promise.all([
      asset(ctx, "/data/nhl-picks.json", []), asset(ctx, "/data/nhl-pretip.json", {}),
      asset(ctx, "/data/nhl-season.json", { games: [] }), asset(ctx, "/data/nhl-grades.json", {}),
    ]);
    const d = nhlDataFromFiles(raw, pretip, season, grades);
    for (const t of listTeams("nhl", d)) urls.push({ loc: teamPath("nhl", t.name), pri: "0.65", freq: "daily" });
  } catch (e) {}
  try {
    const [raw, grades, season] = await Promise.all([
      asset(ctx, "/data/epl-picks.json", []), asset(ctx, "/data/epl-grades.json", {}),
      asset(ctx, "/data/epl-season.json", { games: [] }),
    ]);
    const d = eplDataFromFiles(raw, grades, season);
    for (const t of listTeams("epl", d)) urls.push({ loc: teamPath("epl", t.name), pri: "0.65", freq: "daily" });
  } catch (e) {}
  // Ensure NBA teams are listed even if feed fails (static map)
  if (!urls.some((u) => u.loc.startsWith("/nba/team/"))) {
    for (const name of Object.values(NBA_TEAMS)) urls.push({ loc: teamPath("nba", name), pri: "0.65", freq: "daily" });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) =>
    `  <url><loc>${esc(ORIGIN + u.loc)}</loc>${u.mod ? `<lastmod>${esc(new Date(u.mod).toISOString())}</lastmod>` : ""}<changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
