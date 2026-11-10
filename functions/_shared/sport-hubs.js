// Lean sport landing pages for NHL, EPL and tennis — same “today + upcoming +
// recent + record” template as /nba and /nfl. The full SPA board stays at /{sport}/app.
import { shell, html, esc, chip, sportName, shortDay, gameRow } from "./site.js";
import { parseGameFilters, matchesLightFilter, sortGreenFirst, renderFilterBar, emptyFilterMessage } from "./game-filters.js";
import { loadSportRecord, lightTally, EPL_LIGHTS_FROM } from "./record-pages.js";
import { nhlDataFromFiles, eplDataFromFiles } from "./teams.js";

const asset = (ctx, p, d) => ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)).then((r) => (r.ok ? r.json() : d)).catch(() => d);

const FMTS = new Map();
const dayET = (iso) => {
  const k = "dayET";
  let f = FMTS.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat("en-AU", { timeZone: "America/New_York", weekday: "long", day: "numeric", month: "long", year: "numeric" });
    FMTS.set(k, f);
  }
  return f.format(new Date(iso));
};

const dayAEDT = (iso) => {
  const k = "dayAEDT";
  let f = FMTS.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "long", day: "numeric", month: "long", year: "numeric" });
    FMTS.set(k, f);
  }
  return f.format(new Date(iso));
};
const shortDayAEDT = (iso) => {
  const k = "shortDayAEDT";
  let f = FMTS.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short" });
    FMTS.set(k, f);
  }
  return f.format(new Date(iso));
};
const tennisDayLabel = (g) => {
  if (g.time_tbc) {
    return new Intl.DateTimeFormat("en-AU", { timeZone: "America/New_York", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(g.start_utc)) + " ET, time TBC";
  }
  return dayAEDT(g.start_utc);
};
const tennisShortDay = (g) => g.time_tbc
  ? new Intl.DateTimeFormat("en-AU", { timeZone: "America/New_York", weekday: "short", day: "numeric", month: "short" }).format(new Date(g.start_utc)) + ", time TBC"
  : shortDayAEDT(g.start_utc);

function tennisDataFromFile(feed) {
  const games = (feed?.matches ?? []).map((m) => {
    const id = String(m.id ?? m.game_id);
    const pickP = m.pick_pct != null ? (Number(m.pick_pct) > 1 ? Number(m.pick_pct) / 100 : Number(m.pick_pct)) : null;
    const pickName = m.pick === "a" ? m.player_a : m.pick === "b" ? m.player_b : m.pick_name ?? m.pick;
    const won = m.result === "won" ? true : m.result === "lost" ? false : (m.right == null ? null : !!m.right);
    const done = m.status === "post" || won != null;
    return {
      sport: "tennis",
      game_id: id,
      home: m.player_b,
      away: m.player_a,
      home_name: m.player_b,
      away_name: m.player_a,
      start_utc: m.start_utc,
      time_tbc: !!m.time_tbc,
      status: done ? "post" : (m.status === "in" ? "in" : "pre"),
      pick: pickName,
      pick_p: pickP,
      pick_name: pickName,
      light: m.light ?? null,
      won,
      path: `/tennis/app#game-${id}`,
      extra: [m.tournament, m.round].filter(Boolean).join(" · "),
    };
  });
  return { games, season: feed?.season ?? null };
}

async function loadHubData(ctx, sport) {
  if (sport === "nhl") {
    const [raw, pretip, season, grades] = await Promise.all([
      asset(ctx, "/data/nhl-picks.json", []),
      asset(ctx, "/data/nhl-pretip.json", {}),
      asset(ctx, "/data/nhl-season.json", { games: [] }),
      asset(ctx, "/data/nhl-grades.json", {}),
    ]);
    const data = nhlDataFromFiles(raw, pretip, season, grades);
    for (const g of data.games) if (g.game_id) g.path = `/nhl/app#game-${g.game_id}`;
    return data;
  }
  if (sport === "epl") {
    const [raw, grades, season] = await Promise.all([
      asset(ctx, "/data/epl-picks.json", []),
      asset(ctx, "/data/epl-grades.json", {}),
      asset(ctx, "/data/epl-season.json", { games: [] }),
    ]);
    const data = eplDataFromFiles(raw, grades, season);
    for (const g of data.games) {
      if (g.game_id) g.path = `/epl/app#game-${g.game_id}`;
      if (g.start_utc && g.start_utc < EPL_LIGHTS_FROM) g.light = null;
    }
    return data;
  }
  if (sport === "tennis") {
    const feed = await asset(ctx, "/data/tennis-picks.json", { matches: [] });
    return tennisDataFromFile(feed);
  }
  throw new Error(`no lean hub for ${sport}`);
}

const INTRO = {
  nhl: "Every NHL game gets a win probability from our model. Picks are posted before puck drop, update as injury news comes in, and are frozen at the start. Every result stays on the record.",
  epl: "Every Premier League match gets a home, draw and away chance from our model. Picks are posted before kick-off and frozen when the match starts. Every result stays on the record.",
  tennis: "Every ATP and WTA main-draw singles match gets a win chance from our model. Picks are posted before the first serve and frozen when the match starts. Every result stays on the record.",
};

const TITLE = {
  nhl: "NHL Predictions Today: Win Probabilities for Every Game | ProbaLab",
  epl: "Premier League Predictions: Home, Draw and Away Chances | ProbaLab",
  tennis: "Tennis Predictions Today: ATP and WTA Win Chances | ProbaLab",
};

const DESC = {
  nhl: "NHL predictions for every game: a win chance for each team, posted before puck drop, with every result on the record.",
  epl: "Premier League predictions for every match: home win, draw and away win chances, posted before kick-off, with every result on the record.",
  tennis: "Tennis predictions for every ATP and WTA main-draw match: a win chance for each player, posted before the first serve, with every result on the record.",
};

function soccerOrTennisRow(g) {
  const post = g.status === "post" && (g.home_score != null || g.won != null);
  const match = (g.sport === "epl" || g.sport === "championship" || g.sport === "tennis")
    ? (g.sport === "tennis"
      ? `${esc(g.away_name)} v ${esc(g.home_name)}${g.extra ? `<br><small>${esc(g.extra)}</small>` : ""}`
      : `${esc(g.home_name)} v ${esc(g.away_name)}`)
    : `${esc(g.away_name)} @ ${esc(g.home_name)}`;
  const result = post && g.pick
    ? (g.sport === "tennis"
      ? `<span class="r ${g.won ? "pos" : "neg"}">${g.won ? "✓" : "✕"}</span>`
      : `<span class="r ${g.won ? "pos" : "neg"}">${g.won ? "✓" : "✕"}${g.home_score != null ? ` ${g.away_score}–${g.home_score}` : ""}</span>`)
    : "";
  const when = g.sport === "tennis" ? tennisShortDay(g) : shortDay(g.start_utc);
  return `<li id="game-${esc(g.game_id)}"><a href="${esc(g.path)}"><span class="d">${esc(when)}</span><span class="m">${match}</span>
    <span class="p">${g.pick ? `${esc(g.pick_name || g.pick)} ${g.pick_p == null || !Number.isFinite(Number(g.pick_p)) ? "—" : `${Math.round(Number(g.pick_p) * 100)}%`}` : "soon"}</span>${chip(g.light)}${result}</a></li>`;
}

const rate = (xs) => (xs.length ? `${xs.filter((g) => g.won).length}–${xs.filter((g) => !g.won).length} (${Math.round((100 * xs.filter((g) => g.won).length) / xs.length)}%)` : "no results yet");
const isTip = (g) => g.light === "SUPER" || g.light === "GREEN";

export async function renderLeanHub(ctx, sport) {
  const S = sportName(sport);
  const data = await loadHubData(ctx, sport);
  const rec = await loadSportRecord(ctx, sport);
  const recRows = rec.error ? [] : (rec.rows || []);
  const gT = lightTally(recRows, "GREEN");
  const greenLine = gT.n
    ? `Green ${gT.w}–${gT.n - gT.w} (${Math.round((100 * gT.w) / gT.n)}%)`
    : "Green record starts with the first results";
  const filters = parseGameFilters(ctx.request.url, { defaultLight: "green" });
  const now = Date.now();
  const upcomingAll = data.games
    .filter((g) => g.pick && g.status !== "post" && new Date(g.start_utc).getTime() > now - 4 * 3600e3)
    .sort((a, b) => String(a.start_utc).localeCompare(String(b.start_utc)));
  let upcoming = upcomingAll.filter((g) => matchesLightFilter(g.light, filters.light));
  if (filters.light === "all") upcoming = sortGreenFirst(upcoming);
  const recent = data.games
    .filter((g) => g.pick && g.status === "post" && g.won != null)
    .sort((a, b) => String(b.start_utc).localeCompare(String(a.start_utc)))
    .slice(0, 30);
  const settled = recRows.length ? recRows : data.games.filter((g) => g.pick && g.status === "post" && g.won != null);
  const tips = settled.filter((g) => isTip(g) || g.light === "GREEN" || g.light === "SUPER");
  const groups = {};
  upcoming.forEach((g) => (groups[sport === "tennis" ? tennisDayLabel(g) : dayET(g.start_utc)] ??= []).push(g));
  const row = (g) => (sport === "nba" || sport === "nfl" ? gameRow(g) : soccerOrTennisRow(g));
  const filterBar = renderFilterBar(filters, {
    basePath: `/${sport}`,
    availableSports: new Set([sport]),
    showSport: false,
    showSuper: sport === "nba",
  });
  const dayBlocks = Object.keys(groups).map((d) => `<section class="panel"><h2>${esc(d)}</h2><ul class="games">${groups[d].map(row).join("")}</ul></section>`).join("");
  const list = dayBlocks || (upcomingAll.length ? emptyFilterMessage(filters, { basePath: `/${sport}` }) : `<section class="panel"><h2>No upcoming picks yet</h2><p>Picks appear before ${sport === "epl" ? "kick-off" : sport === "tennis" ? "the first serve" : "puck drop"}.</p></section>`);
  const recordBits = settled.length
    ? `Record so far: all picks ${rate(settled)}; top picks ${rate(tips)}.`
    : "Our record starts with the first results, and every pick stays on it, win or lose.";
  const bounce = `<script>(function(){var h=location.hash;if(h&&h.indexOf("#game-")===0)location.replace(${JSON.stringify("/" + sport + "/app")}+h);})();</script>`;
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>${S} predictions</span></nav>
  <p class="eyebrow">// ${S} · win predictions</p>
  <h1>${S} predictions</h1>
  <p>${INTRO[sport]}</p>
  <p class="record-hero green-hero"><a href="/results?sport=${sport}">${esc(greenLine)}</a></p>
  <p>${recordBits} <a href="/${sport}/results">Full record →</a>${sport === "tennis" ? "" : ` · <a href="/${sport}/team">All ${S} teams →</a>`} · <a href="/today">Today's games →</a></p>
  ${filterBar}
  ${list}
  ${recent.length ? `<section class="panel"><h2>Recent results</h2><ul class="games">${recent.map(row).join("")}</ul></section>` : ""}
  <p class="cta"><a class="btn" href="/${sport}/app">Open the full ${S} board →</a></p>
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>
  ${bounce}`;
  const listed = [...upcoming, ...recent].slice(0, 40);
  const jsonld = {
    "@context": "https://schema.org", "@type": "CollectionPage",
    name: `${S} predictions`, url: `https://probalabsports.com/${sport}`, description: DESC[sport],
    mainEntity: {
      "@type": "ItemList", numberOfItems: listed.length,
      itemListElement: listed.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: `https://probalabsports.com${g.path}`, name: `${g.away_name} vs ${g.home_name} prediction` })),
    },
  };
  return shell({ title: TITLE[sport], description: DESC[sport], path: `/${sport}`, body, jsonld });
}
