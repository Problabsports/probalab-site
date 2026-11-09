// HIDDEN EPL/NHL sections. Serves the live app shell (index.html) with noindex + a sport script, so the pages
// look exactly like the live NBA/NFL views. Not linked anywhere, not in the sitemap. Preview only.
export async function serveHidden(ctx, sport) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  const rest = parts[0] === "app" ? parts.slice(1) : parts;
  const id = rest.length ? (String(rest[0]).match(/-(\d+)$/) ?? [])[1] : null;
  if (rest.length) return Response.redirect(new URL(id ? `/${sport}/app#game-${id}` : `/${sport}`, ctx.request.url).toString(), 302);
  const r = await ctx.env.ASSETS.fetch(new URL("/", ctx.request.url));
  let h = await r.text();
  // NHL live (23 Oct). EPL live with percentages only (24 Oct). Championship live (7 Nov). Tennis live (7 Nov, own script tennis.js).
  const META = {
    nhl: ["NHL Predictions Today: Win Probabilities for Every Game | ProbaLab", "NHL predictions for every game: a win chance for each team, posted before puck drop, with every result on the record."],
    epl: ["Premier League Predictions: Home, Draw and Away Chances | ProbaLab", "Premier League predictions for every match: home win, draw and away win chances, posted before kick-off, with every result on the record."],
    championship: ["Championship Predictions: Home, Draw and Away Chances | ProbaLab", "EFL Championship predictions for every match: home win, draw and away win chances, posted before kick-off, with every result on the record."],
    tennis: ["Tennis Predictions Today: ATP and WTA Win Chances | ProbaLab", "Tennis predictions for every ATP and WTA main-draw match: a win chance for each player, posted before the first serve, with every result on the record."],
  };
  const live = !!META[sport];
  if (live) {
    const [title, desc] = META[sport];
    h = h.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="https://probalabsports.com/${sport}">`)
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${desc}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`)
      .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${desc}">`)
      .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="https://probalabsports.com/${sport}">`)
      .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title}">`)
      .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${desc}">`);
  } else h = h.replace(/<link rel="canonical"[^>]*>/, "").replace("<head>", '<head>\n<meta name="robots" content="noindex, nofollow">');
  // version the sport script by its ETag, so every deploy is picked up straight away (no stale browser copy)
  const src = sport === "tennis" ? "/tennis.js" : "/hidden-sports.js";
  const js = await ctx.env.ASSETS.fetch(new URL(src, ctx.request.url), { method: "HEAD" }).catch(() => null);
  const ver = encodeURIComponent((js?.headers.get("etag") ?? "1").replace(/\W/g, "").slice(0, 12));
  h = h.replace(/<\/body>/, `<script>window.HIDDEN_SPORT=${JSON.stringify(sport)};</script>\n<script src="${src}?v=${ver}"></script>\n</body>`);
  return new Response(h, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache, must-revalidate", ...(live ? {} : { "x-robots-tag": "noindex, nofollow" }) } });
}
