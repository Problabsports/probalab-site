// Team pages: /{sport}/team and /{sport}/team/{slug}
// Built from the live feed (NBA/NFL) or /data JSON (NHL/EPL) plus season-result files.
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

const NBA_EAST = new Set(["ATL","BOS","BKN","CHA","CHI","CLE","DET","IND","MIA","MIL","NY","ORL","PHI","TOR","WSH"]);
const NHL_EAST = new Set(["BOS","BUF","CAR","CBJ","DET","FLA","MTL","NJD","NYI","NYR","OTT","PHI","PIT","TBL","TOR","WSH"]);

const NFL_DIV = {
  BUF:"AFC East", MIA:"AFC East", NE:"AFC East", NYJ:"AFC East",
  BAL:"AFC North", CIN:"AFC North", CLE:"AFC North", PIT:"AFC North",
  HOU:"AFC South", IND:"AFC South", JAX:"AFC South", TEN:"AFC South",
  DEN:"AFC West", KC:"AFC West", LV:"AFC West", LAC:"AFC West",
  DAL:"NFC East", NYG:"NFC East", PHI:"NFC East", WAS:"NFC East", WSH:"NFC East",
  CHI:"NFC North", DET:"NFC North", GB:"NFC North", MIN:"NFC North",
  ATL:"NFC South", CAR:"NFC South", NO:"NFC South", TB:"NFC South",
  ARI:"NFC West", LAR:"NFC West", LA:"NFC West", SF:"NFC West", SEA:"NFC West",
};

