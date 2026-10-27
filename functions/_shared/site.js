// Shared server-side rendering for ProbaLab's crawlable pages (game previews, sport hubs, sitemap).
// Data comes from the same public feed as the app (/api/feed), through the same edge cache key.
// Rules: no bookmaker names or prices; no third-party written text (injury statuses are our own labels).

import { venueOf } from "./venues.js";
export const ORIGIN = "https://probalabsports.com";
const FEED = "https://zwdpsereqicvzbtfrrnd.supabase.co/functions/v1/probalab-feed";
const TTL = 90;

export const NBA_TEAMS = { ATL: "Atlanta Hawks", BOS: "Boston Celtics", BKN: "Brooklyn Nets", CHA: "Charlotte Hornets", CHI: "Chicago Bulls", CLE: "Cleveland Cavaliers", DAL: "Dallas Mavericks", DEN: "Denver Nuggets", DET: "Detroit Pistons", GS: "Golden State Warriors", HOU: "Houston Rockets", IND: "Indiana Pacers", LAC: "LA Clippers", LAL: "Los Angeles Lakers", MEM: "Memphis Grizzlies", MIA: "Miami Heat", MIL: "Milwaukee Bucks", MIN: "Minnesota Timberwolves", NO: "New Orleans Pelicans", NY: "New York Knicks", OKC: "Oklahoma City Thunder", ORL: "Orlando Magic", PHI: "Philadelphia 76ers", PHX: "Phoenix Suns", POR: "Portland Trail Blazers", SAC: "Sacramento Kings", SA: "San Antonio Spurs", TOR: "Toronto Raptors", UTAH: "Utah Jazz", WSH: "Washington Wizards" };

