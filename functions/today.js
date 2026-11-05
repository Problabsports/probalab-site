// /today: every NBA, NFL, NHL and EPL game in the next ~24 hours (Sydney clock),
 // with model chance, fair price (1 / chance), light, market chance (when present),
 // and value % (model chance minus market chance). Best-value game per sport is highlighted.
 // NBA/NFL from the live feed; NHL/EPL from /data; market chances from /data/market-implied.json
 // (built on the box from existing comparison CSVs — no new Odds API credits).
import { getFeed, gamesOf, shell, html, esc, chip } from "./_shared/site.js";

const TZ = "Australia/Sydney";
const WINDOW_MS = 24 * 3600e3;
const NHLN = { ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres", CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks", COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars", DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers", LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montréal Canadiens", NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders", NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers", PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken", STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs", UTA: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights", WSH: "Washington Capitals", WPG: "Winnipeg Jets" };

const pct = (p) => (p == null || !Number.isFinite(p) ? "—" : `${Math.round(p * 100)}%`);
const fair = (p) => (p == null || !Number.isFinite(p) || p <= 0 ? "—" : (1 / p).toFixed(2));
const asset = (ctx, p, d) => ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)).then((r) => (r.ok ? r.json() : d)).catch(() => d);
const tAEDT = (iso) => { const parts = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(iso)); const get = (t) => parts.find((p) => p.type === t)?.value ?? ""; return `${get("weekday")} ${get("hour")}:${get("minute")}${get("dayPeriod").toLowerCase()}`; };
const dayAEDT = (iso) => new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
const inWindow = (iso, now) => {
  const t = new Date(iso).getTime();
  return t >= now - 2 * 3600e3 && t <= now + WINDOW_MS;
};
const abbrKey = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const nameKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function marketIndex(raw) {
  const byId = new Map(), byMatch = new Map();
  for (const g of raw?.games ?? []) {
    if (g.game_id) byId.set(`${g.sport}:${String(g.game_id)}`, g);
    if (g.away && g.home) {
      byMatch.set(`${g.sport}:${abbrKey(g.away)}@${abbrKey(g.home)}`, g);
      byMatch.set(`${g.sport}:${nameKey(g.away)}@${nameKey(g.home)}`, g);
    }
  }
  return { byId, byMatch, generated: raw?.generated_utc ?? null, gaps: raw?.gaps ?? [] };
}

function marketFor(idx, sport, g) {
  const id = g.game_id ?? g.id;
  let m = id != null ? idx.byId.get(`${sport}:${String(id)}`) : null;
  if (!m) m = idx.byMatch.get(`${sport}:${abbrKey(g.away)}@${abbrKey(g.home)}`);
  if (!m) m = idx.byMatch.get(`${sport}:${nameKey(g.away)}@${nameKey(g.home)}`);
  return m || null;
}

function marketPick(m, pickSide) {
  if (!m || !pickSide) return null;
  if (pickSide === "home") return m.market_home;
  if (pickSide === "away") return m.market_away;
  if (pickSide === "draw") return m.market_draw ?? null;
  return null;
}

function valueOf(modelP, marketP) {
  if (modelP == null || marketP == null || !Number.isFinite(modelP) || !Number.isFinite(marketP)) return null;
  return modelP - marketP;
}

const HEAD = `<li class="head" aria-hidden="true"><span class="d">Time</span><span class="m">Match</span><span class="p">Pick · chance</span><span class="chip-slot"></span><span class="fp">Fair</span><span class="mk">Market</span><span class="gap">Value</span></li>`;

