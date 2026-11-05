// Team pages: /{sport}/team and /{sport}/team/{slug}
 // Built entirely from the live feed (NBA/NFL) or /data JSON (NHL/EPL). No manual steps.
import {
  ORIGIN, NBA_TEAMS, slug, esc, pct, chip, shell, shortDay, signupMain, sportName, records,
} from "./site.js";

const NHL_TEAMS = {
  ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres", CGY: "Calgary Flames",
  CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks", COL: "Colorado Avalanche",
  CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars", DET: "Detroit Red Wings",
  EDM: "Edmonton Oilers", FLA: "Florida Panthers", LAK: "Los Angeles Kings",
  MIN: "Minnesota Wild", MTL: "Montréal Canadiens", NSH: "Nashville Predators",
  NJD: "New Jersey Devils", NYI: "New York Islanders", NYR: "New York Rangers",
  OTT: "Ottawa Senators", PHI: "Philadelphia Flyers", PIT: "Pittsburgh Penguins",
  SJS: "San Jose Sharks", SEA: "Seattle Kraken", STL: "St. Louis Blues",
  TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs", UTA: "Utah Mammoth",
  VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights", WSH: "Washington Capitals",
  WPG: "Winnipeg Jets",
};

const fair = (p) => (p == null || !Number.isFinite(p) || p <= 0 ? "—" : (1 / p).toFixed(2));

export const teamSlug = (name) => slug(name);
export const teamPath = (sport, name) => `/${sport}/team/${teamSlug(name)}`;
export const teamLink = (sport, abbr, name) =>
  `<a class="team-link" href="${esc(teamPath(sport, name))}"><span class="ab">${esc(abbr)}</span>${esc(name)}</a>`;

