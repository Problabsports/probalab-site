// HIDDEN EPL/NHL sections. Serves the live app shell (index.html) with noindex + a sport script, so the pages
// look exactly like the live NBA/NFL views. Not linked anywhere, not in the sitemap. Preview only.
export async function serveHidden(ctx, sport) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean), id = parts.length ? (String(parts[0]).match(/-(\d+)$/) ?? [])[1] : null;
  if (parts.length) return Response.redirect(new URL(id ? `/${sport}#game-${id}` : `/${sport}`, ctx.request.url).toString(), 302);
  const r = await ctx.env.ASSETS.fetch(new URL("/", ctx.request.url));
  let h = await r.text();
  const live = sport === "nhl"; // NHL is live (John, 23 Oct). EPL stays hidden.
  if (live) h = h.replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical" href="https://probalabsports.com/nhl">')
    .replace(/<title>[^<]*<\/title>/, "<title>NHL Predictions Today: Win Probabilities for Every Game | ProbaLab</title>")
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="NHL predictions for every game: a win chance for each team, posted before puck drop, with every result on the record.">');
  else h = h.replace(/<link rel="canonical"[^>]*>/, "").replace("<head>", '<head>\n<meta name="robots" content="noindex, nofollow">');
  h = h.replace(/<\/body>/, `<script>window.HIDDEN_SPORT=${JSON.stringify(sport)};</script>\n<script src="/hidden-sports.js"></script>\n</body>`);
  return new Response(h, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60", ...(live ? {} : { "x-robots-tag": "noindex, nofollow" }) } });
}
