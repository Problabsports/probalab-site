// Cloudflare Pages Function: /api/feed[?sport=nba|nfl]
// Serves the ProbaLab prediction feeds through Cloudflare's edge cache, so Supabase gets at most
// one request per sport per cache window no matter how many people have the site open.
const FEED = "https://zwdpsereqicvzbtfrrnd.supabase.co/functions/v1/probalab-feed";
const TTL = 90; // seconds
const SPORTS = new Set(["nba", "nfl"]);

export async function onRequestGet(ctx) {
  const sport = (new URL(ctx.request.url).searchParams.get("sport") || "nba").toLowerCase();
  if (!SPORTS.has(sport)) return new Response(JSON.stringify({ error: "unknown sport" }), { status: 400, headers: { "content-type": "application/json" } });
  const cache = caches.default;
  const key = new Request(new URL(`/api/feed?sport=${sport}`, ctx.request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  const up = await fetch(`${FEED}?sport=${sport}`, { headers: { accept: "application/json" } });
  if (!up.ok) return new Response(JSON.stringify({ error: "feed unavailable" }), { status: 502, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const body = await up.text();
  const res = new Response(body, { headers: { "content-type": "application/json", "cache-control": `public, max-age=${TTL}` } });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