/** Build { abbr, name } list for a sport from feed/data. */
export function listTeams(sport, data) {
  if (sport === "nba") {
    return Object.entries(NBA_TEAMS).map(([abbr, name]) => ({ abbr, name, slug: teamSlug(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sport === "nfl") {
    const fromFeed = (data.teams || []).map(([abbr, name]) => ({ abbr, name, slug: teamSlug(name) }));
    if (fromFeed.length) return fromFeed.sort((a, b) => a.name.localeCompare(b.name));
    // fallback from games
    const map = {};
    for (const g of data.games || []) {
      map[g.home] = g.home_name || g.home;
      map[g.away] = g.away_name || g.away;
    }
    return Object.entries(map).map(([abbr, name]) => ({ abbr, name, slug: teamSlug(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sport === "nhl") {
    return Object.entries(NHL_TEAMS).map(([abbr, name]) => ({ abbr, name, slug: teamSlug(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sport === "epl") {
    const map = {};
    for (const g of data.games || []) {
      if (g.home) map[g.home] = g.home;
      if (g.away) map[g.away] = g.away;
    }
    return Object.keys(map).sort().map((name) => ({ abbr: name.slice(0, 3).toUpperCase(), name, slug: teamSlug(name) }));
  }
  return [];
}

/** Resolve a URL slug to a team; allow unique nickname aliases (e.g. lakers). */
export function resolveTeamSlug(sport, data, raw) {
  const teams = listTeams(sport, data);
  const want = teamSlug(raw);
  const exact = teams.find((t) => t.slug === want);
  if (exact) return { team: exact };
  // unique last-word alias: "lakers" -> Los Angeles Lakers
  const byNick = new Map();
  for (const t of teams) {
    const nick = teamSlug(t.name.split(/\s+/).pop());
    if (!nick) continue;
    if (byNick.has(nick)) byNick.set(nick, null); // not unique
    else byNick.set(nick, t);
  }
  const alias = byNick.get(want);
  if (alias) return { team: alias, redirect: teamPath(sport, alias.name) };
  return null;
}

function seasonRecord(data, abbrOrName, sport) {
  const games = (data.games || []).filter((g) => !(sport === "nfl" && (g.game_type ?? "REG") !== "REG"));
  const rec = records(games);
  // records() keys by abbr for nba/nfl
  if (sport === "epl") {
    let w = 0, d = 0, l = 0;
    for (const g of data.games || []) {
      if (g.status !== "post" || g.home_score == null) continue;
      if (g.home !== abbrOrName && g.away !== abbrOrName) continue;
      if (g.home_score === g.away_score) d++;
      else if ((g.home === abbrOrName && g.home_score > g.away_score) || (g.away === abbrOrName && g.away_score > g.home_score)) w++;
      else l++;
    }
    return { w, l, t: d, str: d ? `${w}–${d}–${l}` : `${w}–${l}` };
  }
  const key = abbrOrName;
  const r = rec[key];
  if (!r) {
    // try match by name for nhl data shaped differently
    let w = 0, l = 0, t = 0;
    for (const g of games) {
      if (g.status !== "post" || g.home_score == null) continue;
      const involves = g.home === key || g.away === key || g.home_name === key || g.away_name === key;
      if (!involves) continue;
      if (g.home_score === g.away_score) t++;
      else {
        const homeWin = g.home_score > g.away_score;
        const weHome = g.home === key || g.home_name === key;
        if (homeWin === weHome) w++; else l++;
      }
    }
    return { w, l, t, str: t ? `${w}–${l}–${t}` : `${w}–${l}` };
  }
  return { ...r, str: r.t ? `${r.w}–${r.l}–${r.t}` : `${r.w}–${r.l}` };
}

function recentForm(data, team, n = 10) {
  const rows = (data.games || [])
    .filter((g) => !(g.sport === "nfl" && (g.game_type ?? "REG") !== "REG"))
    .filter((g) => g.status === "post" && g.home_score != null && (g.home === team.abbr || g.away === team.abbr || g.home === team.name || g.away === team.name || g.home_name === team.name || g.away_name === team.name))
    .sort((a, b) => b.start_utc.localeCompare(a.start_utc))
    .slice(0, n);
  return rows.map((g) => {
    const weHome = g.home === team.abbr || g.home === team.name || g.home_name === team.name;
    const us = weHome ? g.home_score : g.away_score;
    const them = weHome ? g.away_score : g.home_score;
    const oppAbbr = weHome ? g.away : g.home;
    const oppName = weHome ? (g.away_name || g.away) : (g.home_name || g.home);
    const win = us > them, draw = us === them;
    return {
      g, weHome, us, them, oppAbbr, oppName, win, draw,
      result: draw ? "D" : win ? "W" : "L",
      when: shortDay(g.start_utc),
      href: g.path || null,
    };
  });
}

function modelRecordOnTeam(data, team) {
  // Picks involving this team that are graded
  const rows = (data.games || []).filter((g) => {
    if (g.sport === "nfl" && (g.game_type ?? "REG") !== "REG") return false;
    if (!g.pick || g.status !== "post" || g.won == null) return false;
    return g.home === team.abbr || g.away === team.abbr || g.home === team.name || g.away === team.name
      || g.home_name === team.name || g.away_name === team.name;
  });
  const onThem = [], against = [];
  for (const g of rows) {
    const teamIsHome = g.home === team.abbr || g.home === team.name || g.home_name === team.name;
    const teamSide = teamIsHome ? g.home : g.away;
    const pickedThem = g.pick === teamSide || g.pick_name === team.name || g.pick === team.abbr;
    const bucket = pickedThem ? onThem : against;
    bucket.push(g);
  }
  const sum = (xs) => {
    const w = xs.filter((g) => g.won).length;
    return { n: xs.length, w, l: xs.length - w, rate: xs.length ? w / xs.length : null };
  };
  return { onThem: sum(onThem), against: sum(against), all: sum(rows), rows };
}

function teamWinChance(g, team) {
  // Probability the named team wins (EPL: that side; 2-way: pick_p or 1-pick_p)
  const teamIsHome = g.home === team.abbr || g.home === team.name || g.home_name === team.name;
  const teamSide = teamIsHome ? (g.home) : (g.away);
  if (g.sport === "epl" || g.p_home != null) {
    if (g.pick === "draw" && false) {}
    const ph = Number(g.p_home), pa = Number(g.p_away), pd = Number(g.p_draw);
    if (teamIsHome && Number.isFinite(ph)) return ph;
    if (!teamIsHome && Number.isFinite(pa)) return pa;
  }
  if (g.pick_p == null) return null;
  const pickedThem = g.pick === teamSide || g.pick === team.abbr || g.pick_name === team.name;
  return pickedThem ? Number(g.pick_p) : 1 - Number(g.pick_p);
}

function upcomingFor(data, team) {
  const now = Date.now();
  return (data.games || [])
    .filter((g) => g.status !== "post" && new Date(g.start_utc).getTime() > now - 3 * 3600e3)
    .filter((g) => g.home === team.abbr || g.away === team.abbr || g.home === team.name || g.away === team.name
      || g.home_name === team.name || g.away_name === team.name)
    .sort((a, b) => a.start_utc.localeCompare(b.start_utc));
}

function injuriesFor(data, team) {
  // Prefer the next upcoming game's injury list for this side
  const up = upcomingFor(data, team);
  for (const g of up) {
    const d = g.detail || {};
    const teamIsHome = g.home === team.abbr || g.home_name === team.name;
    const arr = teamIsHome ? d.missing_home : d.missing_away;
    if (Array.isArray(arr) && arr.length) {
      return arr.filter((m) => Number(m.min ?? 0) >= 10 || m.status).slice(0, 12);
    }
  }
  // fall back: any recent game with injury detail
  for (const g of (data.games || []).slice().sort((a, b) => b.start_utc.localeCompare(a.start_utc))) {
    if (!(g.home === team.abbr || g.away === team.abbr || g.home_name === team.name || g.away_name === team.name)) continue;
    const d = g.detail || {};
    const teamIsHome = g.home === team.abbr || g.home_name === team.name;
    const arr = teamIsHome ? d.missing_home : d.missing_away;
    if (Array.isArray(arr) && arr.length) return arr.filter((m) => Number(m.min ?? 0) >= 10 || m.status).slice(0, 12);
  }
  return null; // null = no data available (gap); [] would mean "none listed"
}

function formHtml(form) {
  if (!form.length) return `<p>No finished games yet this season.</p>`;
  const seq = form.map((x) => `<span class="form-${x.result.toLowerCase()}" title="${esc(x.when)} ${x.weHome ? "vs" : "@"} ${esc(x.oppName)} ${x.us}–${x.them}">${x.result}</span>`).join(" ");
  const list = form.map((x) => {
    const label = `${x.when}: ${x.result} ${x.us}–${x.them} ${x.weHome ? "vs" : "@"} ${esc(x.oppName)}`;
    return x.href ? `<li><a href="${esc(x.href)}">${label}</a></li>` : `<li>${label}</li>`;
  }).join("");
  return `<p class="form-strip" aria-label="Recent results">${seq}</p><ul class="games">${list}</ul>`;
}

export function renderTeamIndex(sport, data) {
  const S = sportName(sport);
  const teams = listTeams(sport, data);
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/${sport}">${esc(S)}</a> › <span>Teams</span></nav>
  <p class="eyebrow">// ${esc(S)} · teams</p>
  <h1>${esc(S)} teams</h1>
  <p>Every ${esc(S)} team with its season record, recent form, ProbaLab's record on their games, and upcoming predictions.</p>
  <section class="panel"><ul class="team-index">${teams.map((t) => {
    const rec = seasonRecord(data, sport === "epl" ? t.name : t.abbr, sport);
    return `<li><a href="${esc(teamPath(sport, t.name))}"><span class="ab">${esc(t.abbr)}</span><span class="nm">${esc(t.name)}</span><span class="rec">${esc(rec.str)}</span></a></li>`;
  }).join("")}</ul></section>
  ${signupMain("teams-" + sport)}
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;
  return shell({
    title: `${S} Teams: Predictions and ProbaLab Records | ProbaLab`,
    description: `Team-by-team ${S} predictions, season records and ProbaLab's results on every side.`,
    path: `/${sport}/team`,
    body,
    signup: false,
  });
}

export function renderTeamPage(sport, data, team) {
  const S = sportName(sport);
  const rec = seasonRecord(data, sport === "epl" ? team.name : team.abbr, sport);
  const form = recentForm(data, team, 10);
  const model = modelRecordOnTeam(data, team);
  const up = upcomingFor(data, team);
  const injuries = injuriesFor(data, team);
  const rate = (x) => (x.n ? `${x.w}–${x.l} (${pct(x.rate)})` : "no graded picks yet");

  const upRows = up.length ? up.map((g) => {
    const teamIsHome = g.home === team.abbr || g.home === team.name || g.home_name === team.name;
    const opp = teamIsHome ? (g.away_name || g.away) : (g.home_name || g.home);
    const chance = teamWinChance(g, team);
    const href = g.path || `#`;
    const pickedThem = g.pick === (teamIsHome ? g.home : g.away) || g.pick_name === team.name || g.pick === team.abbr;
    return `<li><a href="${esc(href)}">
      <span class="d">${esc(shortDay(g.start_utc))}</span>
      <span class="m">${teamIsHome ? "vs" : "@"} ${esc(opp)}</span>
      <span class="p">${chance == null ? "soon" : `${pct(chance)}${pickedThem ? " · our pick" : ""}`}</span>
      ${chip(g.light)}
      <span class="fp" title="Fair price = 1 ÷ win chance">${esc(fair(chance))}</span>
    </a></li>`;
  }).join("") : "";

  const injHtml = injuries == null
    ? `<p class="small">Injury notes are not on file for this team right now.</p>`
    : !injuries.length
      ? `<p>No regulars on the injury report in the latest game file.</p>`
      : `<ul>${injuries.map((m) => `<li><b>${esc(m.player)}</b> · ${esc(m.status || "listed")}${m.min != null ? ` · ${Math.round(m.min)} min a game` : ""}</li>`).join("")}</ul>`;

  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/${sport}">${esc(S)}</a> › <a href="/${sport}/team">Teams</a> › <span>${esc(team.name)}</span></nav>
  <p class="eyebrow">// ${esc(S)} · ${esc(team.abbr)}</p>
  <h1>${esc(team.name)}</h1>
  <p>Season record <b>${esc(rec.str)}</b>. Predictions, form and ProbaLab's results on games involving ${esc(team.name)}.</p>

  <section class="panel"><h2>Recent form</h2>${formHtml(form)}</section>

  <section class="panel"><h2>ProbaLab record on ${esc(team.name)}</h2>
    <ul>
      <li>All graded games involving them: <b>${rate(model.all)}</b></li>
      <li>When we picked them: <b>${rate(model.onThem)}</b></li>
      <li>When we picked the other side: <b>${rate(model.against)}</b></li>
    </ul>
    <p class="small">Same graded set as the <a href="/${sport}/record">${esc(S)} record</a> page.</p>
  </section>

  <section class="panel"><h2>Upcoming</h2>
    ${up.length ? `<ul class="games today-games team-upcoming"><li class="head" aria-hidden="true"><span class="d">When</span><span class="m">Match</span><span class="p">Win chance</span><span class="chip-slot"></span><span class="fp">Fair</span></li>${upRows}</ul>` : `<p>No upcoming ${esc(S)} games on the schedule yet.</p>`}
  </section>

  <section class="panel"><h2>Injuries</h2>${injHtml}</section>

  ${signupMain("team-" + sport)}
  <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;

  const title = `${team.name} predictions & ProbaLab record | ProbaLab`;
  const description = `${team.name} season record ${rec.str}, recent form, upcoming win chances and ProbaLab's results on their games.`;
  return shell({
    title,
    description,
    path: teamPath(sport, team.name),
    body,
    signup: false,
    jsonld: {
      "@context": "https://schema.org",
      "@type": "SportsTeam",
      name: team.name,
      url: ORIGIN + teamPath(sport, team.name),
      sport: S,
    },
  });
}

/** Normalise NHL/EPL raw files into a gamesOf-like shape for team pages. */
export function nhlDataFromFiles(picks, pretip) {
  const SN = pretip?.games ?? {};
  const games = (Array.isArray(picks) ? picks : picks?.games ?? []).map((g) => {
    const id = String(g.game_id ?? g.id);
    const sn = SN[id];
    const pc = (v) => (v == null ? null : Number(v) > 1 ? Number(v) / 100 : Number(v));
    const ph = pc(g.p_home ?? g.home_pct), pa = pc(g.p_away ?? g.away_pct);
    const pickHome = sn ? sn.pick === g.home : g.pick === "home" || g.pick === g.home;
    const pick = pickHome ? g.home : g.away;
    const pick_p = sn ? Number(sn.pick_p) : pickHome ? ph : pa;
    const start = g.start_utc ?? g.puck_drop_utc ?? g.date;
    const won = sn && typeof sn.won === "boolean" ? sn.won : null;
    const done = won != null || g.status === "post" || g.home_score != null;
    return {
      sport: "nhl", game_id: id, home: g.home, away: g.away,
      home_name: NHL_TEAMS[g.home] ?? g.home, away_name: NHL_TEAMS[g.away] ?? g.away,
      home_score: g.home_score ?? sn?.home_score ?? null,
      away_score: g.away_score ?? sn?.away_score ?? null,
      start_utc: start, status: done ? "post" : "pre",
      pick, pick_p, pick_name: NHL_TEAMS[pick] ?? pick,
      light: sn?.light ?? (pick_p >= 0.65 ? "GREEN" : pick_p >= 0.55 ? "ORANGE" : "RED"),
      won, path: `/nhl#game-${id}`, detail: g.detail || null,
    };
  });
  return { games, season: 2027, teams: Object.entries(NHL_TEAMS).map(([a, n]) => [a, n]) };
}

export function eplDataFromFiles(picks, grades) {
  const games = (Array.isArray(picks) ? picks : picks?.games ?? []).map((g) => {
    const id = String(g.game_id ?? g.id);
    const gr = grades?.[id];
    const start = g.start_utc ?? g.kickoff_utc;
    const pickSide = g.pick; // home|draw|away
    const pick_p = pickSide === "home" ? Number(g.p_home) : pickSide === "away" ? Number(g.p_away) : Number(g.p_draw);
    const pick = pickSide === "home" ? g.home : pickSide === "away" ? g.away : "Draw";
    const done = !!(gr?.graded) || g.status === "post";
    return {
      sport: "epl", game_id: id, home: g.home, away: g.away,
      home_name: g.home, away_name: g.away,
      home_score: g.home_score ?? gr?.home_score ?? null,
      away_score: g.away_score ?? gr?.away_score ?? null,
      start_utc: start, status: done ? "post" : "pre",
      pick, pick_p, pick_name: pick, p_home: g.p_home, p_away: g.p_away, p_draw: g.p_draw,
      light: g.light ?? (pick_p >= 0.55 ? "GREEN" : pick_p >= 0.45 ? "ORANGE" : "RED"),
      won: gr?.graded ? !!gr.correct : null,
      path: `/epl#game-${id}`, detail: null,
    };
  });
  return { games, season: 2027, teams: [] };
}

export { NHL_TEAMS };
