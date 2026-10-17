// Cloudflare Pages Function: /api/feed
// Serves the ProbaLab prediction feed through Cloudflare's edge cache, so Supabase gets at most
// one request per cache window no matter how many people have the site open.
const FEED = "https://zwdpsereqicvzbtfrrnd.supabase.co/functions/v1/probalab-feed";
const TTL = 90; // seconds

export async function onRequestGet(ctx) {
  const cache = caches.default;
  const key = new Request(new URL("/api/feed", ctx.request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  const up = await fetch(FEED, { headers: { accept: "application/json" } });
  if (!up.ok) return new Response(JSON.stringify({ error: "feed unavailable" }), { status: 502, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const body = await up.text();
  const res = new Response(body, { headers: { "content-type": "application/json", "cache-control": `public, max-age=${TTL}` } });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