// ------------------------------------------------------------------ data
export async function getFeed(ctx, sport) {
  const cache = caches.default;
  const key = new Request(new URL(`/api/feed?sport=${sport}`, ctx.request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return await hit.json();
  const base = ctx.env?.FEED_BASE || FEED;
  const up = await fetch(`${base}?sport=${sport}`, { headers: { accept: "application/json" } });
  if (!up.ok) throw new Error(`feed ${sport} ${up.status}`);
  const body = await up.text();
  ctx.waitUntil(cache.put(key, new Response(body, { headers: { "content-type": "application/json", "cache-control": `public, max-age=${TTL}` } })));
  return JSON.parse(body);
}

// normalised game list for one sport
export function gamesOf(sport, feed) {
  const names = sport === "nfl" ? Object.fromEntries((feed.teams ?? []).map(([a, n]) => [a, n])) : NBA_TEAMS;
  const nm = (c) => names[c] ?? c;
  const games = (feed.games ?? []).filter((g) => g.season === feed.season).map((g) => ({
    ...g, sport, home_name: nm(g.home), away_name: nm(g.away), pick_name: g.pick ? nm(g.pick) : null,
    pick_p: g.pick_p == null ? null : Number(g.pick_p), clv: g.clv == null ? null : Number(g.clv),
    fair_price: undefined, value_price: undefined, // never shown: no odds or prices on the site (John, 21 Oct)
  }));
  games.forEach((g) => (g.path = gamePath(g)));
  return { games, names, season: feed.season, teams: feed.teams ?? [] };
}

// season records from finished games (NFL: regular season only)
export function records(games) {
  const r = {};
  const add = (t, res) => { r[t] ??= { w: 0, l: 0, t: 0 }; r[t][res]++; };
  for (const g of games) {
    if (g.status !== "post" || g.home_score == null) continue;
    if (g.sport === "nfl" && (g.game_type ?? "REG") !== "REG") continue;
    if (g.home_score === g.away_score) { add(g.home, "t"); add(g.away, "t"); }
    else if (g.home_score > g.away_score) { add(g.home, "w"); add(g.away, "l"); }
    else { add(g.away, "w"); add(g.home, "l"); }
  }
  return r;
}
const recStr = (x) => (x ? `${x.w}–${x.l}${x.t ? `–${x.t}` : ""}` : "0–0");

// ------------------------------------------------------------------ urls
export const slug = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const etDate = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
export const gamePath = (g) => `/${g.sport}/${slug(g.away_name)}-vs-${slug(g.home_name)}-prediction-${etDate(g.start_utc)}-${g.game_id}`;
export const idFromSlug = (s) => (String(s).match(/-(\d+)$/) ?? [])[1] ?? null;

// ------------------------------------------------------------------ formatting
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pct = (p) => `${Math.round(p * 100)}%`;
const sgn = (x, d = 1) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(d)}`;
const fmt = (iso, tz, opts) => new Intl.DateTimeFormat("en-AU", { timeZone: tz, ...opts }).format(new Date(iso));
const dayET = (iso) => fmt(iso, "America/New_York", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeET = (iso) => fmt(iso, "America/New_York", { hour: "numeric", minute: "2-digit", hour12: true }).replace(" ", "").toLowerCase();
const whenAU = (iso) => fmt(iso, "Australia/Melbourne", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });
const shortDay = (iso) => fmt(iso, "America/New_York", { weekday: "short", day: "numeric", month: "short" });
const LIGHT = {
  SUPER: ["Super", "our strongest pick"], GREEN: ["Green", "a 65%+ top pick"],
  ORANGE: ["Orange", "a lean (55 to 65%)"], RED: ["Red", "close to a coin flip (under 55%)"],
};
const isTip = (g) => g.light === "SUPER" || g.light === "GREEN";
const poss = (t) => `${esc(t)}${/s$/i.test(t) ? "'" : "'s"}`;
const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const wkLabel = (w) => (w >= 22 ? "Super Bowl" : w === 21 ? "Conference Championships" : w === 20 ? "Divisional Round" : w === 19 ? "Wild Card Round" : `Week ${w}`);

// ------------------------------------------------------------------ written previews (built from our numbers)
function nbaPreview(g, rec) {
  const d = g.detail ?? {}, A = g.away_name, H = g.home_name, P = g.pick_name, pickHome = g.pick === g.home;
  const O = pickHome ? A : H, out = [];
  const lt = LIGHT[g.light] ?? ["", ""];
  out.push(`<p>${esc(P)} are our pick ${pickHome ? `at home against the ${esc(O)}` : `on the road against the ${esc(O)}`}. The model gives them a <b>${pct(g.pick_p)}</b> chance of winning, which makes this game ${esc(lt[1])}.</p>`);
  const ta = d.tal_away == null ? null : Number(d.tal_away), th = d.tal_home == null ? null : Number(d.tal_home);
  if (ta != null && th != null) {
    const tp = pickHome ? th : ta, to = pickHome ? ta : th;
    out.push(Math.abs(tp - to) < 0.75
      ? `<p>On the rosters we expect, the teams rate almost level (${tp.toFixed(1)} to ${to.toFixed(1)} on our team-strength rating), so ${pickHome ? "home court" : "rest and form"} decide${pickHome ? "s" : ""} the pick.</p>`
      : tp >= to
      ? `<p>On the rosters we expect, ${esc(P)} rate as the stronger team (${tp.toFixed(1)} to ${to.toFixed(1)} on our team-strength rating), and that is the main reason for the pick.</p>`
      : `<p>${esc(O)} rate slightly stronger on the rosters we expect (${to.toFixed(1)} to ${tp.toFixed(1)} on our team-strength rating), but ${pickHome ? "home court" : "rest and form"} push the pick to ${esc(P)}.</p>`);
  }
  const fa = d.form_away == null ? null : Number(d.form_away), fh = d.form_home == null ? null : Number(d.form_home);
  if (fa != null && fh != null && (fa !== 0 || fh !== 0)) {
    const f = (t, v) => `${esc(t)} have been ${v >= 0 ? "winning" : "losing"} by ${Math.abs(v).toFixed(1)} points a game`;
    const played = (t) => { const x = rec[t]; return x ? x.w + x.l : 0; };
    out.push(`<p>${played(g.away) + played(g.home) === 0 ? "Form at the end of last season" : "Recent form"}: ${f(A, fa)}, while ${f(H, fh)}.</p>`);
  }
  const ra = Number(d.rest_away ?? 0), rh = Number(d.rest_home ?? 0), restBits = [];
  if (ra === 1) restBits.push(`${esc(A)} are on the second night of a back-to-back`);
  if (rh === 1) restBits.push(`${esc(H)} are on the second night of a back-to-back`);
  if (!restBits.length && ra && rh && Math.abs(ra - rh) >= 2) restBits.push(`${esc(ra > rh ? A : H)} have had ${Math.max(ra, rh)} days' rest to ${Math.min(ra, rh)} for ${esc(ra > rh ? H : A)}`);
  if (restBits.length) out.push(`<p>Schedule: ${list(restBits)}, which the model takes into account.</p>`);
  const inj = (team, arr) => {
    const xs = (arr ?? []).filter((m) => Number(m.min ?? 0) >= 15).sort((a, b) => b.min - a.min);
    const outP = xs.filter((m) => m.status === "Out").map((m) => `${esc(m.player)} (${Math.round(m.min)} min a game)`);
    const unsure = xs.filter((m) => m.status === "Questionable" || m.status === "Doubtful").map((m) => `${esc(m.player)} (${m.status.toLowerCase()})`);
    const bits = [];
    if (outP.length) bits.push(`${esc(team)} will be without ${list(outP)}`);
    if (unsure.length) bits.push(`${list(unsure)} may not play for ${esc(team)}`);
    return bits;
  };
  const injBits = [...inj(A, d.missing_away), ...inj(H, d.missing_home)];
  out.push(injBits.length ? `<p>Injuries: ${list(injBits)}. Players listed as unsure are counted by how likely they are to play.</p>`
    : `<p>Injuries: neither team has a regular player on the injury report at the time of writing.</p>`);
  const rA = rec[g.away], rH = rec[g.home];
  if ((rA && rA.w + rA.l) || (rH && rH.w + rH.l)) out.push(`<p>Season so far: ${esc(A)} are ${recStr(rA)} and ${esc(H)} are ${recStr(rH)}.</p>`);
  return out;
}

