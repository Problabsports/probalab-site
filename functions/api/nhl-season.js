// /api/nhl-season : this season's finished NHL regular-season games from the official NHL API (club schedules,
// de-duplicated). Edge-cached 30 min. Used by the NHL Trends tab. Results only, no other data.
const TEAMS = ["ANA","BOS","BUF","CGY","CAR","CHI","COL","CBJ","DAL","DET","EDM","FLA","LAK","MIN","MTL","NSH","NJD","NYI","NYR","OTT","PHI","PIT","SJS","SEA","STL","TBL","TOR","UTA","VAN","VGK","WSH","WPG"];
export async function onRequestGet(ctx) {
  const now = new Date(), y = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1, season = `${y}${y + 1}`;
  const cache = caches.default, key = new Request(new URL(`/api/nhl-season?s=${season}`, ctx.request.url).toString());
  const hit = await cache.match(key); if (hit) return hit;
  const lists = await Promise.all(TEAMS.map((t) => fetch(`https://api-web.nhle.com/v1/club-schedule-season/${t}/${season}`).then((r) => (r.ok ? r.json() : { games: [] })).catch(() => ({ games: [] }))));
  const byId = new Map();
  for (const l of lists) for (const g of l.games ?? []) {
    if (g.gameType !== 2 || !["FINAL", "OFF"].includes(g.gameState)) continue;
    byId.set(g.id, { id: g.id, start_utc: g.startTimeUTC, home: g.homeTeam.abbrev, away: g.awayTeam.abbrev, hs: g.homeTeam.score, as: g.awayTeam.score, last: g.gameOutcome?.lastPeriodType ?? "REG" });
  }
  const games = [...byId.values()].sort((a, b) => a.start_utc.localeCompare(b.start_utc));
  const res = new Response(JSON.stringify({ season, updated_utc: now.toISOString(), games }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=1800" } });
  ctx.waitUntil(cache.put(key, res.clone())); return res;
}
