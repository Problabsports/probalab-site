// Cloudflare Pages Function: /api/feed[?sport=nba|nfl]
// Serves the ProbaLab prediction feeds through Cloudflare's edge cache (90s), so Supabase gets at most
// one request per sport per cache window no matter how many people have the site open.
// The browser (index.html, members pages) reads feeds only from here; never from Supabase directly.
import { cachedFeedText, FEED_SPORTS } from "../_shared/site.js";

const TTL = 90; // seconds; same as the edge copy in cachedFeedText

const json = (body, status, cacheControl) => new Response(body, {
  status,
  headers: { "content-type": "application/json", "cache-control": cacheControl },
});

export async function onRequestGet(ctx) {
  const sport = (new URL(ctx.request.url).searchParams.get("sport") || "nba").toLowerCase();
  if (!FEED_SPORTS.has(sport)) return json(JSON.stringify({ error: "unknown sport" }), 400, "no-store");
  try {
    return json(await cachedFeedText(ctx, sport), 200, `public, max-age=${TTL}`);
  } catch (_) {
    return json(JSON.stringify({ error: "feed unavailable" }), 502, "no-store");
  }
}