function nflPreview(g, rec) {
  const d = g.detail ?? {}, A = g.away_name, H = g.home_name, P = g.pick_name, pickHome = g.pick === g.home;
  const O = pickHome ? A : H, out = [], lt = LIGHT[g.light] ?? ["", ""];
  out.push(`<p>${esc(P)} are our pick ${g.neutral ? `against the ${esc(O)} at a neutral venue` : pickHome ? `at home against the ${esc(O)}` : `on the road against the ${esc(O)}`} in ${wkLabel(g.week)}. The model gives them a <b>${pct(g.pick_p)}</b> chance of winning, which makes this game ${esc(lt[1])}.</p>`);
  const ea = Number(d.elo_away), eh = Number(d.elo_home);
  if (Number.isFinite(ea) && Number.isFinite(eh)) {
    const ep = pickHome ? eh : ea, eo = pickHome ? ea : eh;
    out.push(Math.abs(ep - eo) < 15
      ? `<p>The two teams have almost the same rating (${Math.round(ep)} to ${Math.round(eo)}), so ${pickHome && !g.neutral ? "home field" : "the quarterback situation and rest"} decide${pickHome && !g.neutral ? "s" : ""} the pick.</p>`
      : ep >= eo
      ? `<p>${esc(P)} have the higher team rating (${Math.round(ep)} to ${Math.round(eo)}), built from results and winning margins${g.neutral ? "" : pickHome ? ", and they also have home field" : ""}.</p>`
      : `<p>${esc(O)} have the higher team rating (${Math.round(eo)} to ${Math.round(ep)}), but ${pickHome && !g.neutral ? "home field" : "the quarterback situation and rest"} push the pick to ${esc(P)}.</p>`);
  }
  const ra = Number(d.rest_away ?? 7), rh = Number(d.rest_home ?? 7), restBits = [];
  if (ra >= 13) restBits.push(`${esc(A)} are coming off a bye`);
  if (rh >= 13) restBits.push(`${esc(H)} are coming off a bye`);
  if (ra <= 5 && rh > 5) restBits.push(`${esc(A)} are on a short week`);
  if (rh <= 5 && ra > 5) restBits.push(`${esc(H)} are on a short week`);
  if (restBits.length) out.push(`<p>Schedule: ${list(restBits)}.</p>`);
  const qb = (team, q, flag) => {
    if (!q?.name) return `${esc(team)} have no recent starting quarterback on record`;
    const st = String(q.status ?? "");
    if (/out|doubtful|injured reserve|suspend/i.test(st)) return `${poss(team)} starter ${esc(q.name)} is listed ${esc(st.toLowerCase())}, so we have assumed a backup starts`;
    if (/questionable/i.test(st)) return `${poss(team)} ${esc(q.name)} is listed questionable, so we have counted part of the backup effect`;
    if (flag) return `we expect ${esc(q.name)} to start for ${esc(team)}, ${q.starts < 8 ? `with only ${q.starts} career start${q.starts === 1 ? "" : "s"}` : "though he hasn't been their regular starter this season"}`;
    return `we expect ${esc(q.name)} to start for ${esc(team)} (${q.starts} career starts)`;
  };
  out.push(`<p>Quarterbacks: ${qb(A, d.qb_away, d.qb_flag_away)}; ${qb(H, d.qb_home, d.qb_flag_home)}. We assume each team's most recent starter plays unless the injury report says otherwise.</p>`);
  const rA = rec[g.away], rH = rec[g.home];
  if ((rA && rA.w + rA.l + rA.t) || (rH && rH.w + rH.l + rH.t)) out.push(`<p>Season so far: ${esc(A)} are ${recStr(rA)} and ${esc(H)} are ${recStr(rH)}.</p>`);
  return out;
}

export const signupForm = (source) => `<form class="signup" action="/api/subscribe" method="post" data-signup>
  <label for="su-email"><b>Get our predictions and results by email, twice a week</b></label>
  <div class="srow"><input id="su-email" type="email" name="email" required maxlength="254" placeholder="you@example.com" autocomplete="email">
  <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><input type="hidden" name="source" value="${esc(source)}">
  <button type="submit">Sign up</button></div>
  <p class="small">Predictions and results by email, twice a week. Unsubscribe any time. <a href="/privacy">Privacy</a></p><p class="msg" role="status"></p>
</form>`;
export const SIGNUP_JS = `document.querySelectorAll("form[data-signup]").forEach(function (f) {
  f.addEventListener("submit", function (e) {
    e.preventDefault(); var m = f.querySelector(".msg"), b = f.querySelector("button"); b.disabled = true; m.textContent = "Signing you up…";
    fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: f.email.value, website: f.website.value, source: f.source ? f.source.value : "" }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        m.textContent = j.ok ? "Thanks, you're on the list." : (j.error || "Something went wrong. Please try again.");
        if (j.ok) f.email.value = ""; b.disabled = false; })
      .catch(function () { m.textContent = "Something went wrong. Please try again."; b.disabled = false; });
  });
});`;

