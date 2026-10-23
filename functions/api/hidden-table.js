// /api/hidden-table?sport=epl|nhl : compact ESPN standings for the hidden EPL/NHL pages (edge-cached 15 min).
const SRC = { epl: "https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings", nhl: "https://site.api.espn.com/apis/v2/sports/hockey/nhl/standings" };
export async function onRequestGet(ctx) {
  const sport = new URL(ctx.request.url).searchParams.get("sport");
  if (!SRC[sport]) return new Response("[]", { status: 400 });
  const cache = caches.default, key = new Request(new URL(`/api/hidden-table?sport=${sport}`, ctx.request.url).toString());
  const hit = await cache.match(key); if (hit) return hit;
  const up = await fetch(SRC[sport]); if (!up.ok) return new Response("[]", { status: 502 });
  const j = await up.json();
  const entries = []; const walk = (n) => { if (n?.standings?.entries) entries.push(...n.standings.entries); (n?.children ?? []).forEach(walk); }; walk(j);
  const st = (e, n) => e.stats.find((s) => s.name === n)?.value ?? 0;
  const rows = entries.map((e) => ({ team: e.team.displayName, abbr: e.team.abbreviation, gp: st(e, "gamesPlayed"), w: st(e, "wins"), d: st(e, "ties"), l: st(e, "losses"), otl: st(e, "otLosses"), gd: st(e, "pointDifferential"), pts: st(e, "points") }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd);
  const res = new Response(JSON.stringify(rows), { headers: { "content-type": "application/json", "cache-control": "public, max-age=900", "x-robots-tag": "noindex" } });
  ctx.waitUntil(cache.put(key, res.clone())); return res;
}
