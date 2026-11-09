/* Accessible site menu drawer + Sports dropdown.
   Drawer: Esc / overlay closes; toggle aria-expanded.
   Sports: desktop hover + click + keyboard; mobile expands as a sub-list.
   On the drawer breakpoint the nav is moved to document.body so position:fixed
   is viewport-relative (a sticky/filtered header would otherwise trap it). */
(function () {
  var btn = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-menu");
  if (!btn || !nav) return;
  var home = nav.parentNode;
  var backdrop = document.createElement("div");
  backdrop.className = "nav-backdrop";
  backdrop.setAttribute("hidden", "");
  document.body.appendChild(backdrop);

  var mq = window.matchMedia("(max-width: 1180px)");
  function isDrawer() { return mq.matches; }

  function placeNav() {
    if (isDrawer()) {
      if (nav.parentNode !== document.body) document.body.appendChild(nav);
    } else {
      if (isOpen()) set(false);
      closeAllDd();
      if (home && nav.parentNode !== home) home.appendChild(nav);
    }
  }

  function isOpen() { return nav.classList.contains("is-open"); }
  function set(open) {
    nav.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    if (open) backdrop.removeAttribute("hidden");
    else backdrop.setAttribute("hidden", "");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
    if (open) {
      // Mobile: open Sports sub-list by default so hubs are visible without an extra tap.
      document.querySelectorAll("[data-nav-dd]").forEach(function (dd) {
        setDd(dd, true);
      });
      var first = nav.querySelector("a, .nav-dd-btn");
      if (first) first.focus();
    } else if (document.activeElement && nav.contains(document.activeElement)) {
      btn.focus();
    }
  }

  function setDd(dd, open) {
    var b = dd.querySelector(".nav-dd-btn");
    var panel = dd.querySelector(".nav-dd-panel");
    if (!b || !panel) return;
    b.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
  }
  function closeAllDd(except) {
    document.querySelectorAll("[data-nav-dd]").forEach(function (dd) {
      if (except && dd === except) return;
      setDd(dd, false);
    });
  }
  function panelItems(panel) {
    return Array.prototype.slice.call(panel.querySelectorAll("a"));
  }

  document.querySelectorAll("[data-nav-dd]").forEach(function (dd) {
    var b = dd.querySelector(".nav-dd-btn");
    var panel = dd.querySelector(".nav-dd-panel");
    if (!b || !panel) return;

    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = b.getAttribute("aria-expanded") === "true";
      if (!isDrawer()) closeAllDd(dd);
      setDd(dd, !open);
      if (!open) {
        var first = panelItems(panel)[0];
        if (first && !isDrawer()) first.focus();
      }
    });

    dd.addEventListener("mouseenter", function () {
      if (isDrawer() || !(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches)) return;
      closeAllDd(dd);
      setDd(dd, true);
    });
    dd.addEventListener("mouseleave", function () {
      if (isDrawer()) return;
      setDd(dd, false);
    });

    b.addEventListener("keydown", function (e) {
      var items = panelItems(panel);
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setDd(dd, true);
        if (items[0]) items[0].focus();
      } else if (e.key === "Escape") {
        setDd(dd, false);
      }
    });

    panel.addEventListener("keydown", function (e) {
      var items = panelItems(panel);
      var i = items.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        setDd(dd, false);
        b.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (i >= 0) items[(i + 1) % items.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (i >= 0) items[(i - 1 + items.length) % items.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        if (items[0]) items[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        if (items.length) items[items.length - 1].focus();
      }
    });
  });

  placeNav();
  if (mq.addEventListener) mq.addEventListener("change", placeNav);
  else if (mq.addListener) mq.addListener(placeNav);

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    set(!isOpen());
  });
  backdrop.addEventListener("click", function () { if (isOpen()) set(false); });
  nav.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (a && isOpen()) set(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) { e.preventDefault(); set(false); }
    else if (e.key === "Escape") closeAllDd();
  });
  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("[data-nav-dd]")) return;
    if (!isDrawer()) closeAllDd();
  });
})();