// ------------------------------------------------------------------ page shell
export function shell({ title, description, path, body, jsonld, noindex = false, ogType = "website", signup = true }) {
  const url = ORIGIN + path;
  return `<!doctype html>
<html lang="en-AU">
<head>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9777350158785226" crossorigin="anonymous"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#07080f">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex, nofollow"><!-- PREVIEW BRANCH ONLY: remove before any merge to main -->
<meta property="og:site_name" content="ProbaLab">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${ORIGIN}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ORIGIN}/og-image.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=IBM+Plex+Sans:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/page.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/">Proba<b>Lab</b></a>
  <nav aria-label="Main"><a href="/nba/today">Today</a><a href="/nba/record">Record</a><a href="/#nba-predictions">NBA</a><a href="/#nfl-predictions">NFL</a><a href="/#about">How it works</a></nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer><div class="wrap">
  ${signup ? signupForm(path === "/" ? "home" : path.split("/")[1] || "page") : ""}
  <p><b>Predictions for entertainment, not advice.</b></p>
  <p class="links"><a href="/nba">NBA predictions</a><a href="/nfl">NFL predictions</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/contact">Contact</a></p>
  <p>© ${new Date().getUTCFullYear()} ProbaLab · probalabsports.com · Not affiliated with the NBA, the NFL, the NHL, the Premier League or any team.</p>
</div></footer>
<script>
${SIGNUP_JS}
// show times in the reader's own time zone
document.querySelectorAll("time[data-local]").forEach(function (t) {
  try { t.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(t.getAttribute("datetime"))); } catch (e) {}
});
</script>
<!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "57d222ff2aaf4fd39b6d82524fe356ca"}'></script><!-- End Cloudflare Web Analytics -->
</body>
</html>`;
}

export const html = (s, status = 200, maxAge = 120) => new Response(s, { status, headers: { "x-robots-tag": "noindex, nofollow", "content-type": "text/html; charset=utf-8", "cache-control": maxAge ? `public, max-age=0, s-maxage=${maxAge}, must-revalidate` : "no-cache" } });

// ------------------------------------------------------------------ game page
export const chip = (l) => (l ? `<span class="chip ${esc(l)}">${esc((LIGHT[l] ?? [l])[0])}</span>` : "");
export const sportName = (s) => (s === "nfl" ? "NFL" : "NBA");

export function renderGame(g, all, rec) {
  const S = sportName(g.sport), A = g.away_name, H = g.home_name;
  const post = g.status === "post" && g.home_score != null;
  const title = `${A} vs ${H} Prediction, ${shortDay(g.start_utc)} | ${S} | ProbaLab`;
  const pAway = g.pick ? (g.pick === g.away ? g.pick_p : 1 - g.pick_p) : null;
  const description = g.pick
    ? `${A} vs ${H} prediction: ${g.pick_name} ${pct(g.pick_p)} to win. ${post ? `Final ${g.away_score}–${g.home_score}. ` : ""}Team strength, ${g.sport === "nfl" ? "quarterbacks" : "injuries"}, rest and form, from ProbaLab's model.`
    : `${A} vs ${H}, ${dayET(g.start_utc)}. ProbaLab's prediction is posted before the game.`;
  const paras = g.pick ? (g.sport === "nfl" ? nflPreview(g, rec) : nbaPreview(g, rec)) : [];
  const resultHtml = post && g.pick ? `<section class="panel"><h2>Result</h2>
      <p>Final: ${esc(A)} <b>${g.away_score}</b> – <b>${g.home_score}</b> ${esc(H)}. Our pick, ${esc(g.pick_name)}, ${g.won === true ? `<b class="pos">won ✓</b>` : g.won === false ? `<b class="neg">lost ✕</b>` : "was a tie"}.</p>
      
      <p><a href="/#${g.sport}-record">See our full record →</a></p></section>` : "";
  const same = all.filter((x) => x.game_id !== g.game_id && x.pick && etDate(x.start_utc) === etDate(g.start_utc)).slice(0, 12);
  const pickCard = g.pick ? `<section class="panel pick">
      <div class="row"><span class="team ${g.pick === g.away ? "on" : ""}"><span class="ab">${esc(g.away)}</span>${esc(A)}<span class="pc">${pct(pAway)}</span></span>
        <span class="at">@</span>
        <span class="team r ${g.pick === g.home ? "on" : ""}"><span class="ab">${esc(g.home)}</span>${esc(H)}<span class="pc">${pct(1 - pAway)}</span></span></div>
      <div class="bar" role="img" aria-label="${esc(A)} ${pct(pAway)}, ${esc(H)} ${pct(1 - pAway)}"><i class="${g.pick === g.away ? "pk" : ""}" style="width:${(pAway * 100).toFixed(1)}%"></i><i class="${g.pick === g.home ? "pk" : ""}" style="width:${((1 - pAway) * 100).toFixed(1)}%"></i></div>
      <dl class="kv"><div><dt>Pick</dt><dd>${esc(g.pick_name)}</dd></div><div><dt>Chance</dt><dd>${pct(g.pick_p)}</dd></div><div><dt>Light</dt><dd>${chip(g.light)}</dd></div><div><dt>Confidence</dt><dd>${esc(confLabel(g.light))}</dd></div></dl>
    </section>` : `<section class="panel"><p>Our prediction for this game is posted ${g.sport === "nfl" ? "up to 8 days before kick-off" : "about 48 hours before game time"}. Check back soon.</p></section>`;
  const body = `<a class="back" href="/#${g.sport}-predictions">← Back to ${S} predictions</a>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/${g.sport}">${S} predictions</a> › <span>${esc(A)} vs ${esc(H)}</span></nav>
  <p class="eyebrow">// ${S}${g.sport === "nfl" ? ` · ${wkLabel(g.week)}` : ""} · ${esc(dayET(g.start_utc))}</p>
  <h1>${esc(A)} vs ${esc(H)} prediction</h1>
  <p class="when">${g.sport === "nfl" ? "Kick-off" : "Start"} ${esc(timeET(g.start_utc))} ET · <time data-local datetime="${esc(g.start_utc)}">${esc(whenAU(g.start_utc))}</time></p>
  ${pickCard}
  ${resultHtml}
  ${g.sport === "nba" ? trendsHtml(g, all) : ""}
  ${paras.length ? `<section class="panel prose"><h2>${post ? "Our pre-game preview" : "Preview"}</h2>${paras.join("\n")}
    <p>${post ? "This preview was written from the data we had before the game." : `What could change the pick: late ${g.sport === "nfl" ? "quarterback" : "injury"} news. We re-check every ${g.sport === "nfl" ? 30 : 15} minutes until ${g.sport === "nfl" ? "kick-off" : "game time"}, then the pick is frozen and stays on our public record, win or lose.`}</p>
    ${isTip(g) && !post ? `<p>This is one of our top picks: ${esc(g.pick_name)} at ${pct(g.pick_p)} to win.</p>` : ""}
  </section>` : ""}
  <p class="cta"><a class="btn" href="/#game-${esc(g.game_id)}">Full breakdown: team stats, players &amp; form →</a></p>
  ${same.length ? `<section class="panel"><h2>More ${S} predictions that day</h2><ul class="games">${same.map(gameRow).join("")}</ul></section>` : ""}
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice. <a href="/#about">How it works</a>.</p>`;
  const venue = venueOf(g);
  const league = g.sport === "nfl" ? { "@type": "SportsOrganization", name: "NFL", url: "https://www.nfl.com" }
    : { "@type": "SportsOrganization", name: "NBA", url: "https://www.nba.com" };
  const team = (n) => ({ "@type": "SportsTeam", name: n });
  // full event data lives only on the game page (hub pages link here through an ItemList)
  const jsonld = {
    "@context": "https://schema.org", "@type": "SportsEvent",
    name: `${A} vs ${H}`, sport: g.sport === "nfl" ? "American football" : "Basketball",
    startDate: g.start_utc, url: ORIGIN + g.path,
    // estimated end (typical game length): NBA ~2.5 h, NFL ~3.5 h
    endDate: new Date(new Date(g.start_utc).getTime() + (g.sport === "nfl" ? 3.5 : 2.5) * 3600e3).toISOString(),
    eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(venue ? { location: venue } : {}),
    image: [`${ORIGIN}/og-image.png`, `${ORIGIN}/icon-512.png`],
    description,
    organizer: league,
    homeTeam: team(H), awayTeam: team(A),
    competitor: [team(A), team(H)], performer: [team(A), team(H)],
  };
  return shell({ title, description, path: g.path, body, jsonld, noindex: !g.pick, ogType: "article" });
}

