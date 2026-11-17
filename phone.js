/* ProbaLab phone layout. Runs only on small screens (PLPhone.PHONE_MQ, under 768px wide); on
   anything wider it does nothing, so the desktop site is untouched.
   It reuses what each page already loads or links to: the /today board, /api/green-record,
   /api/yesterday-greens, the public /props/nba board and the app's own match view. No new data.
   Needs phone-core.js first. */
(function () {
  "use strict";
  var P = window.PLPhone;
  if (!P || !window.matchMedia) return;
  var mq = window.matchMedia(P.PHONE_MQ);
  var root = document.documentElement;
  var started = false;
  var esc = P.esc;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var txt = function (el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; };
  var store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) {} },
  };
  var local = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} },
  };

  function apply() {
    var on = mq.matches;
    root.classList.toggle("pf", on);
    if (!on) return;
    if (!started) { started = true; start(); }
    markTab();
  }
  if (mq.addEventListener) mq.addEventListener("change", apply); else if (mq.addListener) mq.addListener(apply);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();

  function start() {
    tabBar();
    relabel(document.body);
    lightKeys(document);
    new MutationObserver(debounce(function () { if (mq.matches) { relabel(document.body); lightKeys(document); } }, 60)).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", markTab);
    window.addEventListener("popstate", markTab);
    if (location.pathname === "/today") todayPage();
    if (location.pathname === "/props/nba") propsPage();
    if (/^\/props\/nba\/player\//.test(location.pathname)) playerPage();
    if (location.pathname === "/results") resultsPage();
    // a missing logo file swaps itself for the round team-colour badge
    document.addEventListener("error", function (e) {
      var img = e.target;
      if (!img || img.tagName !== "IMG" || !img.hasAttribute("data-pf-logo")) return;
      var d = img.getAttribute("data-pf-logo").split("|"), box = img.closest(".pf-logo");
      if (box) box.outerHTML = P.badgeHtml(d[0], d[1], d[2], parseInt(box.style.getPropertyValue("--pf-ls"), 10) || 56);
    }, true);
    if (document.getElementById("view-game")) matchView();
    if ((location.pathname === "/" || location.pathname === "/index.html") && !window.HIDDEN_SPORT && document.getElementById("view-home")) homeScreen();
    installable();
  }

  function debounce(fn, ms) {
    var t = null;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  // ------------------------------------------------------------------ wording
  // SUPER is "Best value" on the phone, everywhere it appears (chips, filters, legends).
  var SUPER_RE = /Super\s*[—–-]\s*best value/gi;
  function relabel(el) {
    if (!el) return;
    $$(".chip.SUPER", el).forEach(function (c) { if (c.textContent !== "Best value") c.textContent = "Best value"; });
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n, hits = [];
    while ((n = w.nextNode())) if (/Super\s*[—–-]\s*best value/i.test(n.nodeValue)) hits.push(n);
    hits.forEach(function (t) {
      SUPER_RE.lastIndex = 0;
      // a legend that already shows the Best value chip doesn't need the words again
      var prev = t.previousSibling, chipBefore = prev && prev.nodeType === 1 && prev.classList.contains("chip") && prev.classList.contains("SUPER");
      t.nodeValue = chipBefore ? t.nodeValue.replace(/^\s*Super\s*[—–-]\s*best value\s*/i, " ") : t.nodeValue.replace(SUPER_RE, "Best value");
    });
    SUPER_RE.lastIndex = 0;
  }

  // ------------------------------------------------------------------ bottom tab bar
  var ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>',
    today: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/>',
    props: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    results: '<path d="M8 4h8v4a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 12v4M8.5 20h7M10 16h4v4h-4z"/>',
    members: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    tips: '<path d="M12 3 4 6v6c0 4.5 3.4 7.6 8 9 4.6-1.4 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    tipsters: '<circle cx="9" cy="9" r="3.2"/><circle cx="17" cy="10" r="2.6"/><path d="M3 20a6 6 0 0 1 12 0M14.5 20a4.5 4.5 0 0 1 7-3.7"/>',
    account: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18M7 15h4"/>',
  };
  var icon = function (k) { return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[k] || "") + "</svg>"; };

  function tabBar() {
    if ($(".pf-tabbar")) return;
    var nav = document.createElement("nav");
    nav.className = "pf-tabbar pf-only";
    nav.setAttribute("aria-label", "Sections");
    nav.innerHTML = P.TAB_BAR.map(function (t) {
      return '<a href="' + t[1] + '" data-pf-tabkey="' + t[0] + '">' + icon(t[0]) + "<span>" + esc(t[2]) + "</span></a>";
    }).join("");
    document.body.appendChild(nav);
    root.classList.add("pf-has-tabbar");
  }
  function markTab() {
    var k = P.activeTab(location.pathname, location.hash);
    $$(".pf-tabbar a").forEach(function (a) {
      var on = a.getAttribute("data-pf-tabkey") === k;
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  // ------------------------------------------------------------------ /today board → match cards
  function rowsFromToday(doc) {
    var out = [];
    $$("section.panel[id]", doc).forEach(function (sec) {
      $$("ul.today-games > li:not(.head)", sec).forEach(function (li) {
        var m = $(".m", li), links = m ? $$(".team-link", m) : [];
        var mc = m ? m.cloneNode(true) : null;
        if (mc) $$(".best-tag, .held-note, small, br", mc).forEach(function (x) { x.remove(); });
        var a = $(".d a", li) || $("a.row-rest", li);
        var chip = $(".chip", li), odds = $(".fp .odds", li);
        out.push(P.rowFromParts({
          sport: sec.id,
          whenText: txt($(".d", li)),
          matchText: txt(mc),
          teams: links.length === 2 ? [txt(links[0]), txt(links[1])] : null,
          sep: m && / v /.test(txt(mc)) ? "v" : "@",
          subText: txt(m && $("small", m)),
          pickText: txt($(".p", li)),
          chipClass: chip ? chip.className : "",
          href: a ? a.getAttribute("href") : "",
          fairDec: odds ? odds.getAttribute("data-dec") : null,
          marketText: txt($(".mk", li)),
          valueText: txt($(".gap", li)),
          valued: li.classList.contains("has-value"),
          injuryText: txt($(".injury-watch-note", li)),
        }));
        out[out.length - 1].el = li;
      });
    });
    return out;
  }

  // Price info the Today board already shows, carried into the match view's Overview.
  function rememberPrice(g) {
    if (!g || !g.id) return;
    store.set("pf-price:" + g.id, JSON.stringify({ fair: g.fair, market: g.market, value: g.value, valued: g.valued, when: g.when, sport: g.sport }));
  }
  function wireCards(box, rows) {
    box.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest(".pf-card");
      if (!a) return;
      var key = a.getAttribute("data-pf-key");
      rows.forEach(function (g) { if (g.sport + ":" + (g.id || "") === key) rememberPrice(g); });
    });
  }

  function todayPage() {
    root.classList.add("pf-today");
    sportChips();
    countLine();
    var all = rowsFromToday(document);
    $$("section.panel[id]").forEach(function (sec) {
      var ul = $("ul.today-games", sec);
      if (!ul || $(".pf-cards", sec)) return;
      var rows = P.sortGreenFirst(all.filter(function (g) { return sec.contains(g.el); }));
      var box = document.createElement("div");
      box.className = "pf-cards pf-only";
      box.innerHTML = rows.map(function (g) { return P.cardHtml(g); }).join("");
      ul.parentNode.insertBefore(box, ul);
      wireCards(box, rows);
    });
  }

  // ------------------------------------------------------------------ home screen
  function homeScreen() {
    var view = document.getElementById("view-home");
    if (document.getElementById("pf-home")) return;
    var el = document.createElement("section");
    el.id = "pf-home";
    el.className = "pf-only";
    el.setAttribute("aria-label", "ProbaLab home");
    el.innerHTML =
      '<div class="pf-hello"><p class="pf-eyebrow">// today\'s top greens</p>' +
      '<h1 class="pf-h1">Who wins. <em>How likely.</em></h1>' +
      '<a class="pf-record" id="pfRecord" href="/results"><span class="pf-rec-dot" aria-hidden="true"></span><span>Green record · see Results</span></a></div>' +
      '<div class="pf-greens" id="pfGreens" aria-live="polite">' + skeleton(2) + "</div>" +
      '<a class="pf-more" href="/today">All of today\'s games<span aria-hidden="true">→</span></a>' +
      P.stackedKeyHtml(P.gameKeyRows("all", { best: true, injury: true }), { title: "Light key", kind: "home", link: "/lights" }) +
      '<div class="pf-yest" id="pfYest" hidden></div>' +
      '<h2 class="pf-h2">Go to</h2>' +
      '<nav class="pf-grid" aria-label="Main features">' + P.HOME_TILES.map(function (t) {
        return '<a class="pf-tile pf-tile-' + t[0] + '" href="' + t[1] + '">' + icon(t[0]) + "<b>" + esc(t[2]) + "</b><small>" + esc(t[3]) + "</small></a>";
      }).join("") + "</nav>" +
      '<div class="pf-install" id="pfInstall" hidden></div>' +
      '<p class="pf-small">Predictions for entertainment, not advice. 18+. <a href="/responsible-gambling">Gamble responsibly</a>.</p>';
    view.parentNode.insertBefore(el, view);
    var sync = function () { root.classList.toggle("pf-at-home", !view.hidden); };
    new MutationObserver(sync).observe(view, { attributes: true, attributeFilter: ["hidden"] });
    sync();
    loadGreens();
    loadRecord();
    loadYesterday();
    installTile();
  }
  function skeleton(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += '<div class="pf-card pf-skel" aria-hidden="true"><span></span><span></span><span></span></div>';
    return s;
  }
  function loadGreens() {
    var box = document.getElementById("pfGreens");
    fetch("/today", { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (h) {
        var rows = rowsFromToday(new DOMParser().parseFromString(h, "text/html"));
        var top = P.topGreens(rows, 5);
        box.innerHTML = top.length
          ? top.map(function (g) { return P.cardHtml(g); }).join("")
          : '<div class="pf-empty"><b>No green picks in the next 24 hours yet.</b><span>New picks land as games come into range. Every game is on Today.</span></div>';
        relabel(box);
        wireCards(box, top);
      })
      .catch(function () {
        box.innerHTML = '<div class="pf-empty"><b>Today\'s picks are loading slowly.</b><span>Open Today for every game.</span></div>';
      });
  }
  function loadRecord() {
    fetch("/api/green-record", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var g = (d && d.green) || {};
        if (g.n == null || g.w == null) return;
        var el = document.getElementById("pfRecord");
        el.innerHTML = '<span class="pf-rec-dot" aria-hidden="true"></span><span class="pf-rec-lab">Green record</span><b>' + esc(g.w) + "–" + esc(g.n - g.w) + "</b>" +
          (g.pct != null ? '<span class="pf-rec-pct">' + esc(g.pct) + "%</span>" : "") + '<span class="pf-rec-go" aria-hidden="true">›</span>';
      })
      .catch(function () {});
  }
  function loadYesterday() {
    fetch("/api/yesterday-greens", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        if (!d || d.hide || !d.greens || !d.greens.length) return;
        var el = document.getElementById("pfYest");
        var w = d.greens.filter(function (g) { return g.won; }).length, n = d.greens.length;
        el.innerHTML = '<div class="pf-yest-head"><h2 class="pf-h2">Yesterday\'s greens</h2><span class="pf-yest-score">' + w + "–" + (n - w) + "</span></div>" +
          '<ul class="pf-yest-list">' + d.greens.map(function (g) {
            var p = g.chance != null ? Math.round(Number(g.chance) * 100) + "%" : "";
            return '<li class="' + (g.won ? "win" : "loss") + '"><span class="pf-yl-mark" aria-label="' + (g.won ? "Won" : "Lost") + '">' + (g.won ? "✓" : "✕") + "</span>" +
              '<span class="pf-yl-sp">' + esc(String(g.sport || "").toUpperCase()) + "</span><b>" + esc(g.pick) + "</b>" + (p ? "<span>" + p + "</span>" : "") + "</li>";
          }).join("") + "</ul>" +
          '<a class="pf-more pf-more-sm" href="/results">Full results<span aria-hidden="true">→</span></a>';
        el.hidden = false;
      })
      .catch(function () {});
  }

  // ------------------------------------------------------------------ match view (tabs)
  var ACTIVE = { id: null, tab: "overview" };
  function matchView() {
    var view = document.getElementById("view-game");
    var mo = new MutationObserver(function () { if (mq.matches) enhanceGame(view); });
    mo.observe(view, { childList: true });
    enhanceGame(view);
    view.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-pf-mtab]");
      if (!b) return;
      setTab(view, b.getAttribute("data-pf-mtab"), true);
    });
    view.addEventListener("keydown", function (e) {
      var b = e.target.closest && e.target.closest("[data-pf-mtab]");
      if (!b || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      var all = $$("[data-pf-mtab]", view), i = all.indexOf(b), j = (i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length;
      e.preventDefault();
      setTab(view, all[j].getAttribute("data-pf-mtab"), true);
      all[j].focus();
    });
  }

  function gameObj(id) {
    try {
      if (typeof NFL !== "undefined" && NFL && NFL.byId && NFL.byId[id]) return NFL.byId[id]; // eslint-disable-line no-undef
      if (typeof DATA !== "undefined" && DATA && DATA.games) return DATA.games.find(function (g) { return g.game_id === id; }) || null; // eslint-disable-line no-undef
    } catch (e) {}
    return null;
  }
  function ddAfter(view, label) {
    var dt = $$("dl.prices dt", view).filter(function (d) { return txt(d).toLowerCase() === label; })[0];
    return dt && dt.nextElementSibling ? txt(dt.nextElementSibling) : "";
  }

  function enhanceGame(view) {
    if (view.hidden || !view.firstElementChild || $(":scope > .pf-mtabs", view)) return;
    var id = (location.hash.match(/^#game-(.+)$/) || [])[1] || "";
    if (id !== ACTIVE.id) { ACTIVE.id = id; ACTIVE.tab = "overview"; }
    var g = window.HIDDEN_SPORT ? null : gameObj(id);
    var sport = window.HIDDEN_SPORT || (g && g.sport === "NFL" ? "nfl" : "nba");

    // 1. sort the existing panels into tabs (nothing is removed; desktop ignores the tags)
    var used = {};
    var tag = function (el, t) { el.setAttribute("data-pf-tab", t); used[t] = true; };
    Array.prototype.slice.call(view.children).forEach(function (el) {
      if (el.matches("a.back, p.permalink, h1, .eyebrow, p.note, script, style")) return;
      if (el.matches(".panel.match, article.card, .pg-preview")) return tag(el, "overview");
      if (el.matches(".out, .conf") && !el.matches(".panel")) {
        var inside = {};
        Array.prototype.slice.call(el.children).forEach(function (c) {
          var t = c.matches(".pg-preview") ? "overview" : P.classifyPanel(txt($("h2", c)));
          tag(c, t);
          inside[t] = true;
        });
        el.setAttribute("data-pf-tabs", Object.keys(inside).join(" ")); // wrapper hides when none of its panels is on show
        return;
      }
      tag(el, P.classifyPanel(txt($("h2", el))));
    });

    addLogos(view, sport);

    // 2. headline: our pick, chance gauge, light, and the price info we already show
    var pickName = g ? g.pick_name : ddAfter(view, "pick");
    var chance = g ? g.pick_p : P.splitPick("x " + ddAfter(view, "chance")).p;
    var chipEl = $(".chip", view);
    var light = g ? g.light : P.lightOf(chipEl ? chipEl.className : "");
    var price = null;
    try { price = JSON.parse(store.get("pf-price:" + id) || "null"); } catch (e) {}
    var priceRows = [];
    if (price && price.sport === sport) {
      if (price.fair) priceRows.push(["Fair price", "$" + Number(price.fair).toFixed(2)]);
      if (price.market) priceRows.push(["Market", price.market]);
      if (price.value) priceRows.push(["Value", price.value]);
    }
    var hero = document.createElement("div");
    hero.className = "pf-mhero pf-only pf-l-" + (light || "none");
    hero.setAttribute("data-pf-tab", "overview");
    hero.innerHTML = P.gaugeSvg(chance, light, { size: 132, big: true, caption: "chance", label: "Chance of our pick" }) +
      '<div class="pf-mhero-txt"><span class="pf-mhero-who">' + (pickName && pickName !== "Draw" && P.logoSrc(sport, pickName) ? P.logoHtml(sport, pickName, "", 34) : "") +
      '<span class="pf-pick-lab">Our pick</span></span><b class="pf-mhero-pick">' + esc(pickName || "Posted soon") + "</b>" +
      '<span class="pf-mhero-chips">' + P.lightChip(light) + "</span>" +
      (priceRows.length ? '<dl class="pf-price">' + priceRows.map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("") + "</dl>" +
        '<span class="pf-price-note">From Today\'s board' + (price.when ? " · " + esc(price.when) : "") + "</span>" : "") +
      "</div>";
    var firstOverview = $(":scope > [data-pf-tab='overview']", view) || $("[data-pf-tab='overview']", view);
    if (firstOverview && firstOverview.parentNode === view) view.insertBefore(hero, firstOverview); else view.insertBefore(hero, view.firstElementChild.nextSibling);
    used.overview = true;
    if (!$(".pf-lkey[data-pf-key='match']", view)) {
      var warn = /injury watch/i.test(view.textContent) || !!$(".injury-watch, .qbwarn", view);
      hero.insertAdjacentHTML("afterend", P.stackedKeyHtml(P.gameKeyRows(sport, { best: sport === "nba", injury: warn && sport !== "nfl", note: warn && sport === "nfl" ? "Quarterback news could change the pick" : "" }),
        { title: "Light key · " + (P.SPORT_NAME[sport] || sport), kind: "match", link: "/lights" }));
      var mk = $(".pf-lkey[data-pf-key='match']", view);
      if (mk) mk.setAttribute("data-pf-tab", "overview");
    }

    // 3. Props tab: NBA games only, predictions only (loaded when first opened)
    var awayName = g ? g.away_name : "", homeName = g ? g.home_name : "";
    if (sport === "nba" && g && g.status !== "post") {
      var pane = document.createElement("div");
      pane.className = "pf-props-pane pf-only";
      pane.setAttribute("data-pf-tab", "props");
      pane.setAttribute("data-away", awayName);
      pane.setAttribute("data-home", homeName);
      pane.innerHTML = '<div class="panel"><h2>Player props</h2><p class="pf-muted">Loading this game\'s player props…</p></div>';
      view.appendChild(pane);
      used.props = true;
    }

    // 4. the tab strip (only tabs that have something in them)
    var tabs = P.MATCH_TABS.filter(function (t) { return used[t[0]]; });
    if (!used[ACTIVE.tab]) ACTIVE.tab = "overview";
    var strip = document.createElement("div");
    strip.className = "pf-mtabs pf-only";
    strip.setAttribute("role", "tablist");
    strip.setAttribute("aria-label", "Match sections");
    strip.innerHTML = tabs.map(function (t) {
      return '<button type="button" role="tab" data-pf-mtab="' + t[0] + '">' + esc(t[1]) + "</button>";
    }).join("");
    if (tabs.length < 2) strip.hidden = true;
    view.insertBefore(strip, hero);
    setTab(view, ACTIVE.tab, false);
  }

  function setTab(view, t, user) {
    ACTIVE.tab = t;
    view.setAttribute("data-pf-active", t);
    $$("[data-pf-mtab]", view).forEach(function (b) {
      var on = b.getAttribute("data-pf-mtab") === t;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    if (t === "props") loadProps($(".pf-props-pane", view));
    if (user) {
      var strip = $(".pf-mtabs", view);
      if (strip && strip.getBoundingClientRect().top < 0) strip.scrollIntoView({ block: "start" });
    }
  }

  var PROPS_DOC = null;
  function propsDoc() {
    if (!PROPS_DOC) {
      PROPS_DOC = fetch("/props/nba", { credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (h) { return new DOMParser().parseFromString(h, "text/html"); })
        .catch(function (e) { PROPS_DOC = null; throw e; });
    }
    return PROPS_DOC;
  }
  function loadProps(pane) {
    if (!pane || pane.getAttribute("data-loaded")) return;
    pane.setAttribute("data-loaded", "1");
    var away = pane.getAttribute("data-away"), home = pane.getAttribute("data-home");
    propsDoc().then(function (doc) {
      var game = $$(".pp-game", doc).filter(function (s) { return P.propsGameMatches((s.getAttribute("data-teams") || "").split("|"), away, home); })[0];
      var rows = game ? $$("tr.pp-row:not(.pp-locked-row)", game).map(function (tr) {
        var tds = $$("td", tr);
        return {
          player: txt($(".pp-name", tr)),
          market: txt($("td.mk", tr)),
          line: txt(tds.filter(function (td) { return td.classList.contains("num") && !td.classList.contains("pct"); })[0]),
          call: txt($("td.call", tr)),
          p: Number(tr.getAttribute("data-p")),
          light: P.lightOf(tr.getAttribute("data-light")),
        };
      }) : [];
      var hidden = game ? $$("tr.pp-locked-row", game).length : 0;
      pane.innerHTML = '<div class="panel pf-props"><h2>Player props</h2>' +
        (rows.length
          ? '<p class="pf-muted">Our predicted side, chance and light for this game. Green first. Predictions only.</p><ul class="pf-prop-list">' + P.sortProps(rows).map(P.propRowHtml).join("") + "</ul>" +
            (hidden ? '<p class="pf-muted">More players on the Props page for members.</p>' : "")
          : '<p class="pf-muted">No player props for this game on today\'s board yet. They are posted each morning before tip-off.</p>') +
        '<a class="pf-more pf-more-sm" href="/props/nba">All NBA props<span aria-hidden="true">→</span></a></div>';
    }).catch(function () {
      pane.removeAttribute("data-loaded");
      pane.innerHTML = '<div class="panel"><h2>Player props</h2><p class="pf-muted">Props didn\'t load. <a href="/props/nba">Open the Props page</a>.</p></div>';
    });
  }


  // ------------------------------------------------------------------ team logos in the match view
  function addLogos(view, sport) {
    if (!P.logoSrc(sport, "x")) return; // tennis: players, no logos
    // big team boxes (NBA / NFL): logo inside the crest, abbreviation text hidden on phones
    $$(".side-t .crest", view).forEach(function (c) {
      if ($(".pf-crest-in", c)) return;
      var name = txt($(".tn", c.closest(".side-t"))), abbr = txt(c);
      c.classList.add("pf-crest");
      c.insertAdjacentHTML("beforeend", '<span class="pf-crest-in pf-only">' + P.logoHtml(sport, name, abbr, 60) + "</span>");
    });
    // small code boxes in the form list
    $$(".formlist .fr .badge", view).forEach(function (b) {
      if ($(".pf-crest-in", b)) return;
      var name = txt($(".t", b.closest(".fr"))), abbr = txt(b);
      if (!name) return;
      b.classList.add("pf-crest");
      b.insertAdjacentHTML("beforeend", '<span class="pf-crest-in pf-only">' + P.logoHtml(sport, name, abbr, 26) + "</span>");
    });
    // NHL / EPL / Championship match card: logo beside each team name
    $$("article.card .team .nm", view).forEach(function (n) {
      var name = txt(n), prev = n.previousElementSibling;
      if (!name || name === "Draw" || (prev && prev.classList.contains("pf-tlogo"))) return;
      n.insertAdjacentHTML("beforebegin", '<span class="pf-tlogo pf-only">' + P.logoHtml(sport, name, "", 40) + "</span>");
    });
  }

  // ------------------------------------------------------------------ props page (/props/nba)
  function propsPage() {
    root.classList.add("pf-props");
    // 1. info box → clean stats card
    var strip = $(".pp-strip");
    if (strip && !$(".pf-pstats")) {
      var info = { day: "", games: "", players: "", updated: "" }, sample = false;
      $$("span", strip).forEach(function (sp) {
        var t = txt(sp), m;
        if (sp.classList.contains("pp-sample")) { sample = true; return; }
        if ((m = t.match(/^(\d+) games?$/i))) info.games = m[1];
        else if ((m = t.match(/^(\d+) players?$/i))) info.players = m[1];
        else if ((m = t.match(/^Updated (.+)$/i))) info.updated = m[1];
        else if (t) info.day = t;
      });
      var cell = function (k, v) { return v ? '<div class="pf-stat"><small>' + k + "</small><b>" + esc(v) + "</b></div>" : ""; };
      strip.insertAdjacentHTML("afterend", '<div class="pf-pstats pf-only" role="status">' + (sample ? '<span class="pf-sample">Sample data</span>' : "") +
        '<div class="pf-stat-grid">' + cell("Date", info.day) + cell("Games", info.games) + cell("Players", info.players) + cell("Updated", info.updated) + "</div></div>");
    }
    // 2. filters → custom pickers (Game, Team) and a chip row (Market); the real selects stay and keep driving the filters
    var g = document.getElementById("ppGame"), t = document.getElementById("ppTeam"), m = document.getElementById("ppMarket");
    var host = g && g.closest(".pp-selects");
    if (host && !$(".pf-filters", host.parentNode)) {
      var box = document.createElement("div");
      box.className = "pf-filters pf-only";
      host.parentNode.insertBefore(box, host);
      if (g) box.appendChild(sheetPicker(g, "Game"));
      if (t) box.appendChild(sheetPicker(t, "Team"));
      if (m) box.appendChild(chipPicker(m, "Market"));
      host.classList.add("pf-replaced");
    }
    // 3. lights key, one line each: the props scale, labelled as its own scale
    var legend = document.getElementById("ppLegend");
    if (legend && !$(".pf-lkey[data-pf-key='props']")) {
      legend.insertAdjacentHTML("afterend", P.stackedKeyHtml(P.propsKeyRows(), {
        title: "Props scale", kind: "props",
        sub: "Props use their own scale, because player stats swing more than match results.",
        note: "Green first, then highest chance.",
      }));
      var key = legend.nextElementSibling;
      legend.classList.add("pf-replaced");
      var sync = function () { key.hidden = legend.hidden; };
      new MutationObserver(sync).observe(legend, { attributes: true, attributeFilter: ["hidden"] });
      sync();
    }
  }
  var labelOf = function (sel) { var o = sel.options[sel.selectedIndex]; return o ? o.textContent : ""; };
  function choose(sel, v) {
    if (sel.value === v) return;
    sel.value = v;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  var CHEVRON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function sheetPicker(sel, label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "pf-pick-btn";
    b.setAttribute("aria-haspopup", "dialog");
    var paint = function () {
      b.innerHTML = '<span class="pf-pick-txt"><small>' + esc(label) + "</small><b>" + esc(labelOf(sel)) + "</b></span>" + CHEVRON;
      b.classList.toggle("pf-set", sel.selectedIndex > 0);
    };
    paint();
    sel.addEventListener("change", paint);
    b.addEventListener("click", function () { openSheet(sel, label, b); });
    return b;
  }
  function openSheet(sel, label, opener) {
    var wrap = document.createElement("div");
    wrap.className = "pf-sheet-wrap";
    wrap.innerHTML = '<div class="pf-sheet-bg" data-pf-close></div><div class="pf-sheet" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' +
      '<div class="pf-sheet-grab" aria-hidden="true"></div><div class="pf-sheet-head"><b>' + esc(label) + '</b><button type="button" class="pf-sheet-x" data-pf-close aria-label="Close">✕</button></div>' +
      '<ul class="pf-sheet-list">' + Array.prototype.map.call(sel.options, function (o, i) {
        var on = i === sel.selectedIndex;
        return '<li><button type="button" data-v="' + esc(o.value) + '"' + (on ? ' aria-current="true"' : "") + "><span>" + esc(o.textContent) + "</span>" + (on ? '<i aria-hidden="true">✓</i>' : "") + "</button></li>";
      }).join("") + "</ul></div>";
    document.body.appendChild(wrap);
    root.classList.add("pf-sheet-open");
    var onKey = function (e) { if (e.key === "Escape") close(); };
    var close = function () {
      wrap.remove();
      root.classList.remove("pf-sheet-open");
      document.removeEventListener("keydown", onKey);
      opener.focus();
    };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", function (e) {
      if (e.target.closest("[data-pf-close]")) return close();
      var o = e.target.closest("[data-v]");
      if (o) { choose(sel, o.getAttribute("data-v")); close(); }
    });
    requestAnimationFrame(function () {
      wrap.classList.add("pf-in");
      var cur = $("[aria-current]", wrap) || $("[data-v]", wrap);
      if (cur) { cur.focus({ preventScroll: true }); cur.scrollIntoView({ block: "nearest" }); }
    });
  }
  function chipPicker(sel, label) {
    var box = document.createElement("div");
    box.className = "pf-chipset";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", label);
    var paint = function () {
      box.innerHTML = '<small class="pf-chipset-lab">' + esc(label) + '</small><div class="pf-chiprow">' + Array.prototype.map.call(sel.options, function (o, i) {
        return '<button type="button" data-v="' + esc(o.value) + '" aria-pressed="' + (i === sel.selectedIndex) + '">' + esc(o.value ? o.textContent : "All") + "</button>";
      }).join("") + "</div>";
    };
    paint();
    sel.addEventListener("change", paint);
    box.addEventListener("click", function (e) { var o = e.target.closest("[data-v]"); if (o) choose(sel, o.getAttribute("data-v")); });
    return box;
  }

  // ------------------------------------------------------------------ player page chart legend
  function playerPage() {
    var run = function () {
      $$("figure.bc > figcaption:not(.pf-replaced)").forEach(function (fc) {
        var m = txt(fc).match(/^(.+?), last (\d+) games?\. Dashed line: (.+?) \(([-\d.]+)\)/i);
        if (!m) return;
        var lineLab = /line/i.test(m[3]) ? "Line" : m[3].charAt(0).toUpperCase() + m[3].slice(1);
        fc.classList.add("pf-replaced");
        fc.insertAdjacentHTML("afterend", '<div class="pf-bcl pf-only"><b class="pf-bcl-t">' + esc(m[1]) + " – last " + esc(m[2]) + " games</b>" +
          '<span class="pf-bcl-keys"><span><i class="pf-sq pf-sq-over" aria-hidden="true"></i>Over</span><span><i class="pf-sq pf-sq-under" aria-hidden="true"></i>Under</span>' +
          '<span><i class="pf-dash" aria-hidden="true"></i>' + esc(lineLab) + " " + esc(m[4]) + "</span></span></div>");
      });
    };
    run();
    var main = $("main");
    if (main) new MutationObserver(debounce(run, 50)).observe(main, { childList: true, subtree: true }); // members view re-renders the page body
  }

  // ------------------------------------------------------------------ results page: green record first
  function resultsPage() {
    var main = $("main.wrap");
    if (!main || $(".pf-rtop", main)) return;
    root.classList.add("pf-results");
    var lead = $(".green-lead", main), hero = lead && $(".record-hero", lead), h1 = $(":scope > h1", main);
    if (hero && h1) {
      var top = document.createElement("section");
      top.className = "pf-rtop pf-only";
      top.innerHTML = '<p class="pf-rtop-lab"><i aria-hidden="true"></i>Green record · every sport</p>';
      top.appendChild(hero.cloneNode(true));
      h1.parentNode.insertBefore(top, h1.nextSibling);
    }
    if (lead && !$(".pf-rlinks", lead)) {
      // the cut-off list lives in the Light key; keep the links as one short line here
      $$("p", lead).forEach(function (q) { if (/fair to add the green totals/i.test(q.textContent)) q.classList.add("pf-replaced"); });
      lead.insertAdjacentHTML("beforeend", '<p class="small pf-rlinks pf-only"><a href="/backtest">Backtest</a> · <a href="/how-it-works">How it works</a> · <a href="/lights">How the lights work</a></p>');
    }
    if (lead && !$(".pf-lkey[data-pf-key='results']", main)) {
      lead.insertAdjacentHTML("afterend", P.stackedKeyHtml(P.gameKeyRows("all", { best: true }), { title: "Light key · every sport", kind: "results", link: "/lights" }));
    }
    var seenIntro = false;
    Array.prototype.slice.call(main.children).forEach(function (el) {
      var o = 9;
      if (el.matches("nav.crumbs")) o = 0;
      else if (el.matches("p.eyebrow")) o = 1;
      else if (el.matches("h1")) o = 2;
      else if (el.matches(".pf-rtop")) o = 3;
      else if (el.id === "growth") o = 4;
      else if (el.matches(".record-grid")) o = 5;
      else if (el.matches("p:not(.note)") && !seenIntro) { o = 6; seenIntro = true; el.classList.add("pf-replaced"); } // intro: its links are in the Green results box
      else if (el.matches(".green-lead, .pf-lkey")) o = 7;
      else if (el.matches(".trust-strip")) o = 8;
      else if (el.id === "picks") o = 10;
      else if (el.matches("p.note")) o = 11;
      el.setAttribute("data-pf-order", String(o));
    });
  }


  // ------------------------------------------------------------------ stacked lights keys (every page)
  function pageSport() {
    if (window.HIDDEN_SPORT) return window.HIDDEN_SPORT;
    try { if (typeof SP !== "undefined" && SP) return SP; } catch (e) {} // eslint-disable-line no-undef
    return "nba";
  }
  var after = function (el, html) { el.insertAdjacentHTML("afterend", html); el.classList.add("pf-replaced"); };
  function lightKeys(doc) {
    // inline keys in the sport views (NBA, NFL, NHL, EPL, Championship, tennis): that sport's scale
    $$(".legend[aria-label='Light key']:not(.pf-replaced)", doc).forEach(function (lg) {
      var sport = pageSport(), t = lg.textContent;
      var note = /important note/i.test(t);
      after(lg, P.stackedKeyHtml(P.gameKeyRows(sport, {
        best: !!$(".chip.SUPER", lg), injury: /injury/i.test(t),
        note: note ? (sport === "nfl" ? "Quarterback news could change the pick" : "News could change the pick") : "",
      }), { title: "Light key", kind: "view", link: "/lights" }));
    });
    // Today: every sport on one board, so the multi-sport scale (or one sport's when filtered)
    $$("p.legend-line:not(.pf-replaced)", doc).forEach(function (lg) {
      var q = new URLSearchParams(location.search), sp = q.get("sport") || "all";
      after(lg, P.stackedKeyHtml(P.gameKeyRows(P.GAME_SCALE[sp] ? sp : "all", { best: !!$(".chip.SUPER", lg), injury: /injury/i.test(lg.textContent) }),
        { title: "Light key", kind: "today", link: "/lights" }));
    });
    // definition lists (How the lights work, How it works, About): keep each page's own words
    $$("div.lights:not(.pf-replaced)", doc).forEach(function (box) {
      var rows = $$(":scope > div", box).map(function (d) {
        var c = $(".chip", d), p = $("p", d);
        var l = c ? P.lightOf(c.className) : "";
        return l && p ? { light: l, label: P.LIGHT_LABEL[l], rangeHtml: p.innerHTML, long: true } : null;
      }).filter(Boolean);
      if (rows.length) after(box, P.stackedKeyHtml(rows, { kind: "lights" }));
    });
  }

  // ------------------------------------------------------------------ Today: every sport, with counts
  function sportChips() {
    var bar = $(".game-filter-bar");
    var serverNav = bar && $("nav.game-filters.sports", bar);
    if (!bar || $(".pf-sportchips", bar)) return;
    var q = new URLSearchParams(location.search);
    var cur = (q.get("sport") || "all").toLowerCase(), light = (q.get("light") || "green").toLowerCase();
    var holder = document.createElement("div");
    holder.className = "pf-sc-wrap pf-only";
    holder.innerHTML = P.sportChipsHtml({}, cur, light).replace(/<span class="pf-sc-n">0<\/span>/g, '<span class="pf-sc-n">·</span>') + '<div class="pf-sc-msg" role="status" hidden></div>';
    bar.insertBefore(holder, bar.firstChild);
    if (serverNav) serverNav.classList.add("pf-replaced");
    var counts = null;
    var paint = function () {
      var nav = $(".pf-sportchips", holder);
      nav.outerHTML = P.sportChipsHtml(counts, cur, light);
    };
    // counts: every sport, every light, from the same board (a sport that failed to load shows no number)
    fetch("/today?light=all", { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (h) {
        var doc = new DOMParser().parseFromString(h, "text/html"), loaded = {};
        P.TODAY_SPORTS.forEach(function (s) {
          var sec = doc.getElementById(s[0]);
          loaded[s[0]] = !!sec && !/couldn.t load/i.test(sec.textContent);
        });
        counts = P.sportCounts(rowsFromToday(doc), light, loaded);
        paint();
      })
      .catch(function () {});
    holder.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button[data-pf-sport]");
      if (!b || !counts) return;
      var sport = b.getAttribute("data-pf-sport"), box = $(".pf-sc-msg", holder);
      $$(".pf-sc", holder).forEach(function (x) { x.classList.toggle("pf-sc-tapped", x === b); });
      var show = function (nx) {
        var m = P.noGamesText(sport, counts, light, nx && nx.iso, nx && nx.tbc);
        box.innerHTML = "<b>" + esc(m.text) + "</b>" + (m.next ? "<span>" + esc(m.next) + "</span>" : "") +
          (m.more ? '<a href="' + esc(m.href) + '">' + esc(m.more) + '<span aria-hidden="true"> →</span></a>' : "");
        box.hidden = false;
      };
      show(null);
      if ((counts[sport] || {}).total === 0) {
        fetch(P.NEXT_SOURCE[sport], { credentials: "same-origin" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { if (d) show(P.nextStart(sport, d, Date.now())); })
          .catch(function () {});
      }
    });
  }

  // ------------------------------------------------------------------ Today: games in the window vs picks shown
  function countLine() {
    var intro = $$("main p").filter(function (q) { return /tip off in the next 24 hours/i.test(q.textContent); })[0];
    if (!intro || $(".pf-count")) return;
    var m = intro.textContent.match(/(\d+) games? tip off/);
    var total = m ? Number(m[1]) : 0;
    var shown = $$("section.panel[id] ul.today-games > li:not(.head)").length;
    var q = new URLSearchParams(location.search);
    var light = (q.get("light") || "green").toLowerCase(), sport = (q.get("sport") || "all").toLowerCase();
    intro.insertAdjacentHTML("beforebegin", '<p class="pf-count pf-only">' + esc(P.todayCountLine(total, shown, light, sport)) + "</p>");
    intro.classList.add("pf-replaced");
  }

  // ------------------------------------------------------------------ installable web app
  var deferredPrompt = null;
  function installable() {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
    }
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      installTile();
    });
    window.addEventListener("appinstalled", function () { deferredPrompt = null; local.set("pf-installed", "1"); installTile(); });
  }
  function standalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function installTile() {
    var el = document.getElementById("pfInstall");
    if (!el) return;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (standalone() || local.get("pf-install-dismissed") || local.get("pf-installed") || (!deferredPrompt && !ios)) { el.hidden = true; return; }
    el.innerHTML = '<img src="/icon-192.png" width="44" height="44" alt="">' +
      '<div><b>Add ProbaLab to your Home Screen</b><small>' + (deferredPrompt ? "Opens full screen, like an app." : "Tap Share, then Add to Home Screen.") + "</small></div>" +
      (deferredPrompt ? '<button type="button" class="pf-install-go">Install</button>' : "") +
      '<button type="button" class="pf-install-x" aria-label="Dismiss">✕</button>';
    el.hidden = false;
    var go = $(".pf-install-go", el);
    if (go) go.onclick = function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; installTile(); });
    };
    $(".pf-install-x", el).onclick = function () { local.set("pf-install-dismissed", "1"); el.hidden = true; };
  }
})();
