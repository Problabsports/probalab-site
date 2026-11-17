/* ProbaLab phone layout: pure helpers shared by phone.js (browser) and the tests (Node).
   No DOM access in here. Everything returns plain values or HTML strings built from the same
   numbers the desktop pages show: no new data, no new wording beyond the phone chrome. */
(function (root, factory) {
  // Lights (labels, cut-offs, key text) come from /lights.json through /lights.js, loaded just before this file.
  var node = typeof module === "object" && module.exports;
  var api = factory(node ? require("./lights.js") : root.PLLights);
  if (node) module.exports = api;
  else root.PLPhone = api;
})(typeof self !== "undefined" ? self : this, function (L) {
  "use strict";

  // Phones only. Kept in one place so CSS (phone.css) and JS agree on the breakpoint.
  var PHONE_MQ = "(max-width: 767.98px)";

  // Light names on the phone (lights.json labels). SUPER is always "Best value".
  var LIGHTS = L.order.slice();
  var LIGHT_LABEL = {};
  LIGHTS.forEach(function (l) { LIGHT_LABEL[l] = L.label(l); });

  // Words that must never appear in the phone layout.
  var BANNED = /paper units?|fresh record|still proving|price cap/i;

  var SPORT_NAME = { nba: "NBA", nfl: "NFL", nhl: "NHL", epl: "Premier League", championship: "Championship", tennis: "Tennis" };
  var SPORT_SHORT = { nba: "NBA", nfl: "NFL", nhl: "NHL", epl: "EPL", championship: "EFL", tennis: "Tennis" };

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Light from a chip's class list (or a bare light name). Unknown → "". */
  function lightOf(cls) {
    var parts = String(cls || "").toUpperCase().split(/\s+/);
    for (var i = 0; i < LIGHTS.length; i++) if (parts.indexOf(LIGHTS[i]) >= 0) return LIGHTS[i];
    return "";
  }

  /** Green picks first: Best value and Green, then Orange, Red, then games with no light yet. */
  function lightRank(l) {
    return l === "SUPER" ? 0 : l === "GREEN" ? 1 : l === "ORANGE" ? 2 : l === "RED" ? 3 : 4;
  }
  var isGreen = function (l) { return l === "SUPER" || l === "GREEN"; };

  /** Stable sort: green first, keeping each light group in its original (start-time) order. */
  function sortGreenFirst(list) {
    return list
      .map(function (g, i) { return { g: g, i: i }; })
      .sort(function (a, b) { return lightRank(a.g.light) - lightRank(b.g.light) || a.i - b.i; })
      .map(function (x) { return x.g; });
  }

  /** Top green picks for the home screen: Best value first, then the highest chance, max n. */
  function topGreens(list, n) {
    return list
      .filter(function (g) { return isGreen(g.light) && g.p != null; })
      .map(function (g, i) { return { g: g, i: i }; })
      .sort(function (a, b) { return lightRank(a.g.light) - lightRank(b.g.light) || b.g.p - a.g.p || a.i - b.i; })
      .slice(0, n == null ? 5 : n)
      .map(function (x) { return x.g; });
  }

  /** "Boston Celtics 72%" → { side: "Boston Celtics", p: 0.72 }. "soon" → { side: "", p: null }. */
  function splitPick(text) {
    var s = String(text || "").replace(/\s+/g, " ").trim();
    var m = s.match(/^(.*?)\s*(\d{1,3}(?:\.\d+)?)%$/);
    if (!m) return { side: "", p: null };
    var p = Number(m[2]) / 100;
    return { side: m[1].trim(), p: p >= 0 && p <= 1 ? p : null };
  }

  /** Two teams from a match label: "A @ B" (away @ home) or "A v B" (home v away). */
  function splitMatch(text) {
    var s = String(text || "").replace(/\s+/g, " ").trim();
    var at = s.split(" @ ");
    if (at.length === 2) return { a: at[0].trim(), b: at[1].trim(), sep: "@" };
    var v = s.split(" v ");
    if (v.length >= 2) return { a: v[0].trim(), b: v.slice(1).join(" v ").trim(), sep: "v" };
    return { a: s, b: "", sep: "" };
  }

  /** Game id from a /today link: /nba/...-401810123, /nhl#game-123, /epl/app#game-45. */
  function gameIdFromHref(href) {
    var h = String(href || "");
    var m = h.match(/#game-([A-Za-z0-9_-]+)$/) || h.match(/-(\d+)(?:[?#].*)?$/);
    return m ? m[1] : null;
  }

  /** Where a phone card opens: the app's full matchup view for the sport, else the original link. */
  function matchHref(sport, href) {
    var id = gameIdFromHref(href);
    if (!id) return href || "#";
    if (sport === "nba" || sport === "nfl") return "/#game-" + id;
    if (sport === "nhl" || sport === "epl" || sport === "championship") return "/" + sport + "/app#game-" + id;
    return href || "#";
  }

  /** One /today row as plain values. Parts are read out of the server-rendered row by phone.js. */
  function rowFromParts(o) {
    var pick = splitPick(o.pickText);
    var teams = o.teams && o.teams.length === 2 ? { a: o.teams[0], b: o.teams[1], sep: o.sep || splitMatch(o.matchText).sep } : splitMatch(o.matchText);
    var light = lightOf(o.chipClass);
    var fair = o.fairDec != null && o.fairDec !== "" && isFinite(Number(o.fairDec)) ? Number(o.fairDec) : null;
    var clean = function (t) { var s = String(t == null ? "" : t).trim(); return s && s !== "—" ? s : ""; };
    return {
      sport: o.sport,
      sportName: SPORT_NAME[o.sport] || String(o.sport || "").toUpperCase(),
      id: gameIdFromHref(o.href),
      when: String(o.whenText || "").replace(/\s+/g, " ").trim(),
      a: teams.a, b: teams.b, sep: teams.sep,
      sub: clean(o.subText),
      side: pick.side, p: pick.p,
      light: light,
      href: o.href || "#",
      phoneHref: matchHref(o.sport, o.href),
      fair: fair,
      market: clean(o.marketText),
      value: clean(o.valueText),
      valued: !!o.valued,
      injury: clean(o.injuryText),
    };
  }

  // ---------------------------------------------------------------- chance gauge
  /** Half-round gauge (SVG) showing a chance. size = width in px. */
  function gaugeSvg(p, light, opts) {
    opts = opts || {};
    var size = opts.size || 72;
    var ok = p != null && isFinite(p);
    var v = ok ? Math.max(0, Math.min(1, Number(p))) : 0;
    var pctTxt = ok ? Math.round(v * 100) + "%" : "–";
    var r = 40, cx = 50, cy = 50, len = Math.PI * r; // half circle, 0..1 left to right
    var arc = "M" + (cx - r) + " " + cy + " A" + r + " " + r + " 0 0 1 " + (cx + r) + " " + cy;
    var cls = "pf-gauge" + (light ? " pf-g-" + light : "") + (opts.big ? " pf-gauge-big" : "");
    var label = opts.label || "Chance";
    return '<span class="' + cls + '" style="--pf-g-w:' + size + 'px">' +
      '<svg viewBox="0 0 100 58" width="' + size + '" height="' + Math.round(size * 0.58) + '" role="img" aria-label="' + esc(label) + " " + pctTxt + '" focusable="false">' +
      '<path class="pf-g-track" d="' + arc + '" pathLength="' + len.toFixed(2) + '"/>' +
      (ok ? '<path class="pf-g-fill" d="' + arc + '" pathLength="' + len.toFixed(2) + '" stroke-dasharray="' + (v * len).toFixed(2) + " " + len.toFixed(2) + '"/>' : "") +
      "</svg>" +
      '<span class="pf-g-num" aria-hidden="true">' + pctTxt + "</span>" +
      (opts.caption ? '<span class="pf-g-cap" aria-hidden="true">' + esc(opts.caption) + "</span>" : "") +
      "</span>";
  }

  function lightChip(l) {
    return l ? '<span class="chip ' + l + ' pf-chip">' + esc(LIGHT_LABEL[l] || l) + "</span>" : "";
  }

  // ---------------------------------------------------------------- match card
  function teamLine(name, picked) {
    return '<span class="pf-team' + (picked ? " pf-picked" : "") + '">' + esc(name) + (picked ? '<span class="pf-tick" aria-hidden="true">●</span>' : "") + "</span>";
  }

  /** One match card. g is a row from rowFromParts. */
  function cardHtml(g, opts) {
    opts = opts || {};
    var lightCls = g.light ? " pf-l-" + g.light : " pf-l-none";
    var pickedA = g.side && g.side === g.a, pickedB = g.side && g.side === g.b;
    var top = '<span class="pf-sport">' + esc(SPORT_SHORT[g.sport] || g.sportName) + "</span>" +
      '<span class="pf-time">' + esc(g.when) + "</span>" +
      (g.light === "SUPER" ? '<span class="pf-bv">Best value</span>' : "");
    var teams = '<span class="pf-teams">' + teamLine(g.a, pickedA) +
      (g.b ? '<span class="pf-sep">' + (g.sep === "@" ? "@" : "v") + "</span>" + teamLine(g.b, pickedB) : "") +
      (g.sub ? '<span class="pf-sub">' + esc(g.sub) + "</span>" : "") + "</span>";
    var pick = g.side
      ? '<span class="pf-pick"><span class="pf-pick-lab">Our pick</span><b>' + esc(g.side) + "</b></span>"
      : '<span class="pf-pick"><span class="pf-pick-lab">Our pick</span><b>Posted soon</b></span>';
    var aria = (g.b ? g.a + (g.sep === "@" ? " at " : " v ") + g.b : g.a) + ". " + (g.side ? "Our pick " + g.side + ", " + (g.p != null ? Math.round(g.p * 100) + "% chance" : "") : "") +
      (g.light ? ", " + (LIGHT_LABEL[g.light] || g.light) : "");
    return '<a class="pf-card' + lightCls + '" href="' + esc(g.phoneHref || g.href) + '" data-pf-key="' + esc(g.sport + ":" + (g.id || "")) + '" aria-label="' + esc(aria) + '">' +
      '<span class="pf-card-top">' + top + "</span>" +
      '<span class="pf-card-mid">' + teams + gaugeSvg(g.p, g.light, { size: opts.gauge || 76 }) + "</span>" +
      '<span class="pf-card-foot">' + pick + lightChip(g.light) + "</span>" +
      (g.injury ? '<span class="pf-inj">⚠️ Injury watch · ' + esc(g.injury) + "</span>" : "") +
      "</a>";
  }

  // ---------------------------------------------------------------- match view tabs
  var MATCH_TABS = [["overview", "Overview"], ["stats", "Stats / H2H"], ["form", "Form"], ["props", "Props"]];

  /** Which tab a matchup panel belongs in, from its heading. */
  function classifyPanel(heading) {
    var h = String(heading || "").toLowerCase();
    if (/injury|quarterback|why the model|pick timeline|preview|result|chances|review/.test(h)) return "overview";
    if (/^form\b|last \d+|recent form/.test(h)) return "form";
    if (/comparison|players|total points|meetings|head[- ]to[- ]head|h2h|standings|scoring|stats/.test(h)) return "stats";
    return "overview";
  }

  // ---------------------------------------------------------------- props (predictions only)
  /** Props rows for one game, green first then highest chance. Rows carry no prices or units. */
  function sortProps(rows) {
    var rank = function (l) { return l === "GREEN" ? 0 : l === "ORANGE" ? 1 : l === "RED" ? 2 : 3; };
    return rows.slice().sort(function (a, b) { return rank(a.light) - rank(b.light) || (b.p || 0) - (a.p || 0); });
  }
  /** Is this props game (full team names) the matchup between away and home? */
  function propsGameMatches(teams, away, home) {
    var norm = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
    var nick = function (s) { var w = norm(s).split(" "); return w[w.length - 1]; };
    var t = (teams || []).map(norm);
    var hit = function (name) {
      var n = norm(name);
      return !!n && t.some(function (x) { return x === n || nick(x) === nick(n); });
    };
    return hit(away) && hit(home);
  }
  function propRowHtml(r) {
    return '<li class="pf-prop pf-l-' + esc(r.light || "none") + '">' +
      '<span class="pf-prop-who"><b>' + esc(r.player) + "</b><small>" + esc(r.market) + "</small></span>" +
      '<span class="pf-prop-call">' + esc(r.call) + (r.line ? " " + esc(r.line) : "") + "</span>" +
      gaugeSvg(r.p, r.light, { size: 54 }) +
      lightChip(r.light) +
      "</li>";
  }

  // ---------------------------------------------------------------- team logos
  // Local logo files: /img/logos/<sport>/<team-name-slug>.png (NBA, NFL, NHL, EPL, Championship).
  // Team colours (from the same source as the logos) are only used for the fallback badge.
  var LOGO_SPORTS = { nba: 1, nfl: 1, nhl: 1, epl: 1, championship: 1 };
  var TEAM_COLORS = {"championship":{"BIR":"0000fa","BLK":"0000fa","BOL":"1a1a1a","BRC":"f42727","BUR":"6c1d45","CAR":"0000fa","CHA":"c8142f","DER":"abebc5","LCN":"c8142f","MID":"f42727","MIL":"091453","NOR":"ffff00","PNE":"87cced","POR":"0000fa","QPR":"0000d4","SHU":"f42727","SOU":"ed1a3b","STK":"f42727","SWA":"1d428a","WAT":"ffff00","WBA":"091453","WHU":"7c2c3b","WOL":"fdb913","WXM":"c8142f","birmingham-city":"0000fa","blackburn-rovers":"0000fa","bolton-wanderers":"1a1a1a","bristol-city":"f42727","burnley":"6c1d45","cardiff-city":"0000fa","charlton-athletic":"c8142f","derby-county":"abebc5","lincoln-city":"c8142f","middlesbrough":"f42727","millwall":"091453","norwich-city":"ffff00","portsmouth":"0000fa","preston-north-end":"87cced","queens-park-rangers":"0000d4","sheffield-united":"f42727","southampton":"ed1a3b","stoke-city":"f42727","swansea-city":"1d428a","watford":"ffff00","west-bromwich-albion":"091453","west-ham-united":"7c2c3b","wolverhampton-wanderers":"fdb913","wrexham":"c8142f"},"epl":{"ARS":"e20520","AVL":"660e36","BHA":"0606fa","BOU":"f42727","BRE":"f42727","CHE":"144992","COV":"87cced","CRY":"0202fb","EVE":"0606fa","FUL":"cc0000","HUL":"f28800","IPS":"0000fa","LEE":"ffcd00","LIV":"d11317","MAN":"da020e","MNC":"99c5ea","NEW":"0b1b3d","NFO":"c8102e","SUN":"eb172b","TOT":"0b1426","afc-bournemouth":"f42727","arsenal":"e20520","aston-villa":"660e36","brentford":"f42727","brighton-and-hove-albion":"0606fa","chelsea":"144992","coventry-city":"87cced","crystal-palace":"0202fb","everton":"0606fa","fulham":"cc0000","hull-city":"f28800","ipswich-town":"0000fa","leeds-united":"ffcd00","liverpool":"d11317","manchester-city":"99c5ea","manchester-united":"da020e","newcastle-united":"0b1b3d","nottingham-forest":"c8102e","sunderland":"eb172b","tottenham-hotspur":"0b1426"},"nba":{"ATL":"c8102e","BKN":"19e3ff","BOS":"008348","CHA":"008ca8","CHI":"ce1141","CLE":"860038","DAL":"0064b1","DEN":"0e2240","DET":"1d428a","GS":"fdb927","HOU":"ce0e2d","IND":"0c2340","LAC":"12173f","LAL":"552583","MEM":"5d76a9","MIA":"98002e","MIL":"00471b","MIN":"266092","NO":"0a2240","NY":"1d428a","OKC":"007ac1","ORL":"0150b5","PHI":"1d428a","PHX":"29127a","POR":"e03a3e","SA":"c4ced4","SAC":"5a2d81","TOR":"d91244","UTAH":"4e008e","WSH":"e31837","atlanta-hawks":"c8102e","boston-celtics":"008348","brooklyn-nets":"19e3ff","charlotte-hornets":"008ca8","chicago-bulls":"ce1141","cleveland-cavaliers":"860038","dallas-mavericks":"0064b1","denver-nuggets":"0e2240","detroit-pistons":"1d428a","golden-state-warriors":"fdb927","houston-rockets":"ce0e2d","indiana-pacers":"0c2340","la-clippers":"12173f","los-angeles-lakers":"552583","memphis-grizzlies":"5d76a9","miami-heat":"98002e","milwaukee-bucks":"00471b","minnesota-timberwolves":"266092","new-orleans-pelicans":"0a2240","new-york-knicks":"1d428a","oklahoma-city-thunder":"007ac1","orlando-magic":"0150b5","philadelphia-76ers":"1d428a","phoenix-suns":"29127a","portland-trail-blazers":"e03a3e","sacramento-kings":"5a2d81","san-antonio-spurs":"c4ced4","toronto-raptors":"d91244","utah-jazz":"4e008e","washington-wizards":"e31837"},"nfl":{"ARI":"a40227","ATL":"a71930","BAL":"29126f","BUF":"00338d","CAR":"0085ca","CHI":"0b1c3a","CIN":"fb4f14","CLE":"472a08","DAL":"002a5c","DEN":"0a2343","DET":"0076b6","GB":"204e32","HOU":"021018","IND":"003b75","JAX":"007487","KC":"e31837","LAC":"0080c6","LAR":"003594","LV":"a5acaf","MIA":"008e97","MIN":"4f2683","NE":"002a5c","NO":"d3bc8d","NYG":"003c7f","NYJ":"115740","PHI":"06424d","PIT":"ffb612","SEA":"002a5c","SF":"aa0000","TB":"bd1c36","TEN":"4495d2","WSH":"5a1414","arizona-cardinals":"a40227","atlanta-falcons":"a71930","baltimore-ravens":"29126f","buffalo-bills":"00338d","carolina-panthers":"0085ca","chicago-bears":"0b1c3a","cincinnati-bengals":"fb4f14","cleveland-browns":"472a08","dallas-cowboys":"002a5c","denver-broncos":"0a2343","detroit-lions":"0076b6","green-bay-packers":"204e32","houston-texans":"021018","indianapolis-colts":"003b75","jacksonville-jaguars":"007487","kansas-city-chiefs":"e31837","las-vegas-raiders":"a5acaf","los-angeles-chargers":"0080c6","los-angeles-rams":"003594","miami-dolphins":"008e97","minnesota-vikings":"4f2683","new-england-patriots":"002a5c","new-orleans-saints":"d3bc8d","new-york-giants":"003c7f","new-york-jets":"115740","philadelphia-eagles":"06424d","pittsburgh-steelers":"ffb612","san-francisco-49ers":"aa0000","seattle-seahawks":"002a5c","tampa-bay-buccaneers":"bd1c36","tennessee-titans":"4495d2","washington-commanders":"5a1414"},"nhl":{"ANA":"fc4c02","BOS":"231f20","BUF":"00468b","CAR":"e30426","CBJ":"002d62","CGY":"dd1a32","CHI":"e31937","COL":"860038","DAL":"20864c","DET":"e30526","EDM":"00205b","FLA":"e51937","LA":"121212","MIN":"124734","MTL":"c41230","NJ":"e30b2b","NSH":"fdba31","NYI":"00529b","NYR":"0056ae","OTT":"dd1a32","PHI":"fe5823","PIT":"fdb71a","SEA":"000d33","SJ":"00788a","STL":"0070b9","TB":"003e7e","TOR":"003e7e","UTAH":"7ab2e1","VAN":"003e7e","VGK":"344043","WPG":"002d62","WSH":"d71830","anaheim-ducks":"fc4c02","boston-bruins":"231f20","buffalo-sabres":"00468b","calgary-flames":"dd1a32","carolina-hurricanes":"e30426","chicago-blackhawks":"e31937","colorado-avalanche":"860038","columbus-blue-jackets":"002d62","dallas-stars":"20864c","detroit-red-wings":"e30526","edmonton-oilers":"00205b","florida-panthers":"e51937","los-angeles-kings":"121212","minnesota-wild":"124734","montreal-canadiens":"c41230","nashville-predators":"fdba31","new-jersey-devils":"e30b2b","new-york-islanders":"00529b","new-york-rangers":"0056ae","ottawa-senators":"dd1a32","philadelphia-flyers":"fe5823","pittsburgh-penguins":"fdb71a","san-jose-sharks":"00788a","seattle-kraken":"000d33","st-louis-blues":"0070b9","tampa-bay-lightning":"003e7e","toronto-maple-leafs":"003e7e","utah-mammoth":"7ab2e1","vancouver-canucks":"003e7e","vegas-golden-knights":"344043","washington-capitals":"d71830","winnipeg-jets":"002d62"}};
  /** Same slug as the server's team pages (functions/_shared/site.js slug). */
  function teamSlug(name) {
    return String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function logoSrc(sport, name) {
    var s = String(sport || "").toLowerCase();
    return LOGO_SPORTS[s] && name ? "/img/logos/" + s + "/" + teamSlug(name) + ".png" : "";
  }
  function teamColor(sport, name, abbr) {
    var m = TEAM_COLORS[String(sport || "").toLowerCase()] || {};
    var c = m[teamSlug(name)] || m[String(abbr || "").toUpperCase()] || "19e3ff";
    return "#" + c;
  }
  /** Short code for a badge: the abbreviation we have, else initials of the name. */
  function teamAbbr(name, abbr) {
    if (abbr) return String(abbr).toUpperCase().slice(0, 4);
    var w = String(name || "").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
    if (!w.length) return "?";
    return (w.length === 1 ? w[0].slice(0, 3) : w.slice(0, 3).map(function (x) { return x[0]; }).join("")).toUpperCase();
  }
  /** Round fallback badge in the team colour. */
  function badgeHtml(sport, name, abbr, size) {
    var c = teamColor(sport, name, abbr);
    return '<span class="pf-badge" style="--pf-tc:' + c + ";--pf-ls:" + (size || 56) + 'px" aria-hidden="true">' + esc(teamAbbr(name, abbr)) + "</span>";
  }
  /** Team logo; if the file is missing the image swaps itself for the round badge (phone.js wires the error). */
  function logoHtml(sport, name, abbr, size) {
    var src = logoSrc(sport, name);
    size = size || 56;
    if (!src) return badgeHtml(sport, name, abbr, size);
    return '<span class="pf-logo" style="--pf-ls:' + size + 'px"><img src="' + esc(src) + '" alt="" width="' + size + '" height="' + size + '" decoding="async" data-pf-logo="' +
      esc(String(sport).toLowerCase() + "|" + name + "|" + (abbr || "")) + '"></span>';
  }

  // ---------------------------------------------------------------- stacked lights key
  // Game scales: the live cut-offs from lights.json (same as /lights and record-pages.js). Props have their own scale.
  var GREEN_LINES = L.greenSummary({ short: true });
  var GAME_SCALE = {};
  L.gameSports().forEach(function (s) { GAME_SCALE[s] = L.keyText(s); });
  GAME_SCALE.all = { GREEN: GREEN_LINES.join(" · "), ORANGE: "Lean", RED: "Coin flip" };
  var PROPS_SCALE = L.propsText();
  var BEST_VALUE_TEXT = L.bestValueText();
  var INJURY_TEXT = "Key players uncertain";

  /** Rows for one sport's game scale. opts.best adds Best value (NBA / all only); opts.injury / opts.note add a warning row. */
  function gameKeyRows(sport, opts) {
    opts = opts || {};
    var s = GAME_SCALE[sport] ? sport : "all";
    var sc = GAME_SCALE[s], rows = [];
    if (opts.best && (s === "all" || L.bestValueSports().indexOf(s) >= 0)) rows.push({ light: "SUPER", label: LIGHT_LABEL.SUPER, range: BEST_VALUE_TEXT });
    rows.push(s === "all"
      ? { light: "GREEN", label: LIGHT_LABEL.GREEN, range: sc.GREEN, rangeHtml: GREEN_LINES.map(function (t) { return "<span class=\"pf-lk-line\">" + esc(t) + "</span>"; }).join("") }
      : { light: "GREEN", label: LIGHT_LABEL.GREEN, range: sc.GREEN });
    rows.push({ light: "ORANGE", label: LIGHT_LABEL.ORANGE, range: sc.ORANGE });
    rows.push({ light: "RED", label: LIGHT_LABEL.RED, range: sc.RED });
    if (opts.injury) rows.push({ light: "WARN", label: "Injury watch", range: INJURY_TEXT });
    if (opts.note) rows.push({ light: "WARN", label: "Important note", range: opts.note });
    return rows;
  }
  function propsKeyRows() {
    return ["GREEN", "ORANGE", "RED"].map(function (l) { return { light: l, label: LIGHT_LABEL[l], range: PROPS_SCALE[l] }; });
  }
  /** The stacked key: one line per light (dot, label, range) in a card. rangeHtml rows are trusted page HTML. */
  function stackedKeyHtml(rows, opts) {
    opts = opts || {};
    return '<div class="pf-lkey pf-only"' + (opts.kind ? ' data-pf-key="' + esc(opts.kind) + '"' : "") + ">" +
      (opts.title ? '<p class="pf-lkey-title">' + esc(opts.title) + "</p>" : "") +
      (opts.sub ? '<p class="pf-lkey-sub">' + esc(opts.sub) + "</p>" : "") +
      '<ul aria-label="' + esc(opts.title || "Light key") + '">' + rows.map(function (r) {
        return '<li class="pf-l-' + esc(r.light || "none") + (r.long ? " pf-lkey-long" : "") + '">' +
          (r.light === "WARN" ? '<i class="pf-lkey-warn" aria-hidden="true">⚠</i>' : '<i aria-hidden="true"></i>') +
          "<b>" + esc(r.label) + "</b><span>" + (r.rangeHtml != null ? r.rangeHtml : esc(r.range)) + "</span></li>";
      }).join("") + "</ul>" +
      (opts.note ? '<p class="pf-lkey-note">' + esc(opts.note) + "</p>" : "") +
      (opts.link ? '<a class="pf-lkey-link" href="' + esc(opts.link) + '">How the lights work<span aria-hidden="true"> →</span></a>' : "") +
      "</div>";
  }

  // ---------------------------------------------------------------- Today: sport chips with counts
  var TODAY_SPORTS = [["nba", "NBA"], ["nfl", "NFL"], ["nhl", "NHL"], ["epl", "Premier League"], ["championship", "Championship"], ["tennis", "Tennis"]];
  /** Same rule as the server's light filter (functions/_shared/game-filters.js). */
  function matchesLight(l, f) {
    if (f === "all") return true;
    if (f === "green") return l === "GREEN" || l === "SUPER";
    if (f === "super") return l === "SUPER";
    if (f === "orange") return l === "ORANGE";
    if (f === "red") return l === "RED";
    return true;
  }
  /** Same URLs as the server's filter links. */
  function todayHref(sport, light) {
    var q = [];
    if (sport && sport !== "all") q.push("sport=" + encodeURIComponent(sport));
    if (light && light !== "green") q.push("light=" + encodeURIComponent(light));
    return "/today" + (q.length ? "?" + q.join("&") : "");
  }
  /** Per sport: games in the next 24 hours (total) and games matching the light filter (shown). rows from the /today?light=all board. */
  function sportCounts(rows, light, loaded) {
    var out = { all: { total: 0, shown: 0 } };
    TODAY_SPORTS.forEach(function (s) { out[s[0]] = { total: 0, shown: 0, known: !loaded || loaded[s[0]] !== false }; });
    rows.forEach(function (g) {
      var c = out[g.sport];
      if (!c) return;
      c.total++; out.all.total++;
      if (matchesLight(g.light, light)) { c.shown++; out.all.shown++; }
    });
    return out;
  }
  function sportChipsHtml(counts, current, light) {
    var chip = function (id, label) {
      var c = counts[id] || { shown: 0 }, on = current === id, n = c.shown;
      var num = c.known === false ? "" : '<span class="pf-sc-n">' + n + "</span>";
      if (id !== "all" && n === 0 && c.known !== false) {
        return '<button type="button" class="pf-sc pf-sc-dim' + (on ? " pf-sc-on" : "") + '" data-pf-sport="' + id + '"' + (on ? ' aria-current="true"' : "") + ">" + esc(label) + num + "</button>";
      }
      return '<a class="pf-sc' + (on ? " pf-sc-on" : "") + '" href="' + esc(todayHref(id, light)) + '"' + (on ? ' aria-current="true"' : "") + ">" + esc(label) + num + "</a>";
    };
    return '<nav class="pf-sportchips pf-only" aria-label="Filter by sport">' + chip("all", "All") +
      TODAY_SPORTS.map(function (s) { return chip(s[0], s[1]); }).join("") + "</nav>";
  }
  var LIGHT_WORD = { green: "green", super: "Best value", orange: "orange", red: "red", all: "" };
  /** Message for a dimmed (0) chip. nextIso: the next start we have on file, if any. */
  function noGamesText(sport, counts, light, nextIso, tbc) {
    var name = SPORT_NAME[sport] || sport, c = counts[sport] || { total: 0 };
    if (c.total > 0 && light !== "all") {
      return { text: "No " + LIGHT_WORD[light] + " " + name + " picks in the next 24 hours.", more: c.total + " " + name + " game" + (c.total === 1 ? "" : "s") + " at other lights", href: todayHref(sport, "all") };
    }
    var t = "No " + name + " " + (sport === "tennis" ? "matches" : "games") + " in the next 24 hours.";
    return { text: t, next: nextIso ? "Next: " + sydneyWhen(nextIso, tbc) : "" };
  }
  /** Earliest upcoming start after the 24-hour window, from the files /today itself reads. */
  function nextStart(sport, data, now) {
    var after = (now || Date.now()) + 0;
    var best = null, tbc = false;
    var consider = function (iso, done, isTbc) {
      if (!iso || done) return;
      var t = Date.parse(iso);
      if (!isFinite(t) || t <= after) return;
      if (best == null || t < best) { best = t; tbc = !!isTbc; }
    };
    if (sport === "nba" || sport === "nfl") (data && data.games || []).forEach(function (g) { consider(g.start_utc, g.status === "post"); });
    else if (sport === "tennis") (data && data.matches || []).forEach(function (m) { consider(m.start_utc, m.status !== "pre", m.time_tbc); });
    else (Array.isArray(data) ? data : (data && data.games) || []).forEach(function (g) {
      consider(g.start_utc || g.kickoff_utc || g.puck_drop_utc || g.date, g.status === "post");
    });
    return best == null ? null : { iso: new Date(best).toISOString(), tbc: tbc };
  }
  /** "Thu 20 Nov, 11:00am AEDT" (Sydney). Date only when the start time isn't known yet. */
  function sydneyWhen(iso, tbc) {
    try {
      var d = new Date(iso);
      if (tbc) return new Intl.DateTimeFormat("en-AU", { timeZone: "America/New_York", weekday: "short", day: "numeric", month: "short" }).format(d).replace(/,/g, "") + ", time TBC";
      var parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" }).formatToParts(d);
      var g = function (t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : ""; };
      return g("weekday") + " " + g("day") + " " + g("month") + ", " + g("hour") + ":" + g("minute") + g("dayPeriod").toLowerCase() + " " + g("timeZoneName");
    } catch (e) { return ""; }
  }
  var NEXT_SOURCE = { nba: "/api/feed?sport=nba", nfl: "/api/feed?sport=nfl", nhl: "/data/nhl-picks.json", epl: "/data/epl-picks.json", championship: "/data/championship-picks.json", tennis: "/data/tennis-picks.json" };

  // ---------------------------------------------------------------- Today: count line
  var SHOWN_WORD = { green: "green", super: "Best value", orange: "orange", red: "red" };
  /** "16 games in the next 24 hours · 3 green picks shown. Choose All lights to see every game." Numbers come from the page. */
  function todayCountLine(total, shown, light, sport) {
    var plural = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };
    var sp = sport && sport !== "all" ? (SPORT_NAME[sport] || sport) + " " : "";
    if (!total) return "No games in the next 24 hours.";
    var head = plural(total, "game") + " in the next 24 hours";
    if (light === "all") return head + " · " + (sp ? shown + " " + sp + (shown === 1 ? "game" : "games") + " shown." : "all " + shown + " shown.");
    var w = SHOWN_WORD[light] || light;
    return head + " · " + shown + " " + sp + w + " pick" + (shown === 1 ? "" : "s") + " shown. Choose All lights to see every game.";
  }

  // ---------------------------------------------------------------- bottom tab bar
  var TAB_BAR = [
    ["home", "/", "Home"],
    ["today", "/today", "Today"],
    ["props", "/props/nba", "Props"],
    ["results", "/results", "Results"],
    ["members", "/members", "Members"],
  ];
  /** Which bottom tab is lit for a path + hash. */
  function activeTab(path, hash) {
    var p = String(path || "/"), h = String(hash || "");
    if (p === "/" || p === "/index.html") return h && h !== "#" && h !== "#home" ? (/^#game-/.test(h) ? "today" : "") : "home";
    if (p === "/today" || /^\/(nba|nfl|nhl|epl|championship|tennis)(\/|$)/.test(p)) return "today";
    if (/^\/props(\/|$)/.test(p)) return /^\/props\/results/.test(p) ? "results" : "props";
    if (/^\/results(\/|\.|$)/.test(p) || p === "/accuracy") return "results";
    if (/^\/(members|join)(\/|$)/.test(p)) return "members";
    return "";
  }

  // Home screen buttons: big tap targets for what members use most.
  var HOME_TILES = [
    ["today", "/today", "Today's games", "Every game, next 24 hours"],
    ["tips", "/members/tips/probalab", "Tips", "Members tip desk"],
    ["props", "/props/nba", "Props", "NBA player predictions"],
    ["results", "/results", "Results", "Every pick, wins and losses"],
    ["tipsters", "/members", "Tipsters", "All members desks"],
    ["account", "/members/billing", "Account", "Billing and sign-in"],
  ];

  return {
    PHONE_MQ: PHONE_MQ, LIGHT_LABEL: LIGHT_LABEL, BANNED: BANNED, SPORT_NAME: SPORT_NAME,
    MATCH_TABS: MATCH_TABS, TAB_BAR: TAB_BAR, HOME_TILES: HOME_TILES,
    esc: esc, lightOf: lightOf, lightRank: lightRank, isGreen: isGreen, sortGreenFirst: sortGreenFirst, topGreens: topGreens,
    splitPick: splitPick, splitMatch: splitMatch, gameIdFromHref: gameIdFromHref, matchHref: matchHref, rowFromParts: rowFromParts,
    gaugeSvg: gaugeSvg, lightChip: lightChip, cardHtml: cardHtml, classifyPanel: classifyPanel,
    sortProps: sortProps, propsGameMatches: propsGameMatches, propRowHtml: propRowHtml, activeTab: activeTab,
    GAME_SCALE: GAME_SCALE, PROPS_SCALE: PROPS_SCALE, TODAY_SPORTS: TODAY_SPORTS, NEXT_SOURCE: NEXT_SOURCE,
    todayCountLine: todayCountLine,
    gameKeyRows: gameKeyRows, propsKeyRows: propsKeyRows, stackedKeyHtml: stackedKeyHtml, matchesLight: matchesLight, todayHref: todayHref,
    sportCounts: sportCounts, sportChipsHtml: sportChipsHtml, noGamesText: noGamesText, nextStart: nextStart, sydneyWhen: sydneyWhen,
    teamSlug: teamSlug, logoSrc: logoSrc, teamColor: teamColor, teamAbbr: teamAbbr, badgeHtml: badgeHtml, logoHtml: logoHtml,
  };
});