export function gameRow(g) {
  const post = g.status === "post" && g.home_score != null;
  return `<li><a href="${esc(g.path)}"><span class="d">${esc(shortDay(g.start_utc))}</span><span class="m">${esc(g.away_name)} @ ${esc(g.home_name)}</span>
    <span class="p">${g.pick ? `${esc(g.pick)} ${pct(g.pick_p)}` : "soon"}</span>${chip(g.light)}${post && g.pick ? `<span class="r ${g.won ? "pos" : "neg"}">${g.won ? "✓" : "✕"} ${g.away_score}–${g.home_score}</span>` : ""}</a></li>`;
}

// ------------------------------------------------------------------ sport hub
export function renderHub(sport, data) {
  const S = sportName(sport), now = Date.now();
  const upcoming = data.games.filter((g) => g.pick && g.status !== "post" && new Date(g.start_utc).getTime() > now - 4 * 3600e3).sort((a, b) => a.start_utc.localeCompare(b.start_utc));
  const recent = data.games.filter((g) => g.pick && g.status === "post" && g.won != null).sort((a, b) => b.start_utc.localeCompare(a.start_utc)).slice(0, 30);
  const settled = data.games.filter((g) => g.pick && g.status === "post" && g.won != null), tips = settled.filter(isTip);
  const rate = (xs) => (xs.length ? `${xs.filter((g) => g.won).length}–${xs.filter((g) => !g.won).length} (${pct(xs.filter((g) => g.won).length / xs.length)})` : "no results yet");
  const groups = {};
  upcoming.forEach((g) => (groups[sport === "nfl" ? wkLabel(g.week) : dayET(g.start_utc)] ??= []).push(g));
  const title = sport === "nfl" ? "NFL Predictions This Week: Win Probabilities for Every Game | ProbaLab" : "NBA Predictions Today: Win Probabilities for Every Game | ProbaLab";
  const description = sport === "nfl"
    ? "NFL predictions for every game this week: win probabilities, quarterback notes and a public, timestamped record of every pick."
    : "NBA predictions for every game: win probabilities that account for injuries, rest and form, with a public, timestamped record of every pick.";
  const intro = sport === "nfl"
    ? `<p>Every NFL game gets a win probability from our model. It rates each team from results and winning margins, adds home field and rest, and checks who is expected to start at quarterback. Picks are posted up to 8 days before kick-off, update as quarterback news comes in, and are frozen at kick-off.</p>`
    : `<p>Every NBA game gets a win probability from our model. It rates each team on the players expected to play that night, then adjusts for injuries, rest and recent form. Picks are posted about 48 hours before game time, update as injury news comes in, and are frozen at game time.</p>`;
  const body = `<a class="back" href="/#${sport}-predictions">← Back to ${S} predictions</a>
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>${S} predictions</span></nav>
  <p class="eyebrow">// ${S} · win predictions · ${esc(sport === "nfl" ? `${data.season} season` : `${data.season - 1}–${String(data.season).slice(2)} season`)}</p>
  <h1>${S} predictions</h1>
  ${intro}
  <p>Green picks (65%+) are our top picks. Orange is a lean, red is close to a coin flip. ${settled.length ? `Record so far: all picks ${rate(settled)}; top picks ${rate(tips)}.` : "Our record starts with the first results, and every pick stays on it, win or lose."} <a href="/#${sport}-record">Full record →</a></p>
  ${upcoming.length ? Object.entries(groups).map(([k, xs]) => `<section class="panel"><h2>${esc(k)}</h2><ul class="games">${xs.map(gameRow).join("")}</ul></section>`).join("")
    : `<section class="panel"><h2>No upcoming picks yet</h2><p>${sport === "nfl" ? "Next week's picks appear up to 8 days before kick-off." : "Picks appear about 48 hours before game time."}</p></section>`}
  ${recent.length ? `<section class="panel"><h2>Recent results</h2><ul class="games">${recent.map(gameRow).join("")}</ul></section>` : ""}
  <p class="cta"><a class="btn" href="/#${sport}-predictions">Open the ${S} app view →</a></p>`;
  // list page: an ItemList of links to the game pages (no bare SportsEvent entries here)
  const listed = [...upcoming, ...recent].slice(0, 40);
  const jsonld = { "@context": "https://schema.org", "@type": "CollectionPage", name: `${S} predictions`, url: `${ORIGIN}/${sport}`, description,
    mainEntity: { "@type": "ItemList", numberOfItems: listed.length,
      itemListElement: listed.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: ORIGIN + g.path, name: `${g.away_name} vs ${g.home_name} prediction` })) } };
  return shell({ title, description, path: `/${sport}`, body, jsonld });
}