const fair = (p) => (p == null || !Number.isFinite(p) || p <= 0 ? "—" : (1 / p).toFixed(2));
const ord = (n) => (!n ? "—" : n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
const sgn = (x, d = 1) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(d)}`;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const wlS = (w, l) => `${w}–${l}`;
const wlt = (w, l, t) => (t ? `${w}–${l}–${t}` : `${w}–${l}`);

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
  const byNick = new Map();
  for (const t of teams) {
    const nick = teamSlug(t.name.split(/\s+/).pop());
    if (!nick) continue;
    if (byNick.has(nick)) byNick.set(nick, null);
    else byNick.set(nick, t);
  }
  const alias = byNick.get(want);
  if (alias) return { team: alias, redirect: teamPath(sport, alias.name) };
  return null;
}

function involves(g, team) {
  return g.home === team.abbr || g.away === team.abbr || g.home === team.name || g.away === team.name
    || g.home_name === team.name || g.away_name === team.name;
}
function weHome(g, team) {
  return g.home === team.abbr || g.home === team.name || g.home_name === team.name;
}
function finished(g, sport) {
  if (sport === "nfl" && (g.game_type ?? "REG") !== "REG") return false;
  return g.status === "post" && g.home_score != null && g.away_score != null;
}

function seasonRecord(data, abbrOrName, sport) {
  const games = (data.games || []).filter((g) => finished(g, sport));
  if (sport === "epl") {
    let w = 0, d = 0, l = 0;
    for (const g of games) {
      if (g.home !== abbrOrName && g.away !== abbrOrName) continue;
      if (g.home_score === g.away_score) d++;
      else if ((g.home === abbrOrName && g.home_score > g.away_score) || (g.away === abbrOrName && g.away_score > g.home_score)) w++;
      else l++;
    }
    return { w, l, t: d, str: `${w}–${d}–${l}` };
  }
  if (sport === "nhl") {
    let w = 0, l = 0, otl = 0;
    for (const g of games) {
      if (g.home !== abbrOrName && g.away !== abbrOrName) continue;
      const homeWin = g.home_score > g.away_score;
      const weAreHome = g.home === abbrOrName;
      const won = homeWin === weAreHome;
      if (won) w++;
      else if ((g.result_type === "OT" || g.result_type === "SO")) otl++;
      else l++;
    }
    return { w, l, t: otl, str: `${w}–${l}–${otl}` };
  }
  const rec = records(games.map((g) => ({ ...g, sport })));
  const r = rec[abbrOrName];
  if (!r) {
    let w = 0, l = 0, t = 0;
    for (const g of games) {
      if (g.home !== abbrOrName && g.away !== abbrOrName && g.home_name !== abbrOrName && g.away_name !== abbrOrName) continue;
      if (g.home_score === g.away_score) t++;
      else {
        const homeWin = g.home_score > g.away_score;
        const weAreHome = g.home === abbrOrName || g.home_name === abbrOrName;
        if (homeWin === weAreHome) w++; else l++;
      }
    }
    return { w, l, t, str: t ? `${w}–${l}–${t}` : `${w}–${l}` };
  }
  return { ...r, str: r.t ? `${r.w}–${r.l}–${r.t}` : `${r.w}–${r.l}` };
}

function recentForm(data, team, sport, n = 10) {
  const rows = (data.games || [])
    .filter((g) => finished(g, sport) && involves(g, team))
    .sort((a, b) => b.start_utc.localeCompare(a.start_utc))
    .slice(0, n);
  return rows.map((g) => {
    const home = weHome(g, team);
    const us = home ? g.home_score : g.away_score;
    const them = home ? g.away_score : g.home_score;
    const oppAbbr = home ? g.away : g.home;
    const oppName = home ? (g.away_name || g.away) : (g.home_name || g.home);
    const win = us > them, draw = us === them;
    // NHL regulation loss vs OT/SO loss: still show L for form strip simplicity, note OT in list
    const ot = sport === "nhl" && !win && !draw && (g.result_type === "OT" || g.result_type === "SO");
    return {
      g, weHome: home, us, them, oppAbbr, oppName, win, draw, ot,
      result: draw ? "D" : win ? "W" : "L",
      when: shortDay(g.start_utc),
      href: g.path || null,
      note: ot ? g.result_type : null,
    };
  });
}

function modelRecordOnTeam(data, team) {
  const rows = (data.games || []).filter((g) => {
    if (g.sport === "nfl" && (g.game_type ?? "REG") !== "REG") return false;
    if (!g.pick || g.status !== "post" || g.won == null) return false;
    return involves(g, team);
  });
  const onThem = [], against = [];
  for (const g of rows) {
    const teamIsHome = weHome(g, team);
    const teamSide = teamIsHome ? g.home : g.away;
    const pickedThem = g.pick === teamSide || g.pick_name === team.name || g.pick === team.abbr;
    (pickedThem ? onThem : against).push(g);
  }
  const sum = (xs) => {
    const w = xs.filter((g) => g.won).length;
    return { n: xs.length, w, l: xs.length - w, rate: xs.length ? w / xs.length : null };
  };
  return { onThem: sum(onThem), against: sum(against), all: sum(rows), rows };
}

function teamWinChance(g, team) {
  const teamIsHome = weHome(g, team);
  const teamSide = teamIsHome ? g.home : g.away;
  if (g.sport === "epl" || g.p_home != null) {
    const ph = Number(g.p_home), pa = Number(g.p_away);
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
    .filter((g) => involves(g, team))
    .sort((a, b) => a.start_utc.localeCompare(b.start_utc));
}

function injuriesFor(data, team) {
  const up = upcomingFor(data, team);
  for (const g of up) {
    const d = g.detail || {};
    const arr = weHome(g, team) ? d.missing_home : d.missing_away;
    if (Array.isArray(arr) && arr.length) {
      return arr.filter((m) => Number(m.min ?? 0) >= 10 || m.status).slice(0, 12);
    }
  }
  for (const g of (data.games || []).slice().sort((a, b) => b.start_utc.localeCompare(a.start_utc))) {
    if (!involves(g, team)) continue;
    const d = g.detail || {};
    const arr = weHome(g, team) ? d.missing_home : d.missing_away;
    if (Array.isArray(arr) && arr.length) return arr.filter((m) => Number(m.min ?? 0) >= 10 || m.status).slice(0, 12);
  }
  return null;
}

function formHtml(form) {
  if (!form.length) return `<p>No finished games yet this season.</p>`;
  const seq = form.map((x) => `<span class="form-${x.result.toLowerCase()}" title="${esc(x.when)} ${x.weHome ? "vs" : "@"} ${esc(x.oppName)} ${x.us}–${x.them}${x.note ? " " + x.note : ""}">${x.result}</span>`).join(" ");
  return `<p class="form-strip" aria-label="Recent results">${seq}</p>`;
}

/** League-wide per-team aggregates from finished games (for ranks). */
function leagueTable(sport, data) {
  const teams = listTeams(sport, data);
  const by = {};
  for (const t of teams) {
    const mapKey = sport === "epl" ? t.name : t.abbr;
    by[mapKey] = {
      key: mapKey,
      name: t.name, abbr: t.abbr,
      w: 0, l: 0, t: 0, pf: 0, pa: 0, gp: 0,
      hw: 0, hl: 0, ht: 0, aw: 0, al: 0, at: 0,
      res: [], pts: 0, // EPL points
      cs: 0, btts: 0, // EPL clean sheets / both teams scored
      otw: 0, otl: 0, // NHL OT/SO
    };
  }
  const keyOf = (abbr, name) => {
    if (sport === "epl") return name || abbr;
    return abbr;
  };
  for (const g of (data.games || []).filter((x) => finished(x, sport)).slice().sort((a, b) => a.start_utc.localeCompare(b.start_utc))) {
    const hk = keyOf(g.home, g.home_name || g.home);
    const ak = keyOf(g.away, g.away_name || g.away);
    const H = by[hk] || by[g.home] || by[g.home_name];
    const A = by[ak] || by[g.away] || by[g.away_name];
    if (!H || !A) continue;
    const hs = g.home_score, as_ = g.away_score;
    H.pf += hs; H.pa += as_; A.pf += as_; A.pa += hs; H.gp++; A.gp++;
    if (sport === "epl") {
      if (hs === as_) { H.t++; A.t++; H.ht++; A.at++; H.pts += 1; A.pts += 1; H.res.push("D"); A.res.push("D"); }
      else if (hs > as_) { H.w++; A.l++; H.hw++; A.al++; H.pts += 3; H.res.push("W"); A.res.push("L"); }
      else { A.w++; H.l++; A.aw++; H.hl++; A.pts += 3; A.res.push("W"); H.res.push("L"); }
      if (as_ === 0) H.cs++;
      if (hs === 0) A.cs++;
      if (hs > 0 && as_ > 0) { H.btts++; A.btts++; }
    } else if (sport === "nhl") {
      const homeWin = hs > as_;
      const ot = g.result_type === "OT" || g.result_type === "SO";
      if (homeWin) {
        H.w++; H.hw++; H.res.push("W");
        if (ot) { A.otl++; A.at++; A.res.push("L"); A.t++; }
        else { A.l++; A.al++; A.res.push("L"); }
      } else {
        A.w++; A.aw++; A.res.push("W");
        if (ot) { H.otl++; H.ht++; H.res.push("L"); H.t++; }
        else { H.l++; H.hl++; H.res.push("L"); }
      }
    } else {
      // NBA / NFL (ties rare in NFL)
      if (hs === as_) { H.t++; A.t++; H.ht++; A.at++; H.res.push("T"); A.res.push("T"); }
      else if (hs > as_) { H.w++; A.l++; H.hw++; A.al++; H.res.push("W"); A.res.push("L"); }
      else { A.w++; H.l++; A.aw++; H.hl++; A.res.push("W"); H.res.push("L"); }
    }
  }
  const rows = Object.values(by).filter((r) => r.gp).map((r) => {
    const cur = r.res[r.res.length - 1]; let k = 0;
    for (let i = r.res.length - 1; i >= 0 && r.res[i] === cur; i--) k++;
    const pctWin = sport === "epl" ? (r.gp ? r.pts / (r.gp * 3) : 0)
      : sport === "nhl" ? (r.gp ? (2 * r.w + r.t) / (2 * r.gp) : 0) // rough for ranking
      : (r.gp ? (r.w + r.t / 2) / r.gp : 0);
    return {
      ...r,
      ppg: r.pf / r.gp, oppg: r.pa / r.gp, diff: (r.pf - r.pa) / r.gp,
      pct: pctWin,
      streak: cur ? cur + k : "–",
      sk: k * (cur === "W" ? 1 : cur === "D" || cur === "T" ? 0 : -1),
      l10: r.res.slice(-10),
      gd: r.pf - r.pa,
    };
  });
  if (sport === "epl") rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.pf - a.pf);
  else if (sport === "nhl") rows.sort((a, b) => (b.w * 2 + b.t) - (a.w * 2 + a.t) || b.diff - a.diff);
  else rows.sort((a, b) => b.pct - a.pct || b.diff - a.diff);
  return rows;
}

function teamProfile(sport, data, team) {
  const all = leagueTable(sport, data);
  const key = sport === "epl" ? team.name : team.abbr;
  const r = all.find((x) => x.key === key || x.abbr === team.abbr || x.name === team.name);
  if (!r || !r.gp) return null;
  const gs = (data.games || []).filter((g) => finished(g, sport) && involves(g, team))
    .sort((a, b) => b.start_utc.localeCompare(a.start_utc));
  const mine = (g) => (weHome(g, team) ? [g.home_score, g.away_score] : [g.away_score, g.home_score]);
  const m = gs.map(mine);
  const tot = gs.map((g) => g.home_score + g.away_score);
  const played = all.filter((x) => x.gp);
  const rankBy = (fn, asc = false) => {
    const sorted = played.slice().sort((a, b) => (asc ? fn(a) - fn(b) : fn(b) - fn(a)));
    return sorted.findIndex((x) => x.key === r.key) + 1;
  };

  let groupLabel = "league", groupRank = played.findIndex((x) => x.key === r.key) + 1, groupN = played.length;
  if (sport === "nba") {
    const conf = all.filter((x) => NBA_EAST.has(x.abbr) === NBA_EAST.has(team.abbr));
    groupRank = conf.findIndex((x) => x.key === r.key) + 1;
    groupLabel = NBA_EAST.has(team.abbr) ? "East" : "West";
    groupN = conf.length;
  } else if (sport === "nfl") {
    const divName = (data.divByAbbr && data.divByAbbr[team.abbr]) || NFL_DIV[team.abbr] || "Division";
    const div = all.filter((x) => ((data.divByAbbr && data.divByAbbr[x.abbr]) || NFL_DIV[x.abbr]) === divName);
    groupRank = div.findIndex((x) => x.key === r.key) + 1;
    groupLabel = divName;
    groupN = div.length;
  } else if (sport === "nhl") {
    const conf = all.filter((x) => NHL_EAST.has(x.abbr) === NHL_EAST.has(team.abbr));
    groupRank = conf.findIndex((x) => x.key === r.key) + 1;
    groupLabel = NHL_EAST.has(team.abbr) ? "East" : "West";
    groupN = conf.length;
  }

  const closeMargin = sport === "nba" ? 5 : sport === "nfl" ? 8 : 1;
  const bigMargin = sport === "nba" ? 11 : sport === "nfl" ? 14 : sport === "nhl" ? 3 : 2;
  const close = m.filter(([f, a]) => Math.abs(f - a) <= closeMargin && f !== a);
  const lN = sport === "nfl" ? 5 : 7;
  const lSlice = r.res.slice(-lN);
  const hiThresh = sport === "nba" ? 230 : sport === "nfl" ? 55 : sport === "nhl" ? 7 : 4;

  return {
    r, gs, tot, m, groupLabel, groupRank, groupN, n: played.length,
    rPpg: rankBy((x) => x.ppg), rOppg: rankBy((x) => x.oppg, true), rDiff: rankBy((x) => x.diff),
    lNw: lSlice.filter((x) => x === "W").length, lNn: lSlice.length, lN,
    cw: close.filter(([f, a]) => f > a).length, cl: close.filter(([f, a]) => f < a).length,
    big: m.filter(([f, a]) => f - a >= bigMargin).length,
    bigL: m.filter(([f, a]) => a - f >= bigMargin).length,
    hi: tot.filter((t) => t >= hiThresh).length,
    closeMargin, bigMargin, hiThresh,
  };
}

function bucketsHtml(xs, edges, labels) {
  const n = xs.length || 1;
  return edges.map(([lo, hi], i) => {
    const c = xs.filter((x) => x >= lo && x < hi).length;
    const share = c / n;
    return `<div class="kv"><span>${esc(labels[i])}</span><span class="num">${c}</span><span class="meter m"><i style="width:${Math.round(share * 100)}%"></i></span><span class="pc">${pct(share)}</span></div>`;
  }).join("");
}

function statsPanelHtml(sport, P, team) {
  if (!P) return `<section class="panel"><h2>Season stats</h2><p>Stats appear after this team's first finished game.</p></section>`;
  const r = P.r;
  const recStr = sport === "epl" ? `${r.w}–${r.t}–${r.l}`
    : sport === "nhl" ? `${r.w}–${r.l}–${r.t}`
    : r.t ? `${r.w}–${r.l}–${r.t}` : `${r.w}–${r.l}`;
  const forLabel = sport === "nhl" || sport === "epl" ? "Goals for / game" : "Points for / game";
  const agLabel = sport === "nhl" || sport === "epl" ? "Goals against / game" : "Points against / game";
  const diffLabel = sport === "nhl" || sport === "epl" ? "Goal diff / game" : "Point diff / game";
  const closeLabel = sport === "nba" ? `Close games (≤${P.closeMargin} pts)`
    : sport === "nfl" ? `One-score games (≤${P.closeMargin} pts)`
    : sport === "nhl" ? `One-goal games`
    : `Close games (≤${P.closeMargin} goal)`;
  const bigW = sport === "nba" ? "Won by 11+" : sport === "nfl" ? "Won by 14+" : sport === "nhl" ? "Won by 3+" : "Won by 2+";
  const bigL = sport === "nba" ? "Lost by 11+" : sport === "nfl" ? "Lost by 14+" : sport === "nhl" ? "Lost by 3+" : "Lost by 2+";
  const totLabel = sport === "nba" || sport === "nfl" ? "Avg total points" : sport === "nhl" ? "Avg total goals" : "Avg total goals";
  const hiLabel = sport === "nba" ? "Games with 230+ total" : sport === "nfl" ? "Games with 55+ total"
    : sport === "nhl" ? "Games with 7+ total" : "Games with 4+ total";

  const homeRec = sport === "epl" ? `${r.hw}–${r.ht}–${r.hl}` : sport === "nhl" ? `${r.hw}–${r.hl}–${r.ht}` : r.ht ? `${r.hw}–${r.hl}–${r.ht}` : `${r.hw}–${r.hl}`;
  const awayRec = sport === "epl" ? `${r.aw}–${r.at}–${r.al}` : sport === "nhl" ? `${r.aw}–${r.al}–${r.at}` : r.at ? `${r.aw}–${r.al}–${r.at}` : `${r.aw}–${r.al}`;

  const rows = [
    ["Record", `${esc(recStr)}<small>${ord(P.groupRank)} in ${esc(P.groupLabel)}</small>`],
    [forLabel, `${r.ppg.toFixed(1)}<small>${ord(P.rPpg)} of ${P.n}</small>`],
    [agLabel, `${r.oppg.toFixed(1)}<small>${ord(P.rOppg)} of ${P.n}</small>`],
    [diffLabel, sgn(r.diff)],
    ["Home record", homeRec],
    ["Away record", awayRec],
    [`Last ${P.lN}`, wlS(P.lNw, P.lNn - P.lNw)],
    ["Streak", esc(r.streak)],
    [closeLabel, wlS(P.cw, P.cl)],
    [bigW, pct(P.big / (r.gp || 1))],
    [bigL, pct(P.bigL / (r.gp || 1))],
    [totLabel, avg(P.tot).toFixed(1)],
    [hiLabel, pct(P.hi / (r.gp || 1))],
  ];
  if (sport === "epl") {
    rows.push(["Clean sheets", `${r.cs} (${pct(r.cs / (r.gp || 1))})`]);
    rows.push(["Both teams scored", `${r.btts} (${pct(r.btts / (r.gp || 1))})`]);
    rows.push(["Points", String(r.pts)]);
  }
  if (sport === "nhl") {
    rows.push(["OT/SO losses", String(r.t)]);
  }

  const edges = sport === "nba" ? [[0, 200], [200, 210], [210, 220], [220, 230], [230, 240], [240, 999]]
    : sport === "nfl" ? [[0, 35], [35, 45], [45, 55], [55, 999]]
    : sport === "nhl" ? [[0, 5], [5, 6], [6, 7], [7, 8], [8, 999]]
    : [[0, 2], [2, 3], [3, 4], [4, 999]];
  const labs = sport === "nba" ? ["Under 200", "200–209", "210–219", "220–229", "230–239", "240+"]
    : sport === "nfl" ? ["Under 35", "35–44", "45–54", "55+"]
    : sport === "nhl" ? ["Under 5", "5", "6", "7", "8+"]
    : ["Under 2", "2", "3", "4+"];
  const bucketTitle = sport === "nba" || sport === "nfl"
    ? `${esc(team.abbr)} · total points in their games`
    : `${esc(team.abbr || team.name)} · total goals in their games`;

  return `<section class="panel"><h2>Season stats · ${esc(dataSeasonLabel(sport, team))}</h2>
    <p class="small">This season so far. Ranks are among teams that have played.</p>
    <div class="tablewrap"><table class="cmp team-solo"><tbody>
      ${rows.map(([lbl, val]) => `<tr><td class="lbl">${esc(lbl)}</td><td class="a edge">${val}</td></tr>`).join("")}
    </tbody></table></div>
  </section>
  <section class="panel"><h2>${bucketTitle}</h2>${bucketsHtml(P.tot, edges, labs)}</section>`;
}

