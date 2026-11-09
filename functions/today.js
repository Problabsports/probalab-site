// /today: every NBA, NFL, NHL, EPL, Championship and tennis match in the next ~24 hours (Sydney clock),
 // with model chance, fair price (1 / chance), light, market chance (when present),
 // and value % (model chance minus market chance). Best-value game per sport is highlighted.
 // NBA/NFL from the live feed; NHL/EPL from /data; market chances from /data/market-implied.json
 // (built on the box from existing comparison CSVs — no new Odds API credits).
import { getFeed, gamesOf, shell, html, esc, chip, slug, asHead } from "./_shared/site.js";
import { injuryBadge } from "./_shared/injury-warning.js";
import {
  parseGameFilters, matchesLightFilter, sortGreenFirst,
  renderFilterBar, emptyFilterMessage,
} from "./_shared/game-filters.js";

const teamHref = (sport, name) => `/${sport}/team/${slug(name)}`;
const teamA = (sport, name) => `<a class="team-link" href="${esc(teamHref(sport, name))}">${esc(name)}</a>`;

const TZ = "Australia/Sydney";
const WINDOW_MS = 24 * 3600e3;
const NHLN = { ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres", CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks", COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars", DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers", LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montréal Canadiens", NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders", NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers", PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken", STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs", UTA: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights", WSH: "Washington Capitals", WPG: "Winnipeg Jets" };

const pct = (p) => (p == null || !Number.isFinite(p) ? "—" : `${Math.round(p * 100)}%`);
const fair = (p) => (p == null || !Number.isFinite(p) || p <= 0 ? null : 1 / p);
const fairHtml = (p) => { const d = fair(p); return d == null ? "—" : `<span class="odds" data-dec="${d}">${d.toFixed(2)}</span>`; };
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
    const pairs = [
      [g.away, g.home],
      [g.away_name, g.home_name],
    ];
    for (const [a, h] of pairs) {
      if (!a || !h) continue;
      byMatch.set(`${g.sport}:${abbrKey(a)}@${abbrKey(h)}`, g);
      byMatch.set(`${g.sport}:${nameKey(a)}@${nameKey(h)}`, g);
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

const HEAD = (showMkt) => showMkt
  ? `<li class="head"><span class="d">Time</span><span class="m">Match</span><span class="p">Pick · chance</span><span class="chip-slot"></span><span class="fp">Fair</span><span class="mk">Market</span><span class="gap">Value</span></li>`
  : `<li class="head"><span class="d">Time</span><span class="m">Match</span><span class="p">Pick · chance</span><span class="chip-slot"></span><span class="fp">Fair</span></li>`;
const FMT_BAR = `<div class="oddsfmt-bar"><button type="button" class="oddsfmt" aria-label="Odds format">DEC ⇄</button></div>`;

// Value badge: GREEN/SUPER and model−market ≥ +3.0 percentage points.
const VALUE_MIN = 0.03;
const MARKET_STALE_MS = 24 * 3600e3;
const isTipLight = (l) => l === "GREEN" || l === "SUPER";
const qualifiesValue = (g) => isTipLight(g.light) && g.value != null && g.value >= VALUE_MIN;

function heldNoteOf(g) {
  const d = g.detail && typeof g.detail === "object" ? g.detail : {};
  const raw = g.case_against ?? g.held_note ?? g.hold_note ?? d.case_against ?? d.held_note ?? d.hold_note;
  const s = raw == null ? "" : String(raw).trim();
  return s || "";
}

function todayRow(g, showMkt) {
  const v = g.value;
  let gapCls = "";
  if (v != null) {
    if (v >= VALUE_MIN) gapCls = "pos-strong";
    else if (v > 0.005) gapCls = "pos"; // small positive: neutral (not green)
    else if (v < -0.005) gapCls = "neg";
  }
  const gapTxt = v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1)}%`;
  const valued = showMkt && qualifiesValue(g);
  const matchHtml = g.matchHtml || esc(g.match);
  const held = g.heldNote ? `<span class="held-note">${esc(g.heldNote)}</span>` : "";
  const mktCols = showMkt ? `
      <span class="mk" title="Market chance for the same side">${pct(g.marketP)}</span>
      <span class="gap ${gapCls}" title="Model chance minus market chance">${esc(gapTxt)}</span>` : "";
  const warn = g.injuryBadgeHtml || "";
  return `<li class="${valued ? "has-value" : ""}${warn ? " has-injury-watch" : ""}"${valued ? ` title="Value: GREEN/SUPER and at least +3.0 vs the market"` : ""}>
    <span class="d"><a href="${esc(g.href)}">${esc(g.when)}</a></span>
    <span class="m">${matchHtml}${valued ? ` <span class="best-tag">Value</span>` : ""}${held}</span>
    <a class="row-rest" href="${esc(g.href)}">
      <span class="p">${esc(g.pick)}</span><span class="chip-with-warn">${chip(g.light)}</span>
      <span class="fp" title="Fair price = 1 ÷ model win chance">${fairHtml(g.modelP)}</span>${mktCols}
    </a>
    ${warn}
  </li>`;
}

function section(id, name, games, links, extra, showMkt = true) {
  if (!games.length) {
    return `<section class="panel" id="${id}"><h2>${esc(name)}${extra ? ` · ${esc(extra)}` : ""}</h2>
      <p>No ${esc(name)} games tip off in the next 24 hours.</p>
      <p class="small">${links}</p></section>`;
  }
  // Value-pick count line removed (John 10 Nov 2026) — Value badges on rows remain.
  const valueNote = !showMkt
    ? `<p class="best-line small">Market columns are hidden while the on-file market file is older than 24 hours.</p>`
    : "";
  const rows = HEAD(showMkt) + games.map((g) => todayRow(g, showMkt)).join("");
  return `<section class="panel" id="${id}"><h2>${esc(name)}${extra ? ` · ${esc(extra)}` : ""}</h2>
  ${valueNote}
  ${FMT_BAR}
  <ul class="games today-games">${rows}</ul>
  <p class="small">${links}</p></section>`;
}

const HOW_TO = `<section class="panel howto compact" id="how-to-read">
  <p class="legend-line" aria-label="How to read this">${chip("SUPER")} Super — best value · ${chip("GREEN")} 65%+ · ${chip("ORANGE")} lean · ${chip("RED")} coin flip · <span class="injury-watch-label">⚠️ Injury watch</span> key players uncertain / may play fewer minutes. <a href="/lights">How to read the lights →</a></p>