// ------------------------------------------------------------------ seo-preview additions
const CONF = { SUPER: "Very high", GREEN: "High", ORANGE: "Medium", RED: "Low" };
const confLabel = (l) => CONF[l] ?? "Not set";
// last N finished games for a team before a given time, from the feed's own scores
function lastGames(all, team, before, n = 5) {
  return all.filter((x) => x.status === "post" && x.home_score != null && (x.home === team || x.away === team) && x.start_utc < before)
    .sort((a, b) => b.start_utc.localeCompare(a.start_utc)).slice(0, n)
    .map((x) => { const home = x.home === team, us = home ? x.home_score : x.away_score, them = home ? x.away_score : x.home_score;
      return { win: us > them, margin: us - them, home, opp: home ? x.away : x.home, us, them }; });
}
function trendsHtml(g, all) {
  const rows = [[g.away, g.away_name], [g.home, g.home_name]].map(([t, n]) => {
    const xs = lastGames(all, t, g.start_utc);
    if (!xs.length) return `<li><b>${esc(n)}</b>: no finished games yet this season.</li>`;
    const w = xs.filter((x) => x.win).length, avg = xs.reduce((a, x) => a + x.margin, 0) / xs.length;
    const seq = xs.map((x) => `${x.win ? "W" : "L"} ${x.us}–${x.them} ${x.home ? "v" : "@"} ${esc(x.opp)}`).join(", ");
    return `<li><b>${esc(n)}</b>: ${w} win${w === 1 ? "" : "s"} from the last ${xs.length}, average margin ${sgn(avg)} points (${seq}).</li>`;
  });
  const meet = all.filter((x) => x.status === "post" && x.home_score != null && x.start_utc < g.start_utc && ((x.home === g.home && x.away === g.away) || (x.home === g.away && x.away === g.home)));
  return `<section class="panel prose"><h2>Recent results</h2><ul>${rows.join("")}</ul>
    <p>${meet.length ? `These teams have already met ${meet.length} time${meet.length === 1 ? "" : "s"} this season.` : "This is the first meeting between these teams this season."} Results are taken from final scores, most recent first.</p></section>`;
}