function dataSeasonLabel(sport) {
  if (sport === "nba" || sport === "nhl" || sport === "epl") return "2026–27";
  return "2026";
}

function seasonResultsHtml(sport, data, team, formLimit = null) {
  const rows = (data.games || [])
    .filter((g) => finished(g, sport) && involves(g, team))
    .sort((a, b) => b.start_utc.localeCompare(a.start_utc));
  if (!rows.length) return `<section class="panel"><h2>Season results</h2><p>No finished games yet this season.</p></section>`;
  const list = rows.map((g) => {
    const home = weHome(g, team);
    const us = home ? g.home_score : g.away_score;
    const them = home ? g.away_score : g.home_score;
    const opp = home ? (g.away_name || g.away) : (g.home_name || g.home);
    const win = us > them, draw = us === them;
    const res = draw ? "D" : win ? "W" : "L";
    const ot = sport === "nhl" && (g.result_type === "OT" || g.result_type === "SO") ? ` ${g.result_type}` : "";
    let pickBit = "";
    if (g.pick && g.won != null) {
      const chance = g.pick_p != null ? pct(g.pick_p) : "—";
      pickBit = `<span class="pl-pick">Our pick <b>${esc(g.pick_name || g.pick)}</b> ${chance} · <span class="wl ${g.won ? "W" : "L"}">${g.won ? "✓" : "✕"}</span></span>`;
    } else if (g.pick) {
      pickBit = `<span class="pl-pick">Our pick <b>${esc(g.pick_name || g.pick)}</b>${g.pick_p != null ? " " + pct(g.pick_p) : ""}</span>`;
    }
    const inner = `<span class="d">${esc(shortDay(g.start_utc))}</span>
      <span class="m"><span class="wl ${res}">${res}</span> ${us}–${them}${ot} ${home ? "vs" : "@"} ${esc(opp)}</span>
      ${pickBit}`;
    return g.path ? `<li><a href="${esc(g.path)}">${inner}</a></li>` : `<li>${inner}</li>`;
  }).join("");
  return `<section class="panel"><h2>Season results</h2>
    <p class="small">Every finished ${esc(sportName(sport))} game this season, newest first. ProbaLab picks show where we made one.</p>
    <ul class="games season-results">${list}</ul>
  </section>`;
}

