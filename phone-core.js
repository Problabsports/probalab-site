/* ProbaLab phone layout: pure helpers shared by phone.js (browser) and the tests (Node).
   No DOM access in here. Everything returns plain values or HTML strings built from the same
   numbers the desktop pages show: no new data, no new wording beyond the phone chrome. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PLPhone = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Phones only. Kept in one place so CSS (phone.css) and JS agree on the breakpoint.
  var PHONE_MQ = "(max-width: 767.98px)";

  // Light names on the phone. SUPER is always "Best value".
  var LIGHT_LABEL = { SUPER: "Best value", GREEN: "Green", ORANGE: "Orange", RED: "Red" };
  var LIGHTS = ["SUPER", "GREEN", "ORANGE", "RED"];

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
  };
});
