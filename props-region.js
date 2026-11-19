/* Props prices by country (/props/nba, /props/nfl, /props/nhl). Loaded before the board so the right prices show
   from the first paint: sets <html data-region="au|us">; props.css hides the other region's price cells.
   - A manual AU / US choice (the toggle) wins and is remembered (localStorage pl_props_region).
   - Otherwise the country from /api/geo (Cloudflare, asked once, kept in localStorage pl_geo_country):
     US -> US prices, anything else or unknown -> AU prices. Until it answers, AU. */
(function () {
  "use strict";
  var MANUAL = "pl_props_region", GEO = "pl_geo_country";
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function fromCountry(c) { return String(c || "").toUpperCase() === "US" ? "us" : "au"; }
  function manual() { var m = get(MANUAL); return m === "au" || m === "us" ? m : null; }
  function sync() {
    var rg = root.getAttribute("data-region") || "au";
    var btns = document.querySelectorAll("[data-set-region]");
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute("data-set-region") === rg;
      btns[i].classList.toggle("on", on);
      btns[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }
  function apply(rg) {
    rg = rg === "us" ? "us" : "au";
    root.setAttribute("data-region", rg);
    sync();
    try { document.dispatchEvent(new CustomEvent("pl:region", { detail: { region: rg } })); } catch (e) {}
  }

  var geo = get(GEO);
  apply(manual() || (geo ? fromCountry(geo) : "au"));
  if (!geo && window.fetch) {
    fetch("/api/geo", { credentials: "omit", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;                                   // try again on the next visit
        put(GEO, d.country || "XX");                      // unknown is kept too: AU prices
        if (!manual()) apply(fromCountry(d.country));
      })
      .catch(function () {});
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-set-region]");
    if (!b) return;
    var rg = b.getAttribute("data-set-region") === "us" ? "us" : "au";
    put(MANUAL, rg);
    apply(rg);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync); else sync();
  window.PLRegion = { get: function () { return root.getAttribute("data-region") === "us" ? "us" : "au"; }, set: apply };
})();