// /nba/today: today's games plus the rest of this week
export function renderToday(sport, data) {
  const S = sportName(sport), now = Date.now(), wk = now + 7 * 864e5;
  const up = data.games.filter((g) => g.status !== "post" && new Date(g.start_utc).getTime() > now - 4 * 3600e3 && new Date(g.start_utc).getTime() < wk)
    .sort((a, b) => a.start_utc.localeCompare(b.start_utc));
  const picked = up.filter((g) => g.pick);
  const groups = {}; up.forEach((g) => (groups[dayET(g.start_utc)] ??= []).push(g));
  const days = Object.keys(groups);
  const strongest = [...picked].sort((a, b) => b.pick_p - a.pick_p)[0];
  const closest = [...picked].sort((a, b) => a.pick_p - b.pick_p)[0];
  const byLight = (l) => picked.filter((g) => g.light === l).length;
  const title = `${S} Predictions Today and This Week: Win Chances for ${up.length} Games | ProbaLab`;
  const description = `${S} win chances for ${up.length} games over the next 7 days${strongest ? `, led by ${strongest.pick_name} at ${pct(strongest.pick_p)}` : ""}. Updated with injury news before every game.`;
  const summary = picked.length ? `<p>Across the next seven days there are ${up.length} ${S} games on the schedule, and ${picked.length} already have a model prediction. ${strongest ? `The model's most confident call is ${esc(strongest.pick_name)} (${pct(strongest.pick_p)}) in ${esc(strongest.away_name)} vs ${esc(strongest.home_name)} on ${esc(shortDay(strongest.start_utc))}.` : ""} ${closest && closest !== strongest ? `The tightest game is ${esc(closest.away_name)} vs ${esc(closest.home_name)}, where ${esc(closest.pick_name)} are only ${pct(closest.pick_p)}.` : ""}</p>
    <p>By confidence: ${byLight("SUPER")} very high, ${byLight("GREEN")} high, ${byLight("ORANGE")} medium and ${byLight("RED")} low. Games without a figure yet get one about 48 hours before the start.</p>`
    : `<p>No ${S} predictions are posted for the next seven days yet.</p>`;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/${sport}">${S} predictions</a> › <span>Today and this week</span></nav>
  <p class="eyebrow">// ${S} · next 7 days · updated every 15 minutes</p>
  <h1>${S} predictions today and this week</h1>
  ${summary}
  ${days.map((d) => `<section class="panel"><h2>${esc(d)}</h2><ul class="games">${groups[d].map(gameRow).join("")}</ul></section>`).join("") || ""}
  <p class="cta"><a class="btn" href="/${sport}/record">How accurate is the model? See the record →</a></p>
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;
  const jsonld = { "@context": "https://schema.org", "@type": "CollectionPage", name: `${S} predictions today and this week`, url: `${ORIGIN}/${sport}/today`, description,
    mainEntity: { "@type": "ItemList", numberOfItems: up.length, itemListElement: up.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: ORIGIN + g.path, name: `${g.away_name} vs ${g.home_name} prediction` })) } };
  return shell({ title, description, path: `/${sport}/today`, body, jsonld });
}

// /nba/record: model record and calibration chart from finished games
export function renderRecord(sport, data) {
  const S = sportName(sport);
  const done = data.games.filter((g) => g.pick && g.status === "post" && g.won != null).sort((a, b) => b.start_utc.localeCompare(a.start_utc));
  const n = done.length, w = done.filter((g) => g.won).length;
  const bands = [[0.5, 0.55], [0.55, 0.6], [0.6, 0.65], [0.65, 0.7], [0.7, 0.8], [0.8, 1.01]].map(([lo, hi]) => {
    const xs = done.filter((g) => g.pick_p >= lo && g.pick_p < hi);
    return { lo, hi, n: xs.length, exp: xs.length ? xs.reduce((a, g) => a + g.pick_p, 0) / xs.length : null, hit: xs.length ? xs.filter((g) => g.won).length / xs.length : null };
  });
  const brier = n ? done.reduce((a, g) => a + (g.pick_p - (g.won ? 1 : 0)) ** 2, 0) / n : null;
  const expW = done.reduce((a, g) => a + g.pick_p, 0);
  const lights = ["SUPER", "GREEN", "ORANGE", "RED"].map((l) => { const xs = done.filter((g) => g.light === l); return [l, xs.length, xs.filter((g) => g.won).length]; });
  // SVG calibration chart: x = predicted chance, y = actual win rate, dot size = games
  const W = 560, Hh = 360, pad = 44, X = (p) => pad + ((p - 0.5) / 0.5) * (W - 2 * pad), Y = (p) => Hh - pad - p * (Hh - 2 * pad);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((v) => `<line x1="${pad}" x2="${W - pad}" y1="${Y(v)}" y2="${Y(v)}" stroke="#232a42"/><text x="${pad - 8}" y="${Y(v) + 4}" text-anchor="end" fill="#8b93b0" font-size="11">${v * 100}%</text>`).join("")
    + [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => `<text x="${X(v)}" y="${Hh - pad + 18}" text-anchor="middle" fill="#8b93b0" font-size="11">${Math.round(v * 100)}%</text>`).join("");
  const dots = bands.filter((b) => b.n).map((b) => `<circle cx="${X(b.exp).toFixed(1)}" cy="${Y(b.hit).toFixed(1)}" r="${(4 + Math.sqrt(b.n) * 2).toFixed(1)}" fill="#19e3ff" fill-opacity=".75"><title>${Math.round(b.lo * 100)}–${Math.min(100, Math.round(b.hi * 100))}%: predicted ${pct(b.exp)}, happened ${pct(b.hit)} (${b.n} games)</title></circle>`).join("");
  const chart = `<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Calibration chart: predicted chance against how often it happened">${grid}
    <line x1="${X(0.5)}" y1="${Y(0.5)}" x2="${X(1)}" y2="${Y(1)}" stroke="#ff2fc0" stroke-dasharray="5 5"/>${dots}
    <text x="${W / 2}" y="${Hh - 6}" text-anchor="middle" fill="#8b93b0" font-size="12">Model's chance for the predicted winner</text>
    <text x="14" y="${Hh / 2}" transform="rotate(-90 14 ${Hh / 2})" text-anchor="middle" fill="#8b93b0" font-size="12">How often it happened</text></svg>`;
  const tbl = `<table class="cal"><thead><tr><th>Model chance</th><th>Games</th><th>Average prediction</th><th>Actually won</th></tr></thead><tbody>${bands.filter((b) => b.n).map((b) => `<tr><td>${Math.round(b.lo * 100)}–${Math.min(100, Math.round(b.hi * 100))}%</td><td>${b.n}</td><td>${pct(b.exp)}</td><td>${pct(b.hit)}</td></tr>`).join("")}</tbody></table>`;
  const title = `${S} Prediction Record and Calibration ${data.season - 1}–${String(data.season).slice(2)} | ProbaLab`;
  const description = `Every ${S} prediction ProbaLab has made this season: ${w} of ${n} correct (${n ? pct(w / n) : "0%"}), with a calibration chart showing how often each predicted chance came true.`;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/${sport}">${S} predictions</a> › <span>Record</span></nav>
  <p class="eyebrow">// ${S} · model record · ${n} finished games</p>
  <h1>${S} prediction record</h1>
  <p>Every ${S} prediction stays on this page once the game finishes, right or wrong. So far this season the model has named the winner in <b>${w} of ${n}</b> games (${n ? pct(w / n) : "0%"}). Its own figures said to expect about ${expW.toFixed(1)} correct, so it is running ${w >= expW ? `${(w - expW).toFixed(1)} ahead of` : `${(expW - w).toFixed(1)} behind`} what it forecast.</p>
  <section class="panel"><h2>Calibration: when we said 70%, did it happen 70% of the time?</h2>
    ${chart}
    <p>Each dot groups games by the chance the model gave its predicted winner. A dot on the dashed diagonal means those chances came true exactly as often as stated; bigger dots hold more games. The accuracy score (average squared error, lower is better) is <b>${brier == null ? "n/a" : brier.toFixed(3)}</b>, against 0.250 for a coin flip.</p>
    ${tbl}
    <p class="small">Early-season groups are small, so single results move the dots a lot. The chart fills in as the season goes on.</p></section>
  <section class="panel"><h2>By confidence level</h2><ul>${lights.filter(([, c]) => c).map(([l, c, k]) => `<li>${chip(l)} ${esc(confLabel(l))} confidence: ${k} of ${c} correct (${pct(k / c)})</li>`).join("")}</ul></section>
  <section class="panel"><h2>Latest finished games</h2><ul class="games">${done.slice(0, 20).map(gameRow).join("")}</ul></section>
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;
  const jsonld = { "@context": "https://schema.org", "@type": "WebPage", name: `${S} prediction record`, url: `${ORIGIN}/${sport}/record`, description };
  return shell({ title, description, path: `/${sport}/record`, body, jsonld });
}

export function notFound() {
  return html(shell({ title: "Page not found | ProbaLab", description: "This page doesn't exist.", path: "/404", noindex: true,
    body: `<h1>Page not found</h1><section class="panel"><p>That page doesn't exist, or the game is from an older season.</p><p><a href="/nba">NBA predictions</a> · <a href="/nfl">NFL predictions</a> · <a href="/">Home</a></p></section>` }), 404, 60);
}

// ------------------------------------------------------------------ sport route handler
export async function handleSport(ctx, sport) {
  const parts = ctx.params.path ?? [];
  const p = Array.isArray(parts) ? parts : [parts];
  let feed;
  try { feed = await getFeed(ctx, sport); } catch (e) {
    return html(shell({ title: "Predictions are loading | ProbaLab", description: "Please try again in a minute.", path: `/${sport}`, noindex: true,
      body: `<h1>Back in a minute</h1><section class="panel"><p>We couldn't load the predictions just now. Please refresh in a minute.</p></section>` }), 503, 0);
  }
  const data = gamesOf(sport, feed);
  if (!p.length || p[0] === "") return html(renderHub(sport, data));
  if (p[0] === "today" && p.length === 1) return html(renderToday(sport, data));
  if (p[0] === "record" && p.length === 1) return html(renderRecord(sport, data));
  if (p.length > 1) return notFound();
  const id = idFromSlug(p[0]);
  const g = id && data.games.find((x) => x.game_id === id);
  if (!g) return notFound();
  if (p[0] !== g.path.split("/").pop()) return Response.redirect(new URL(g.path, ctx.request.url).toString(), 301);
  return html(renderGame(g, data.games, records(data.games)));
}