</section>`;

export async function onRequestGet(ctx) {
  const now = Date.now();
  const filters = parseGameFilters(ctx.request.url);
  const market = marketIndex(await asset(ctx, "/data/market-implied.json", { games: [] }));
  const marketAgeMs = market.generated ? (Date.now() - new Date(market.generated).getTime()) : Infinity;
  const showMkt = Number.isFinite(marketAgeMs) && marketAgeMs >= 0 && marketAgeMs <= MARKET_STALE_MS;
  const sections = [];
  let total = 0;

  for (const [sport, S] of [["nba", "NBA"], ["nfl", "NFL"]]) {
    let data = null;
    try { data = gamesOf(sport, await getFeed(ctx, sport)); } catch (e) {}
    if (!data) {
      sections.push({ id: sport, name: S, games: null, error: true, links: "" });
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
        matchHtml: `${teamA(sport, g.away_name)} @ ${teamA(sport, g.home_name)}`,
        pick: g.pick ? `${g.pick_name} ${pct(modelP)}` : "soon",
        pickName: g.pick_name,
        light: g.light,
        modelP,
        marketP,
        value: valueOf(modelP, marketP),
        heldNote: heldNoteOf(g),
        injuryBadgeHtml: sport === "nba" ? injuryBadge(g) : "",
        start_utc: g.start_utc,
      };
    });
    sections.push({
      id: sport, name: S, games: games.map((g) => ({ ...g, sport })),
      links: `<a href="/${sport}/today">All ${S} games this week →</a> · <a href="/results?sport=${sport}">${S} results →</a> · <a href="/${sport}/team">${S} teams →</a>`,
    });
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
        matchHtml: `${teamA("nhl", NHLN[g.away] ?? g.away)} @ ${teamA("nhl", NHLN[g.home] ?? g.home)}`,
        pick: `${g.pickName} ${pct(g.p)}`,
        pickName: g.pickName,
        light: g.light,
        modelP: g.p,
        marketP,
        value: valueOf(g.p, marketP),
        start_utc: g.start_utc,
      };
    });
    sections.push({
      id: "nhl", name: "NHL", games: games.map((g) => ({ ...g, sport: "nhl" })),
      links: `<a href="/nhl">All NHL games →</a> · <a href="/nhl/team">NHL teams →</a>`,
    });
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
        matchHtml: `${teamA("epl", g.home)} v ${teamA("epl", g.away)}`,
        pick: `${g.pickName} ${pct(g.p)}`,
        pickName: g.pickName,
        light: g.light,
        modelP: g.p,
        marketP,
        value: valueOf(g.p, marketP),
        start_utc: g.start_utc,
      };
    });
    sections.push({
      id: "epl", name: "Premier League", games: games.map((g) => ({ ...g, sport: "epl" })),
      links: `<a href="/epl">All Premier League matches →</a> · <a href="/epl/team">Premier League teams →</a>`,
    });
  }

  {
    // Championship (live 7 Nov 2026): same file shape as the EPL; every pick has a light; no market comparison yet
    const [raw, grades] = await Promise.all([asset(ctx, "/data/championship-picks.json", []), asset(ctx, "/data/championship-grades.json", {})]);
    const gs = (Array.isArray(raw) ? raw : raw.games ?? []).map((g) => {
      const id = String(g.game_id ?? g.id);
      const ps = { home: Number(g.p_home), draw: Number(g.p_draw), away: Number(g.p_away) };
      const p = ps[g.pick];
      const gr = grades[id];
      const start = g.start_utc ?? g.kickoff_utc;
      return {
        id, start_utc: start, home: g.home, away: g.away, p, pick: g.pick,
        pickName: g.pick === "home" ? g.home : g.pick === "away" ? g.away : "Draw",
        light: p >= 0.55 ? "GREEN" : p >= 0.45 ? "ORANGE" : "RED",
        done: !!gr?.graded || g.status === "post" || new Date(start).getTime() < now - 3 * 3600e3,
      };
    });
    const upcoming = gs.filter((g) => !g.done && inWindow(g.start_utc, now)).sort((a, b) => a.start_utc.localeCompare(b.start_utc));
    total += upcoming.length;
    const games = upcoming.map((g) => ({
      key: `championship:${g.id}`,
      sportName: "Championship",
      href: `/championship#game-${g.id}`,
      when: tAEDT(g.start_utc) + " AEDT",
      match: `${g.home} v ${g.away}`,
      matchHtml: `${esc(g.home)} v ${esc(g.away)}`,
      pick: `${g.pickName} ${pct(g.p)}`,
      pickName: g.pickName,
      light: g.light,
      modelP: g.p,
      marketP: null,
      value: null,
      start_utc: g.start_utc,
    }));
    sections.push({
      id: "championship", name: "Championship", games: games.map((g) => ({ ...g, sport: "championship" })),
      links: `<a href="/championship">All Championship matches →</a>`,
    });
  }

  {
    // Tennis (live 7 Nov 2026): ATP and WTA main-draw singles; lights GREEN 70%+, ORANGE 60-70%, RED under 60%; no market comparison
    const feed = await asset(ctx, "/data/tennis-picks.json", null);
    const upcoming = (feed?.matches ?? []).filter((m) => m.status === "pre" && inWindow(m.start_utc, now)).sort((a, b) => a.start_utc.localeCompare(b.start_utc) || String(a.id).localeCompare(String(b.id)));
    total += upcoming.length;
    const games = upcoming.map((m) => {
      const pickName = m.pick === "a" ? m.player_a : m.player_b, p = Number(m.pick_pct) / 100;
      return {
        key: `tennis:${m.id}`,
        sportName: "Tennis",
        href: "/tennis",
        when: tAEDT(m.start_utc) + " AEDT",
        match: `${m.player_a} v ${m.player_b}`,
        matchHtml: `${esc(m.player_a)} v ${esc(m.player_b)}<br><small>${esc(m.tournament)} · ${esc(m.round)}</small>`,
        pick: `${pickName} ${pct(p)}`,
        pickName,
        light: m.light,
        modelP: p,
        marketP: null,
        value: null,
        start_utc: m.start_utc,
      };
    });
    sections.push({
      id: "tennis", name: "Tennis", games: games.map((g) => ({ ...g, sport: "tennis" })),
      links: `<a href="/tennis">All tennis matches →</a>`,
    });
  }

  let marketNote;
  if (!market.generated) {
    marketNote = "Market chances will appear once the on-box comparison files are synced.";
  } else if (!showMkt) {
    const when = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(market.generated));
    marketNote = `Odds as of ${esc(when)}. Market and value columns are hidden because that file is older than 24 hours.`;
  } else {
    const when = new Intl.DateTimeFormat("en-AU", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(market.generated));
    marketNote = `Odds as of ${esc(when)} from prices already on file (no live book lookup).`;
  }

  const available = new Set(sections.filter((s) => s.games && s.games.length).map((s) => s.id));
  const filteredSections = [];
  let shown = 0;
  for (const s of sections) {
    if (s.error) {
      if (filters.sport === "all" || filters.sport === s.id) {
        filteredSections.push(`<section class="panel" id="${s.id}"><h2>${esc(s.name)}</h2><p>We couldn't load ${esc(s.name)} games just now. Please refresh in a minute.</p></section>`);
      }
      continue;
    }
    if (filters.sport !== "all" && filters.sport !== s.id) continue;
    let games = (s.games || []).filter((g) => matchesLightFilter(g.light, filters.light));
    if (filters.light === "all") games = sortGreenFirst(games);
    shown += games.length;
    if (!games.length && filters.sport === "all" && filters.light !== "all") continue; // hide empty sports when colour-filtered
    filteredSections.push(section(s.id, s.name, games, s.links, games.length ? dayAEDT(games[0].start_utc) : null, showMkt));
  }

  const filterBar = renderFilterBar(filters, { basePath: "/today", availableSports: available.size ? available : null, showSuper: true });
  const anyGames = filteredSections.some((html) => html.includes("today-games") || html.includes("couldn't load"));
  const bodyList = anyGames ? filteredSections.join("\n") : emptyFilterMessage(filters, { basePath: "/today" });

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Today's games</span></nav>
  <p class="eyebrow">// next 24 hours · Australia/Sydney</p>
  <h1>Today's predictions: every sport</h1>
  <p>${total ? `${total} game${total === 1 ? "" : "s"} tip off in the next 24 hours.` : "No games tip off in the next 24 hours."}
  Filter by sport and light colour — same idea as the members desk. Default is Green + Best value, matching <a href="/results">Results</a>.</p>
  <nav class="crumbs" aria-label="Jump to sport"><a href="#nba">NBA</a> · <a href="#nfl">NFL</a> · <a href="#nhl">NHL</a> · <a href="#epl">Premier League</a> · <a href="#championship">Championship</a> · <a href="#tennis">Tennis</a> · <a href="/accuracy">Accuracy →</a></nav>
  ${HOW_TO}
  ${filterBar}
  ${bodyList}
  <p class="small">${marketNote}${market.gaps?.length ? ` Gaps: ${esc(market.gaps.join("; "))}.` : ""}</p>
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;

  return html(shell({
    title: "Today's Predictions: NBA, NFL, NHL, EPL, Championship & Tennis | ProbaLab",
    description: "Win chances, fair prices and value % for every NBA, NFL, NHL, Premier League, Championship and tennis match starting in the next 24 hours.",
    path: "/today",
    body,
  }), 200, 60);
}

export const onRequestHead = (ctx) => asHead(onRequestGet, ctx);