function todayRow(g, best) {
  const v = g.value;
  const gapCls = v == null ? "" : v > 0.005 ? "pos" : v < -0.005 ? "neg" : "";
  const gapTxt = v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1)}%`;
  const isBest = best && g.key === best.key && v != null;
  return `<li class="${isBest ? "best-value" : ""}"${isBest ? ` title="Best value in ${esc(g.sportName)} today"` : ""}><a href="${esc(g.href)}">
    <span class="d">${esc(g.when)}</span>
    <span class="m">${esc(g.match)}${isBest ? ` <span class="best-tag">Best value</span>` : ""}</span>
    <span class="p">${esc(g.pick)}</span>${chip(g.light)}
    <span class="fp" title="Fair price = 1 ÷ model win chance">${esc(fair(g.modelP))}</span>
    <span class="mk" title="Market chance for the same side">${pct(g.marketP)}</span>
    <span class="gap ${gapCls}" title="Model chance minus market chance">${esc(gapTxt)}</span>
  </a></li>`;
}

function bestValue(games) {
  let best = null;
  for (const g of games) {
    if (g.value == null || g.value <= 0) continue; // only mark when the model is above the market
    if (!best || g.value > best.value) best = g;
  }
  return best;
}

function section(id, name, games, links, extra) {
  if (!games.length) {
    return `<section class="panel" id="${id}"><h2>${esc(name)}${extra ? ` · ${esc(extra)}` : ""}</h2>
      <p>No ${esc(name)} games tip off in the next 24 hours.</p>
      <p class="small">${links}</p></section>`;
  }
  const best = bestValue(games);
  const withMarket = games.filter((g) => g.value != null).length;
  const bestNote = best
    ? `<p class="best-line">Best value today: <b>${esc(best.pickName || best.pick)}</b> in ${esc(best.match)} at ${esc(fair(best.modelP))} fair · value +${(best.value * 100).toFixed(1)}%.</p>`
    : withMarket
      ? `<p class="best-line small">No positive value in ${esc(name)} in this window (model at or below the market on every game with a market chance).</p>`
      : `<p class="best-line small">Best value needs a market chance on file for at least one game.</p>`;
  const rows = HEAD + games.map((g) => todayRow(g, best)).join("");
  return `<section class="panel" id="${id}"><h2>${esc(name)}${extra ? ` · ${esc(extra)}` : ""}</h2>
  ${bestNote}
  <ul class="games today-games">${rows}</ul>
  <p class="small">${links}</p></section>`;
}

const HOW_TO = `<section class="panel howto" id="how-to-read">
  <h2>How to read this</h2>
  <ul class="howto-list">
    <li><b>Pick · chance</b> — the side the model likes, and its win chance (the coloured light is the confidence band).</li>
    <li><b>Fair</b> — the fair price implied by that chance (1 ÷ chance). A 60% call is 1.67; a 75% call is 1.33.</li>
    <li><b>Market</b> — the market's implied chance for the same side, when we already have a price on file. Blank means no market figure yet.</li>
    <li><b>Value</b> — model chance minus market chance. Positive means the model is higher than the market; the largest positive in each sport is marked <span class="best-tag">Best value</span>.</li>
  </ul>
  <p class="small">Figures are for entertainment, not advice. Fair prices are from the model alone, not from any book.</p>