export function renderTeamIndex(sport, data) {
  const S = sportName(sport);
  const teams = listTeams(sport, data);
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/${sport}">${esc(S)}</a> › <span>Teams</span></nav>
  <p class="eyebrow">// ${esc(S)} · teams</p>
  <h1>${esc(S)} teams</h1>
  <p>Every ${esc(S)} team with its season record, recent form, full results, ProbaLab's record on their games, and upcoming predictions.</p>
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
  // NFL division map from feed when present
  if (sport === "nfl" && data.teams?.length && !data.divByAbbr) {
    data.divByAbbr = {};
    for (const row of data.teams) {
      const [abbr, , , div] = row;
      if (abbr && div) data.divByAbbr[abbr] = div;
    }
  }
  const rec = seasonRecord(data, sport === "epl" ? team.name : team.abbr, sport);
  const form = recentForm(data, team, sport, 10);
  const model = modelRecordOnTeam(data, team);
  const up = upcomingFor(data, team);
  const injuries = injuriesFor(data, team);
  const P = teamProfile(sport, data, team);
  const rate = (x) => (x.n ? `${x.w}–${x.l} (${pct(x.rate)})` : "no graded picks yet");

  const upRows = up.length ? up.map((g) => {
    const teamIsHome = weHome(g, team);
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
  <p>Season record <b>${esc(rec.str)}</b>. Full results, season stats, form and ProbaLab's picks on games involving ${esc(team.name)}.</p>

  <section class="panel"><h2>Recent form</h2>${formHtml(form)}</section>

  ${statsPanelHtml(sport, P, team)}

  ${seasonResultsHtml(sport, data, team)}

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
  const description = `${team.name} season record ${rec.str}, season stats, every result, upcoming win chances and ProbaLab's results on their games.`;
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

/** Merge NHL season results with picks + pretip + grades. */
export function nhlDataFromFiles(picks, pretip, seasonFile, grades) {
  const SN = pretip?.games ?? {};
  const GR = grades && typeof grades === "object" ? grades : {};
  const seasonGames = seasonFile?.games || [];
  const byId = new Map(seasonGames.map((g) => [String(g.game_id), g]));
  // also index season by home|away|date for picks that lack scores
  const byKey = new Map();
  for (const g of seasonGames) {
    byKey.set(`${g.home}|${g.away}|${(g.start_utc || "").slice(0, 10)}`, g);
  }

  const fromPicks = (Array.isArray(picks) ? picks : picks?.games ?? []).map((g) => {
    const id = String(g.game_id ?? g.id);
    const sn = SN[id];
    const gr = GR[id];
    const sea = byId.get(id) || byKey.get(`${g.home}|${g.away}|${(g.start_utc ?? g.puck_drop_utc ?? g.date ?? "").slice(0, 10)}`);
    const pc = (v) => (v == null ? null : Number(v) > 1 ? Number(v) / 100 : Number(v));
    const ph = pc(g.p_home ?? g.home_pct), pa = pc(g.p_away ?? g.away_pct);
    const pickHome = sn ? sn.pick === g.home : g.pick === "home" || g.pick === g.home;
    const pick = pickHome ? g.home : g.away;
    const pick_p = sn ? Number(sn.pick_p) : pickHome ? ph : pa;
    const start = g.start_utc ?? g.puck_drop_utc ?? g.date ?? sea?.start_utc;
    const home_score = g.home_score ?? gr?.home_score ?? sea?.home_score ?? sn?.home_score ?? null;
    const away_score = g.away_score ?? gr?.away_score ?? sea?.away_score ?? sn?.away_score ?? null;
    const won = sn && typeof sn.won === "boolean" ? sn.won : (gr && typeof gr.correct === "boolean" ? gr.correct : null);
    const done = home_score != null || won != null || g.status === "post" || sea?.status === "post";
    return {
      sport: "nhl", game_id: id, home: g.home, away: g.away,
      home_name: NHL_TEAMS[g.home] ?? g.home, away_name: NHL_TEAMS[g.away] ?? g.away,
      home_score, away_score,
      start_utc: start, status: done ? "post" : "pre",
      pick, pick_p, pick_name: NHL_TEAMS[pick] ?? pick,
      light: sn?.light ?? (pick_p >= 0.65 ? "GREEN" : pick_p >= 0.55 ? "ORANGE" : "RED"),
      won, path: `/nhl#game-${id}`, detail: g.detail || null,
      result_type: sea?.result_type || null,
      _from_pick: true,
    };
  });

  const pickIds = new Set(fromPicks.map((g) => g.game_id));
  const pickKeys = new Set(fromPicks.map((g) => `${g.home}|${g.away}|${(g.start_utc || "").slice(0, 10)}`));
  const extras = seasonGames
    .filter((g) => !pickIds.has(String(g.game_id)) && !pickKeys.has(`${g.home}|${g.away}|${(g.start_utc || "").slice(0, 10)}`))
    .map((g) => ({
      sport: "nhl", game_id: String(g.game_id), home: g.home, away: g.away,
      home_name: NHL_TEAMS[g.home] ?? g.home, away_name: NHL_TEAMS[g.away] ?? g.away,
      home_score: g.home_score, away_score: g.away_score,
      start_utc: g.start_utc, status: "post",
      pick: null, pick_p: null, pick_name: null, light: null, won: null,
      path: null, detail: null, result_type: g.result_type || null,
    }));

  return {
    games: [...fromPicks, ...extras],
    season: 2027,
    teams: Object.entries(NHL_TEAMS).map(([a, n]) => [a, n]),
  };
}

/** Merge EPL season results with picks + grades. */
export function eplDataFromFiles(picks, grades, seasonFile) {
  const seasonGames = seasonFile?.games || [];
  const byId = new Map(seasonGames.map((g) => [String(g.game_id), g]));
  const byKey = new Map();
  for (const g of seasonGames) {
    byKey.set(`${g.home}|${g.away}|${(g.start_utc || "").slice(0, 10)}`, g);
  }

  const fromPicks = (Array.isArray(picks) ? picks : picks?.games ?? []).map((g) => {
    const id = String(g.game_id ?? g.id);
    const gr = grades?.[id];
    const sea = byId.get(id) || byKey.get(`${g.home}|${g.away}|${(g.start_utc ?? g.kickoff_utc ?? "").slice(0, 10)}`);
    const start = g.start_utc ?? g.kickoff_utc ?? sea?.start_utc;
    const pickSide = g.pick;
    const pick_p = pickSide === "home" ? Number(g.p_home) : pickSide === "away" ? Number(g.p_away) : Number(g.p_draw);
    const pick = pickSide === "home" ? g.home : pickSide === "away" ? g.away : "Draw";
    const home_score = g.home_score ?? gr?.home_score ?? sea?.home_score ?? null;
    const away_score = g.away_score ?? gr?.away_score ?? sea?.away_score ?? null;
    const done = home_score != null || !!(gr?.graded) || g.status === "post" || sea?.status === "post";
    return {
      sport: "epl", game_id: id, home: g.home, away: g.away,
      home_name: g.home, away_name: g.away,
      home_score, away_score,
      start_utc: start, status: done ? "post" : "pre",
      pick, pick_p, pick_name: pick, p_home: g.p_home, p_away: g.p_away, p_draw: g.p_draw,
      light: g.light ?? (pick_p >= 0.55 ? "GREEN" : pick_p >= 0.45 ? "ORANGE" : "RED"),
      won: gr?.graded ? !!gr.correct : null,
      path: `/epl#game-${id}`, detail: null,
      _from_pick: true,
    };
  });

  const pickIds = new Set(fromPicks.map((g) => g.game_id));
  const pickKeys = new Set(fromPicks.map((g) => `${g.home}|${g.away}|${(g.start_utc || "").slice(0, 10)}`));
  const extras = seasonGames
    .filter((g) => !pickIds.has(String(g.game_id)) && !pickKeys.has(`${g.home}|${g.away}|${(g.start_utc || "").slice(0, 10)}`))
    .map((g) => ({
      sport: "epl", game_id: String(g.game_id), home: g.home, away: g.away,
      home_name: g.home, away_name: g.away,
      home_score: g.home_score, away_score: g.away_score,
      start_utc: g.start_utc, status: "post",
      pick: null, pick_p: null, pick_name: null, light: null, won: null,
      path: null, detail: null,
    }));

  return { games: [...fromPicks, ...extras], season: 2027, teams: [] };
}

export { NHL_TEAMS };
