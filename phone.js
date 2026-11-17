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
    new MutationObserver(debounce(function () { if (mq.matches) relabel(document.body); }, 60)).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", markTab);
    window.addEventListener("popstate", markTab);
    if (location.pathname === "/today") todayPage();
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
      '<div class="pf-mhero-txt"><span class="pf-pick-lab">Our pick</span><b class="pf-mhero-pick">' + esc(pickName || "Posted soon") + "</b>" +
      '<span class="pf-mhero-chips">' + P.lightChip(light) + "</span>" +
      (priceRows.length ? '<dl class="pf-price">' + priceRows.map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("") + "</dl>" +
        '<span class="pf-price-note">From Today\'s board' + (price.when ? " · " + esc(price.when) : "") + "</span>" : "") +
      "</div>";
    var firstOverview = $(":scope > [data-pf-tab='overview']", view) || $("[data-pf-tab='overview']", view);
    if (firstOverview && firstOverview.parentNode === view) view.insertBefore(hero, firstOverview); else view.insertBefore(hero, view.firstElementChild.nextSibling);
    used.overview = true;

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
