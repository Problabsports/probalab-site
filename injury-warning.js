/* Injury watch: "more" opens full note popover. Esc / outside click closes.
   On devices that hover, mouseenter on "more" opens and leaving closes. */
(function () {
  let openPop = null;
  const canHover = () => window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function closeInjuryPop() {
    if (!openPop) return;
    const { btn, pop } = openPop;
    btn.setAttribute("aria-expanded", "false");
    btn.removeAttribute("aria-controls");
    pop.remove();
    openPop = null;
  }

  function openInjuryPop(btn) {
    const note = btn.getAttribute("data-injury-note") || "";
    if (!note) return;
    closeInjuryPop();
    const pop = document.createElement("div");
    pop.className = "injury-popover tipster-popover";
    pop.id = "injury-pop-" + Math.random().toString(36).slice(2, 9);
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Injury watch");
    const title = document.createElement("p");
    title.className = "tipster-pop-title";
    title.textContent = "⚠️ Injury watch";
    const body = document.createElement("p");
    body.className = "tipster-pop-body";
    body.textContent = note;
    pop.appendChild(title);
    pop.appendChild(body);
    const host = btn.closest(".injury-watch, li, .card-top, article.card, .panel.pick, .row, dd") || btn.parentElement || document.body;
    if (host && getComputedStyle(host).position === "static") host.style.position = "relative";
    host.appendChild(pop);
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-controls", pop.id);
    openPop = { btn, pop };
    requestAnimationFrame(function () {
      const r = pop.getBoundingClientRect();
      if (r.right > window.innerWidth - 8) {
        pop.style.left = Math.max(8, window.innerWidth - r.width - 8 - host.getBoundingClientRect().left) + "px";
      }
      if (r.bottom > window.innerHeight - 8) {
        pop.style.top = "auto";
        pop.style.bottom = "calc(100% + 8px)";
      }
    });
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest && e.target.closest(".injury-warn-btn");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      if (openPop && openPop.btn === btn) { closeInjuryPop(); return; }
      openInjuryPop(btn);
      return;
    }
    if (openPop && !(e.target.closest && e.target.closest(".injury-popover"))) closeInjuryPop();
  }, true);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeInjuryPop();
  });

  document.addEventListener("mouseover", function (e) {
    if (!canHover()) return;
    const btn = e.target.closest && e.target.closest(".injury-warn-btn");
    if (!btn) return;
    if (openPop && openPop.btn === btn) return;
    openInjuryPop(btn);
  });

  document.addEventListener("mouseout", function (e) {
    if (!canHover() || !openPop) return;
    const related = e.relatedTarget;
    if (related && (openPop.btn.contains(related) || openPop.pop.contains(related))) return;
    const t = e.target;
    if (t === openPop.btn || openPop.btn.contains(t) || t === openPop.pop || openPop.pop.contains(t)) {
      closeInjuryPop();
    }
  });
})();
