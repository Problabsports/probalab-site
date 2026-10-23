// /sitemap.xml: home, hubs, legal pages and every current-season game page that has a pick.
import { getFeed, gamesOf, ORIGIN, esc } from "./_shared/site.js";
export async function onRequestGet(ctx) {
  const urls = [
    { loc: "/", pri: "1.0", freq: "hourly" }, { loc: "/nba", pri: "0.9", freq: "hourly" }, { loc: "/nfl", pri: "0.9", freq: "hourly" }, { loc: "/nhl", pri: "0.9", freq: "hourly" }, { loc: "/epl", pri: "0.9", freq: "hourly" },
    { loc: "/privacy", pri: "0.2", freq: "yearly" }, { loc: "/terms", pri: "0.2", freq: "yearly" }, { loc: "/contact", pri: "0.2", freq: "yearly" },
  ];
  for (const sport of ["nba", "nfl"]) {
    try {
      const d = gamesOf(sport, await getFeed(ctx, sport));
      for (const g of d.games) if (g.pick) urls.push({ loc: g.path, mod: g.last_updated ?? g.first_posted, pri: g.status === "post" ? "0.5" : "0.8", freq: g.status === "post" ? "monthly" : "hourly" });
    } catch (e) { /* skip a sport whose feed is down */ }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) =>
    `  <url><loc>${esc(ORIGIN + u.loc)}</loc>${u.mod ? `<lastmod>${esc(new Date(u.mod).toISOString())}</lastmod>` : ""}<changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
