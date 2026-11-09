/* Accessible site menu drawer. Esc closes; overlay click closes; toggle aria-expanded. */
(function () {
  var btn = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-menu");
  if (!btn || !nav) return;
  var backdrop = document.createElement("div");
  backdrop.className = "nav-backdrop";
  backdrop.setAttribute("hidden", "");
  nav.parentNode.appendChild(backdrop);

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
    } else {
      btn.focus();
    }
  }
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
