/* ProbaLab odds format: any <span class="odds" data-dec="1.45"> shows in the visitor's chosen format.
   Any <button class="oddsfmt"> cycles Decimal -> American -> Implied % for every price on the page. Saved in localStorage. */
(function () {
  var MODES = ["dec", "us", "pct"], LABEL = { dec: "Decimal", us: "American", pct: "Implied %" }, SHORT = { dec: "DEC", us: "US", pct: "%" };
  var mode = "dec"; try { mode = localStorage.getItem("pl_odds_fmt") || "dec"; } catch (e) {}
  if (MODES.indexOf(mode) < 0) mode = "dec";
  function fmt(d, m) {
    d = Number(d); if (!(d > 1)) return "—";
    m = m || mode;
    if (m === "us") return d >= 2 ? "+" + Math.round((d - 1) * 100) : "-" + Math.round(100 / (d - 1));
    if (m === "pct") return (100 / d).toFixed(1).replace(/\.0$/, "") + "%";
    return d.toFixed(2);
  }
  function apply(root) {
    (root || document).querySelectorAll(".odds[data-dec]").forEach(function (el) {
      var t = fmt(el.getAttribute("data-dec")); if (el.textContent !== t) el.textContent = t;
      el.title = "Decimal " + fmt(el.getAttribute("data-dec"), "dec") + " · American " + fmt(el.getAttribute("data-dec"), "us") + " · Implied " + fmt(el.getAttribute("data-dec"), "pct");
    });
    (root || document).querySelectorAll("button.oddsfmt").forEach(function (b) {
      var t = SHORT[mode] + " ⇄"; if (b.textContent !== t) b.textContent = t;
      b.setAttribute("aria-label", "Odds shown as " + LABEL[mode] + ". Tap to change format.");
      b.title = "Odds shown as " + LABEL[mode] + " — tap to switch";
    });
  }
  function setMode(m) { mode = m; try { localStorage.setItem("pl_odds_fmt", m); } catch (e) {} apply(); document.dispatchEvent(new CustomEvent("pl-odds-fmt", { detail: m })); }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button.oddsfmt"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
  }, true);
  var css = document.createElement("style");
  css.textContent = "button.oddsfmt{font:600 10px/1 inherit;letter-spacing:.04em;padding:3px 6px;margin-left:6px;border-radius:999px;border:1px solid rgba(99,179,255,.5);background:rgba(99,179,255,.1);color:#63b3ff;cursor:pointer;vertical-align:middle;white-space:nowrap}button.oddsfmt:hover{background:rgba(99,179,255,.22)}.odds{font-variant-numeric:tabular-nums;white-space:nowrap}";
  document.head.appendChild(css);
  var pending = false;
  new MutationObserver(function () { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; apply(); }); }).observe(document.documentElement, { childList: true, subtree: true });
  window.PLOdds = { fmt: fmt, apply: apply, setMode: setMode, get mode() { return mode; } };
  if (document.readyState !== "loading") apply(); else document.addEventListener("DOMContentLoaded", function () { apply(); });
})();
