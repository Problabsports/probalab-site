/* Player view for the props pages (/props/nba, /props/nfl, /props/nhl): opens from a player name on a card
   (phones: bottom sheet) or in the table (desktop: panel). Data only: the prop's line, every bookie's prices
   (best per side highlighted), last 8 against the line, game-by-game results, season average and hit rates.
   Reads the per-game JSON written by the server (only the rows the viewer can see).
   Prices follow the region (<html data-region>, set by props-region.js): AU bookies in decimal, or US sportsbooks in
   American odds (-110, +150); "No AU price" / "No US price" when that region has none. */
(function () {
  "use strict";
  var board = document.getElementById("propsBoard");
  if (!board) return;
  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var num = function (x) { return x == null || x === "" || !isFinite(Number(x)) ? null : Number(x); };
  // shown % rounded down and the props scale, as lights.json (PLLights when /lights.js is on the page)
  var PL = typeof PLLights !== "undefined" ? PLLights : null;
  var shownPct = function (x) { return Math.floor(Number(x) * 100 + 1e-7); };
  var pct = function (x) { return PL ? PL.chanceText(x) : shownPct(x) + "%"; };
  var light = function (r) { if (r == null) return ""; if (PL) return PL.propsLight(r) || ""; var p = shownPct(r); return p >= 60 ? "GREEN" : p >= 55 ? "ORANGE" : "RED"; };
  var LIGHT = { GREEN: "Green", ORANGE: "Orange", RED: "Red" };
  var region = function () { return document.documentElement.getAttribute("data-region") === "us" ? "us" : "au"; };
  /** Decimal -> American: 2.50 -> +150, 1.91 -> -110. */
  var american = function (d) { d = num(d); if (d == null || d <= 1) return "—"; return d >= 2 ? "+" + Math.round((d - 1) * 100) : "-" + Math.round(100 / (d - 1)); };
  var fmt = function (d, rg) { d = num(d); return d == null ? "—" : rg === "us" ? american(d) : d.toFixed(2); };

  function findItem(id) {
    var blocks = board.querySelectorAll("script.pp-pv");
    for (var i = 0; i < blocks.length; i++) {
      try { var d = JSON.parse(blocks[i].textContent); if (d[id]) return d[id]; } catch (e) {}
    }
    return null;
  }

  function bigChart(it) {
    var log = it.log.slice(0, 8).reverse();
    if (!log.length) return '<p class="ppv-muted">No games this season yet.</p>';
    var W = 320, H = 150, padB = 30, padT = 16, gap = 8, bw = (W - gap * (log.length - 1)) / log.length;
    if (it.kind === "yes") {
      return '<svg class="ppv-chart" viewBox="0 0 ' + W + ' 70" role="img" aria-label="Last ' + log.length + ' games: scored in ' + log.filter(function (g) { return g.v >= 1; }).length + '">' +
        log.map(function (g, i) {
          var cx = i * (bw + gap) + bw / 2;
          return '<circle cx="' + cx.toFixed(1) + '" cy="22" r="11" class="' + (g.v >= 1 ? "pf-hit" : "pf-miss") + '"/>' +
            '<text x="' + cx.toFixed(1) + '" y="26" text-anchor="middle" class="ppv-v">' + (g.v >= 1 ? g.v : "") + '</text>' +
            '<text x="' + cx.toFixed(1) + '" y="52" text-anchor="middle" class="ppv-x">' + esc(g.opp || "") + '</text>' +
            '<text x="' + cx.toFixed(1) + '" y="65" text-anchor="middle" class="ppv-x">' + esc(String(g.date || "").slice(5).replace("-", "/")) + '</text>';
        }).join("") + "</svg>";
    }
    var line = num(it.line) || 0;
    var max = Math.max.apply(null, [line].concat(log.map(function (g) { return g.v; }))) * 1.15 || 1;
    var plot = H - padB - padT;
    var y = function (v) { return padT + plot - (v / max) * plot; };
    var bars = log.map(function (g, i) {
      var x = i * (bw + gap), cls = g.v > line ? "pf-over" : g.v < line ? "pf-under" : "pf-push";
      return '<rect x="' + x.toFixed(1) + '" y="' + y(g.v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (padT + plot - y(g.v)).toFixed(1) + '" rx="3" class="' + cls + '"/>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y(g.v) - 4).toFixed(1) + '" text-anchor="middle" class="ppv-v">' + g.v + '</text>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 16) + '" text-anchor="middle" class="ppv-x">' + (g.ha === "A" ? "@" : "") + esc(g.opp || "") + '</text>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle" class="ppv-x">' + esc(String(g.date || "").slice(5).replace("-", "/")) + '</text>';
    }).join("");
    var ly = y(line).toFixed(1);
    return '<svg class="ppv-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Last ' + log.length + ' games against ' + line + ': ' + log.map(function (g) { return g.v; }).join(", ") + '">' +
      bars + '<line x1="0" x2="' + W + '" y1="' + ly + '" y2="' + ly + '" class="pf-line"/></svg>' +
      '<p class="ppv-key"><span><i class="ppv-sq pf-over"></i>Over</span><span><i class="ppv-sq pf-under"></i>Under</span><span><i class="ppv-dash"></i>Line ' + line + '</span></p>';
  }

  function stats(it) {
    var cells = [];
    if (it.season && it.season.avg != null) cells.push(["Season avg", it.season.avg, ""]);
    if (it.kind === "yes") {
      var r = it.rates || {};
      [["Scored L8", r.l8], ["Season", r.season]].forEach(function (x) {
        cells.push([x[0], x[1] && x[1].n ? pct(x[1].yes / x[1].n) : "—", x[1] && x[1].n ? x[1].yes + "/" + x[1].n : "", ""]);
      });
    } else if (it.hits) {
      var side = it.side === "Under" ? "under" : "over";
      [["L5", it.hits.l5], ["L10", it.hits.l10], ["Season", it.hits.season]].forEach(function (x) {
        var c = x[1];
        cells.push([x[0] + " " + (side === "under" ? "under" : "over"), c && c.n ? pct(c[side] / c.n) : "—", c && c.n ? c[side] + "/" + c.n : "", c && c.n ? light(c[side] / c.n) : ""]);
      });
    }
    return '<div class="ppv-stats">' + cells.map(function (c) {
      return '<div class="' + (c[3] ? "hl-" + c[3] : "") + '"><small>' + esc(c[0]) + '</small><b>' + esc(c[1]) + '</b>' + (c[2] ? '<span>' + esc(c[2]) + '</span>' : "") + '</div>';
    }).join("") + '</div>';
  }

  /** Opening (first pull) and closing (last pull before the start) price per bookie; best closing price highlighted. */
  function openClose(it, books, rg) {
    var p = it.pulls || {}, closed = p.latest === "close";
    var closeHead = closed ? "Close" : "Latest";
    var cell = function (o, c, best) {
      o = num(o); c = num(c);
      return '<td class="n ppv-oc' + (c != null && c === best ? " best" : "") + '"><small>' + (o == null ? "-" : fmt(o, rg)) + '</small><b>' + (c == null ? "-" : fmt(c, rg)) + '</b></td>';
    };
    var note = '<p class="ppv-muted ppv-small">Open = first price pull (about a day before). ' +
      (closed ? "Close = last pull before the start." : "Close appears after the last pull before the start; until then the latest pull shows.") +
      ' Highest ' + (closed ? "closing" : "latest") + ' price highlighted. Prices move; check with the bookie.</p>';
    if (it.kind === "yes") {
      var by = Math.max.apply(null, books.map(function (b) { return num(b.yes) || 0; }));
      return '<table class="ppv-books ppv-ocb"><thead><tr><th>Bookie</th><th class="n">Open · ' + closeHead + '</th></tr></thead><tbody>' +
        books.map(function (b) { return '<tr><td>' + esc(b.name) + '</td>' + cell(b.open_yes, b.yes, by) + '</tr>'; }).join("") + '</tbody></table>' + note;
    }
    var bo = Math.max.apply(null, books.map(function (b) { return num(b.over) || 0; }));
    var bu = Math.max.apply(null, books.map(function (b) { return num(b.under) || 0; }));
    return '<table class="ppv-books ppv-ocb"><thead><tr><th>Bookie</th><th class="n">Over<small>open · ' + closeHead.toLowerCase() + '</small></th><th class="n">Under<small>open · ' + closeHead.toLowerCase() + '</small></th></tr></thead><tbody>' +
      books.map(function (b) { return '<tr><td>' + esc(b.name) + '</td>' + cell(b.open_over, b.over, bo) + cell(b.open_under, b.under, bu) + '</tr>'; }).join("") +
      '</tbody></table>' + note;
  }

  function prices(it, rg) {
    var books = (rg === "us" ? it.books_us : it.books) || [];
    if (!books.length) {
      if (rg === "us") return '<p class="ppv-noau"><b>-</b> No US price for this prop. No US sportsbook has posted it on this line, so there is no price to show.</p>';
      return it.no_au_price && (it.sport !== "nba" || it.line_source === "avg")
        ? '<p class="ppv-noau"><b>-</b> No AU price for this prop. No Australian bookie has posted it, so there is no price to show.</p>'
        : '<p class="ppv-muted">No prices posted for this prop yet.</p>';
    }
    var hasOpen = books.some(function (b) { return "open_over" in b || "open_under" in b || "open_yes" in b; });
    if (hasOpen) return openClose(it, books, rg);
    if (it.kind === "yes") {
      var best = Math.max.apply(null, books.map(function (b) { return num(b.yes) || 0; }));
      return '<table class="ppv-books"><thead><tr><th>Bookie</th><th class="n">Price</th><th class="n">Implied</th></tr></thead><tbody>' +
        books.map(function (b) {
          var on = num(b.yes) === best;
          return '<tr' + (on ? ' class="best"' : "") + '><td>' + esc(b.name) + '</td><td class="n"><b>' + fmt(b.yes, rg) + '</b></td><td class="n">' + pct(1 / b.yes) + '</td></tr>';
        }).join("") + '</tbody></table>';
    }
    var bo = Math.max.apply(null, books.map(function (b) { return num(b.over) || 0; }));
    var bu = Math.max.apply(null, books.map(function (b) { return num(b.under) || 0; }));
    return '<table class="ppv-books"><thead><tr><th>Bookie</th><th class="n">Over</th><th class="n">Under</th></tr></thead><tbody>' +
      books.map(function (b) {
        var o = num(b.over), u = num(b.under);
        return '<tr><td>' + esc(b.name) + '</td><td class="n' + (o != null && o === bo ? " best" : "") + '">' + fmt(o, rg) + '</td>' +
          '<td class="n' + (u != null && u === bu ? " best" : "") + '">' + fmt(u, rg) + '</td></tr>';
      }).join("") + '</tbody></table><p class="ppv-muted ppv-small">Highest price per side highlighted. Prices move; check with the bookie.</p>';
  }

  function games(it) {
    if (!it.log.length) return "";
    var line = num(it.line);
    return '<ul class="ppv-games">' + it.log.slice(0, 15).map(function (g) {
      var mark = it.kind === "yes" ? (g.v >= 1 ? '<i class="ppv-mk pf-over-t">Scored</i>' : '<i class="ppv-mk">—</i>')
        : (g.v > line ? '<i class="ppv-mk pf-over-t">Over</i>' : g.v < line ? '<i class="ppv-mk pf-under-t">Under</i>' : '<i class="ppv-mk">Push</i>');
      return '<li><span class="ppv-gd">' + esc(String(g.date || "").slice(5).replace("-", "/")) + '</span><span class="ppv-go">' + (g.ha === "A" ? "@ " : g.ha === "H" ? "v " : "") + esc(g.opp || "") + '</span><b>' + g.v + '</b>' + mark + '</li>';
    }).join("") + '</ul>';
  }

  var open = null;
  function close() {
    if (!open) return;
    var o = open; open = null;
    o.wrap.remove();
    document.documentElement.classList.remove("ppv-open");
    document.removeEventListener("keydown", onKey);
    if (o.opener && o.opener.focus) o.opener.focus();
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function show(id, opener) {
    var it = findItem(id);
    if (!it) return;
    close();
    var logo = it.team ? '<img class="ppv-logo" src="/img/logos/' + esc(it.sport) + '/' + esc(String(it.team).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) + '.png" alt="" width="40" height="40" onerror="this.remove()">' : "";
    var badge = it.light ? '<span class="chip ' + it.light + '">' + LIGHT[it.light] + '</span>' + (it.side ? '<span class="ppv-side">' + esc(it.side) + '</span>' : "") : "";
    var wrap = document.createElement("div");
    wrap.className = "ppv-wrap";
    wrap.innerHTML = '<div class="ppv-bg" data-ppv-close></div>' +
      '<section class="ppv" role="dialog" aria-modal="true" aria-labelledby="ppvTitle">' +
      '<div class="ppv-grab" aria-hidden="true"></div>' +
      '<header class="ppv-head">' + logo + '<div class="ppv-title"><h2 id="ppvTitle">' + esc(it.player) + '</h2><p>' + esc([it.team, it.position].filter(Boolean).join(" · ")) + '</p></div>' +
      '<button type="button" class="ppv-x" data-ppv-close aria-label="Close">✕</button></header>' +
      '<div class="ppv-body">' +
      '<p class="ppv-prop"><span>' + esc(it.market) + (it.line != null ? ' <b>' + Number(it.line).toFixed(1) + '</b>' + (it.line_source === "avg" ? ' <small class="ppv-avg">Avg line</small>' : "") : "") + '</span><span class="ppv-badge">' + badge + '</span></p>' +
      (it.line_source === "avg" ? '<p class="ppv-muted ppv-small">Avg line: no bookie has a line for this prop, so the reference line is his season average rounded to the nearest .5.</p>' : "") +
      (it.pred ? '<p class="ppv-pred">Prediction <b>' + esc(it.pred.side) + '</b> · <b>' + pct(it.pred.p) + '</b></p>'
        : it.chance ? '<p class="ppv-pred' + (it.light ? ' hl-' + it.light : '') + '">Chance <b>' + esc(it.chance.side) + '</b> · <b>' + pct(it.chance.p) + '</b></p>' : "") +
      '<h3>Last ' + Math.min(8, it.log.length || 8) + (it.kind === "yes" ? " games" : it.line_source === "avg" ? " against the avg line" : " against the line") + '</h3>' + bigChart(it) +
      stats(it) +
      '<h3>Prices · ' + (region() === "us" ? "US sportsbooks" : "AU bookies") + '</h3>' + prices(it, region()) +
      (it.log.length ? '<h3>Game by game</h3>' + games(it) : "") +
      '<p class="ppv-muted ppv-small">Player stats and bookie prices only. 18+.</p>' +
      '</div></section>';
    document.body.appendChild(wrap);
    document.documentElement.classList.add("ppv-open");
    open = { wrap: wrap, opener: opener };
    wrap.addEventListener("click", function (e) { if (e.target.closest("[data-ppv-close]")) close(); });
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(function () { wrap.classList.add("in"); var x = wrap.querySelector(".ppv-x"); if (x) x.focus({ preventScroll: true }); });
  }

  board.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-pv-open]");
    if (!b) return;
    e.preventDefault();
    show(b.getAttribute("data-pv-open"), b);
  });
})();