</section>`;

export async function onRequestGet(ctx) {
  const now = Date.now();
  const market = marketIndex(await asset(ctx, "/data/market-implied.json", { games: [] }));
  const out = [];
  let total = 0;

  for (const [sport, S] of [["nba", "NBA"], ["nfl", "NFL"]]) {
    let data = null;
    try { data = gamesOf(sport, await getFeed(ctx, sport)); } catch (e) {}
    if (!data) {
      out.push(`<section class="panel" id="${sport}"><h2>${S}</h2><p>We couldn't load ${S} games just now. Please refresh in a minute.</p></section>`);
      continue;
    }
    const upcoming = data.games
      .filter((g) => g.status !== "post" && inWindow(g.start_utc, now))
      .sort((a, b) => a.start_utc.localeCompare(b.start_utc));
    total += upcoming.length;
    const games = upcoming.map((g) => {
      const m = marketFor(market, sport, g);
      const side = g.pick === g.home ? "home" : g.pick === g.away ? "away" : null;
      const marketP = marketPick(m, side);
      const modelP = g.pick_p;
      return {
        key: `${sport}:${g.game_id}`,
        sportName: S,
        href: g.path,
        when: tAEDT(g.start_utc) + " AEDT",
        match: `${g.away_name} @ ${g.home_name}`,
        pick: g.pick ? `${g.pick_name} ${pct(modelP)}` : "soon",
        pickName: g.pick_name,
        light: g.light,
        modelP,
        marketP,
        value: valueOf(modelP, marketP),
        start_utc: g.start_utc,
      };
    });
    out.push(section(sport, S, games, `<a href="/${sport}/today">All ${S} games this week →</a> · <a href="/${sport}/record">${S} record →</a>`, games.length ? dayAEDT(games[0].start_utc) : null));
  }

  {
    const [raw, snap] = await Promise.all([asset(ctx, "/data/nhl-picks.json", []), asset(ctx, "/data/nhl-pretip.json", {})]);
    const SN = snap?.games ?? {};
    const gs = (Array.isArray(raw) ? raw : raw.games ?? []).map((g) => {
      const id = String(g.game_id ?? g.id);
      const pc = (v) => (v == null ? null : Number(v) > 1 ? Number(v) / 100 : Number(v));
      const ph = pc(g.p_home ?? g.home_pct), pa = pc(g.p_away ?? g.away_pct), sn = SN[id];
      const pickHome = sn ? sn.pick === g.home : g.pick === "home" || g.pick === g.home;
      const p = sn ? Number(sn.pick_p) : pickHome ? ph : pa;
      const start = g.start_utc ?? g.puck_drop_utc ?? g.date;
      return {
        id, start_utc: start, home: g.home, away: g.away, p,
        pickName: NHLN[pickHome ? g.home : g.away] ?? (pickHome ? g.home : g.away),
        pickSide: pickHome ? "home" : "away",
        light: sn?.light ?? (p >= 0.65 ? "GREEN" : p >= 0.55 ? "ORANGE" : "RED"),
        done: (sn && typeof sn.won === "boolean") || g.status === "post" || new Date(start).getTime() < now - 3 * 3600e3,
      };
    });
    const upcoming = gs.filter((g) => !g.done && inWindow(g.start_utc, now)).sort((a, b) => a.start_utc.localeCompare(b.start_utc));
    total += upcoming.length;
    const games = upcoming.map((g) => {
      const m = marketFor(market, "nhl", g);
      const marketP = marketPick(m, g.pickSide);
      return {
        key: `nhl:${g.id}`,
        sportName: "NHL",
        href: `/nhl#game-${g.id}`,
        when: tAEDT(g.start_utc) + " AEDT",
        match: `${NHLN[g.away] ?? g.away} @ ${NHLN[g.home] ?? g.home}`,
        pick: `${g.pickName} ${pct(g.p)}`,
        pickName: g.pickName,
        light: g.light,
        modelP: g.p,
        marketP,
        value: valueOf(g.p, marketP),
        start_utc: g.start_utc,
      };
    });
    out.push(section("nhl", "NHL", games, `<a href="/nhl">All NHL games →</a>`, games.length ? dayAEDT(games[0].start_utc) : null));
  }

  {
    const [raw, grades] = await Promise.all([asset(ctx, "/data/epl-picks.json", []), asset(ctx, "/data/epl-grades.json", {})]);
    const LF = "2026-10-23T23:42:00Z";
    const gs = (Array.isArray(raw) ? raw : raw.games ?? []).map((g) => {
      const id = String(g.game_id ?? g.id);
      const ps = { home: Number(g.p_home), draw: Number(g.p_draw), away: Number(g.p_away) };
      const p = ps[g.pick];
      const gr = grades[id];
      const start = g.start_utc ?? g.kickoff_utc;
      return {
        id, start_utc: start, home: g.home, away: g.away, p, pick: g.pick,
        pickName: g.pick === "home" ? g.home : g.pick === "away" ? g.away : "Draw",
        light: start >= LF ? (p >= 0.55 ? "GREEN" : p >= 0.45 ? "ORANGE" : "RED") : null,
        done: !!gr?.graded || g.status === "post" || new Date(start).getTime() < now - 3 * 3600e3,
      };
    });
    const upcoming = gs.filter((g) => !g.done && inWindow(g.start_utc, now)).sort((a, b) => a.start_utc.localeCompare(b.start_utc));
    total += upcoming.length;
    const games = upcoming.map((g) => {
      const m = marketFor(market, "epl", g);
      const marketP = marketPick(m, g.pick);
      return {
        key: `epl:${g.id}`,
        sportName: "Premier League",
        href: `/epl#game-${g.id}`,
        when: tAEDT(g.start_utc) + " AEDT",
        match: `${g.home} v ${g.away}`,
        pick: `${g.pickName} ${pct(g.p)}`,
        pickName: g.pickName,
        light: g.light,
        modelP: g.p,
        marketP,
        value: valueOf(g.p, marketP),
        start_utc: g.start_utc,
      };
    });
    out.push(section("epl", "Premier League", games, `<a href="/epl">All Premier League matches →</a>`, games.length ? dayAEDT(games[0].start_utc) : null));
  }

  const marketNote = market.generated
    ? `Market chances last refreshed ${esc(market.generated)} from prices already on file (no live book lookup).`
    : "Market chances will appear once the on-box comparison files are synced into this preview.";

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Today's games</span></nav>
  <p class="eyebrow">// next 24 hours · Australia/Sydney</p>
  <h1>Today's NBA, NFL, NHL &amp; EPL predictions</h1>
  <p>${total ? `${total} game${total === 1 ? "" : "s"} tip off in the next 24 hours.` : "No games tip off in the next 24 hours."}
  Each row shows the model's pick and win chance, its fair price, the light colour, the market chance for the same side when we have it, and the value % (model minus market). The largest value in each sport is marked.</p>
  <nav class="crumbs" aria-label="Jump to sport"><a href="#how-to-read">How to read this</a> · <a href="#nba">NBA</a> · <a href="#nfl">NFL</a> · <a href="#nhl">NHL</a> · <a href="#epl">Premier League</a> · <a href="/accuracy">Accuracy →</a></nav>
  ${HOW_TO}
  ${out.join("\n")}
  <p class="small">${marketNote}${market.gaps?.length ? ` Gaps: ${esc(market.gaps.join("; "))}.` : ""}</p>
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;

  return html(shell({
    title: "Today's NBA, NFL, NHL & EPL Predictions | ProbaLab",
    description: "Win chances, fair prices and value % for every NBA, NFL, NHL and Premier League game tipping off in the next 24 hours.",
    path: "/today",
    body,
  }), 200, 60);
}
