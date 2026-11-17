// Pure light rules over the lights.json data. ES5 style on purpose: tools/build_lights.mjs embeds this exact
// function into /lights.js (classic browser script) and /lights.mjs, so server and browser share one implementation.
// The mini jobs mirror it in Python (probalab_lights); tests check both give the same answers.
export function makeLights(data) {
  var DASH = "–";
  var lights = data.lights, games = data.games, bv = data.best_value, props = data.props;
  var ALIASES = { SUPER_GREEN: "SUPER", SUPERGREEN: "SUPER", BEST_VALUE: "SUPER", BESTVALUE: "SUPER" };

  function pct(x) { return Math.round(Number(x) * 100); }
  /** The whole % a chance is shown as: rounded down (lights.json "display"), with a hair of slack for float noise
   *  (0.57 * 100 = 56.99999999999999 must show 57). Lights are decided from this number, so they always match it. */
  function shown(p) { var n = num(p); return n == null ? null : Math.floor(n * 100 + 1e-7); }
  function chanceText(p) { var s = shown(p); return s == null ? "\u2014" : s + "%"; }
  function norm(l) {
    var k = String(l == null ? "" : l).trim().toUpperCase().replace(/[-\s]+/g, "_");
    k = ALIASES[k] || k;
    return lights[k] ? k : "";
  }
  function info(l) { return lights[norm(l)] || null; }
  function label(l) { var i = info(l); return i ? i.label : String(l == null ? "" : l); }
  function labelLong(l) { var i = info(l); return i ? i.label_long : String(l == null ? "" : l); }
  function colour(l) { var i = info(l); return i ? i.colour : ""; }
  function emoji(l) { var i = info(l); return i ? i.emoji : ""; }
  function sportCfg(sport) { return games[String(sport || "").toLowerCase()] || null; }
  function num(p) { var n = p == null || p === "" ? NaN : Number(p); return isFinite(n) ? n : null; }

  /** Light from the chance alone, on the sport's cut-offs, judged on the shown (rounded-down) %. null when unknown. */
  function gameLight(sport, p) {
    var c = sportCfg(sport), v = shown(p);
    if (!c || v == null) return null;
    return v >= pct(c.green_min) ? "GREEN" : v >= pct(c.orange_min) ? "ORANGE" : "RED";
  }

  /** The light the site shows for a game: the feed's light, checked against the cut-offs.
   *  Green first: a Best value pick in the sport's green range shows GREEN (it keeps a Best value tag, see
   *  bestValueTag). The Best value light is only for Best value picks from min_p up to the green cut-off.
   *  In a guarded sport (NBA) a feed GREEN under the green cut-off is a held value pick and shows its plain
   *  cut-off light. Never promotes. */
  function shownLight(sport, feedLight, p) {
    var c = sportCfg(sport), l = norm(feedLight), n = num(p);
    if (!l) return gameLight(sport, n);
    if (!c || n == null) return l;
    if (l === "SUPER") {
      if (bv.sports.indexOf(String(sport).toLowerCase()) < 0) return gameLight(sport, n);
      var v = shown(n);
      return v < pct(bv.min_p) || v >= pct(c.green_min) ? gameLight(sport, n) : "SUPER";
    }
    if (l === "GREEN" && c.guard && shown(n) < pct(c.green_min)) return gameLight(sport, n);
    return l;
  }

  /** True when a game carries the Best value tag: the feed flagged it Best value (light SUPER, or the newer feed's
   *  best_value: true flag, passed as feedFlag), in a Best value sport, at min_p or more (shown %). Covers both the
   *  purple Best value light (below the green range) and a green pick that also beats our fair price (shown GREEN +
   *  a small Best value tag, counted only as green). */
  function bestValueTag(sport, feedLight, p, feedFlag) {
    var v = shown(p);
    if ((norm(feedLight) !== "SUPER" && feedFlag !== true) || v == null) return false;
    return bv.sports.indexOf(String(sport || "").toLowerCase()) >= 0 && v >= pct(bv.min_p);
  }

  /** Props scale, on the shown (rounded-down) %: 59% is orange, 60% green. */
  function propsLight(p) {
    var v = shown(p);
    if (v == null) return null;
    return v >= pct(props.green_min) ? "GREEN" : v >= pct(props.orange_min) ? "ORANGE" : "RED";
  }

  function ranges(g, o) {
    return { GREEN: g + "%+", ORANGE: o + DASH + (g - 1) + "%", RED: "under " + o + "%" };
  }
  /** {GREEN: "65%+", ORANGE: "55–64%", RED: "under 55%"} for a sport. */
  function scaleText(sport) { var c = sportCfg(sport); return c ? ranges(pct(c.green_min), pct(c.orange_min)) : null; }
  function rangeText(sport, l) { var s = scaleText(sport); return s ? s[norm(l)] || "" : ""; }
  /** Key lines: {GREEN: "65%+", ORANGE: "Lean · 55–64%", RED: "Coin flip · under 55%"}. */
  function keyText(sport) {
    var c = sportCfg(sport), s = scaleText(sport);
    if (!s) return null;
    return { GREEN: s.GREEN, ORANGE: c.orange_word + " · " + s.ORANGE, RED: c.red_word + " · " + s.RED };
  }
  function propsText() { return ranges(pct(props.green_min), pct(props.orange_min)); }

  function gameSports() { return Object.keys(games); }
  // sports grouped by the same value of key, in config order: [[value, [sport, ...]], ...]
  function groups(key) {
    var out = [], seen = {};
    gameSports().forEach(function (s) {
      var v = key(games[s]);
      if (!(v in seen)) { seen[v] = out.length; out.push([v, []]); }
      out[seen[v]][1].push(s);
    });
    return out;
  }
  function names(sports, joiner) {
    if (joiner === ", ") return sports.map(function (s) { return games[s].name; }).join(", ");
    var ns = sports.map(function (s) { return games[s].prose || games[s].name; });
    var txt = ns.length <= 1 ? ns.join("") : ns.slice(0, -1).join(", ") + " and " + ns[ns.length - 1];
    var art = games[sports[0]].article;
    return art ? art + " " + txt : txt;
  }
  /** "65%+ in the NBA, NFL and NHL; 55%+ in the Premier League and Championship; 70%+ in tennis".
   *  opts.short: ["65%+ NBA, NFL, NHL", "55%+ Premier League, Championship", "70%+ Tennis"] (an array). */
  function greenSummary(opts) {
    var gs = groups(function (c) { return pct(c.green_min); });
    if (opts && opts.short) return gs.map(function (g) { return g[0] + "%+ " + names(g[1], ", "); });
    return gs.map(function (g) { return g[0] + "%+ in " + names(g[1]); }).join("; ");
  }
  /** "55–64% in the NBA, NFL and NHL; 45–54% in the Premier League and Championship; 60–69% in tennis". */
  function orangeSummary() {
    var gs = groups(function (c) { return pct(c.orange_min) + DASH + (pct(c.green_min) - 1) + "%"; });
    return gs.map(function (g) { return g[0] + " in " + names(g[1]); }).join("; ");
  }
  function isTip(l) { var k = norm(l); return k === "SUPER" || k === "GREEN"; }

  return {
    data: data, order: data.order.slice(), norm: norm, label: label, labelLong: labelLong, colour: colour, emoji: emoji,
    sportCfg: sportCfg, gameSports: gameSports, gameLight: gameLight, shownLight: shownLight, bestValueTag: bestValueTag, propsLight: propsLight,
    scaleText: scaleText, rangeText: rangeText, keyText: keyText, propsText: propsText,
    greenSummary: greenSummary, orangeSummary: orangeSummary, isTip: isTip, pctText: function (x) { return pct(x) + "%"; },
    shown: shown, chanceText: chanceText,
    bestValueSports: function () { return bv.sports.slice(); }, bestValueMinP: function () { return bv.min_p; },
    bestValueText: function () { return bv.text; },
  };
}
