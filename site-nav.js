/* Accessible site menu drawer. Esc closes; overlay click closes; toggle aria-expanded.
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
  function placeNav() {
    if (mq.matches) {
      if (nav.parentNode !== document.body) document.body.appendChild(nav);
    } else {
      if (isOpen()) set(false);
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
      var first = nav.querySelector("a");
      if (first) first.focus();
    } else if (document.activeElement && nav.contains(document.activeElement)) {
      btn.focus();
    }
  }

  placeNav();
  if (mq.addEventListener) mq.addEventListener("change", placeNav);
  else if (mq.addListener) mq.addListener(placeNav);

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    set(!isOpen());
  });
  backdrop.addEventListener("click", function () { if (isOpen()) set(false); });
  nav.addEventListener("click", function (e) {
    if (e.target.closest("a") && isOpen()) set(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) { e.preventDefault(); set(false); }
  });
})();
