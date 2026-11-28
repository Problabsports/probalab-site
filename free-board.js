/* free-board.js — soft email unlock for the free board, plus the shared sign-up submit (window.PLSignup).
 *
 * Free for everyone: Today's top pick and the first 2 upcoming games per sport on each list. From game #3 on
 * (home, /today, sport pages), unless localStorage pl_free_unlocked === "1" or a member is signed in, only the
 * model numbers are blurred: win chance, fair price, the pick and its light. Team names, kickoff times and the HTML
 * itself are untouched (crawlers and screen readers still get the full page). This is a soft gate by design.
 *
 * One inline unlock card sits above the first locked game. Submitting it posts to /api/subscribe (Supabase
 * newsletter_signups; an email already on file still returns ok), then sets pl_free_unlocked=1 and unblurs every
 * game straight away, no reload. The home page callout uses PLSignup.submit too, so it unlocks the board as well.
 */
(function () {
  "use strict";
  var KEY = "pl_free_unlocked";
  var DISCORD = "https://discord.gg/B8Q2hH26hV"; // same invite as functions/_shared/discord.js
  var SITEKEY = "0x4AAAAAAF1-8hWamb8_PqUn";
  var FREE_PER_SPORT = 2;
  var HEADLINE = "Unlock today’s full NBA, NFL & NHL fair-odds board — 100% Free";
  var SUBTEXT = "Enter your email once for instant full-board access on this device, our free Discord live-alert link, and ProbaLab recap updates.";
  var DONE_BTN = "Board Unlocked — Join Free Discord for Live Alerts";

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} },
  };
  /** A signed-in Supabase session (members pages persist it as sb-<project>-auth-token). */
  function memberSession() {
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (/^sb-[a-z0-9]+-auth-token$/.test(k || "")) {
          var v = window.localStorage.getItem(k) || "";
          if (v.indexOf("access_token") >= 0 || v.indexOf("refresh_token") >= 0) return true;
        }
      }
    } catch (e) {}
    return false;
  }
  function isUnlocked() { return store.get(KEY) === "1" || memberSession(); }
  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  // ------------------------------------------------------------------ shared sign-up (Turnstile optional)
  var tsLoad = null;
  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (tsLoad) return tsLoad;
    tsLoad = new Promise(function (res, rej) {
      var sc = document.createElement("script");
      sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      sc.async = true;
      sc.onload = function () { window.turnstile ? res(window.turnstile) : rej(new Error("turnstile")); };
      sc.onerror = function () { tsLoad = null; rej(new Error("turnstile")); };
      document.head.appendChild(sc);
    });
    return tsLoad;
  }
  /** A Turnstile token, or "" if the widget can't load, errors or stalls: the server only demands a token when
   *  TURNSTILE_SECRET is configured, so a broken or missing key never blocks a real visitor. */
  function turnstileToken(form) {
    var box = form.querySelector("[data-ts]");
    if (!box) return Promise.resolve("");
    var widget = loadTurnstile().then(function (ts) {
      return new Promise(function (res, rej) {
        if (form._tsId != null) { try { ts.remove(form._tsId); } catch (e) {} }
        box.innerHTML = "";
        form._tsId = ts.render(box, {
          sitekey: SITEKEY, action: "subscribe", theme: "dark", appearance: "interaction-only",
          callback: res, "error-callback": function () { rej(new Error("ts")); }, "timeout-callback": function () { rej(new Error("ts")); },
        });
      });
    });
    var giveUp = new Promise(function (res) { setTimeout(function () { res(""); }, 12000); });
    return Promise.race([widget, giveUp]).catch(function () { return ""; });
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  /** Posts a sign-up form ({email, website, source}). Resolves {ok, message} or {ok:false, error}. Unlocks on ok. */
  function submit(form) {
    var email = String(form.email.value || "").trim();
    if (!EMAIL_RE.test(email)) return Promise.resolve({ ok: false, error: "Please enter a valid email address.", field: true });
    return turnstileToken(form).then(function (token) {
      return fetch("/api/subscribe", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email, website: form.website ? form.website.value : "", source: form.source ? form.source.value : "", "cf-turnstile-response": token }),
      }).then(function (r) { return r.json(); });
    }).then(function (j) {
      if (j && j.ok) unlock();
      return j && typeof j === "object" ? j : { ok: false, error: "Something went wrong. Please try again." };
    }).catch(function () { return { ok: false, error: "Something went wrong. Please try again." }; });
  }
  document.addEventListener("focusin", function (e) {
    if (e.target && e.target.closest && e.target.closest("form[data-signup], form[data-unlock]")) loadTurnstile().catch(function () {});
  });

  // ------------------------------------------------------------------ the gate
  // Pages with an upcoming board. Game pages, results, teams and members are never gated.
  var PATH_OK = /^\/(?:(?:today|nba|nfl|nhl|epl)(?:\/(?:app|today))?)?\/?$/;
  var now = function () { return Date.now(); };
  var upcoming = function (el) {
    var s = el.getAttribute("data-start");
    var t = s ? Date.parse(s) : NaN;
    return !isFinite(t) || t > now() - 3 * 3600e3;
  };
  var TYPES = [
    { id: "card", sel: "article.card[data-sport]",
      skip: function (el) { return el.classList.contains("done") || !!el.closest(".hp-pick") || !upcoming(el); },
      sport: function (el) { return el.getAttribute("data-sport"); },
      key: function (el) { return el.getAttribute("data-game") || el.getAttribute("data-abbr") + el.getAttribute("data-start"); } },
    { id: "row", sel: "ul.games > li[data-sport]",
      skip: function (el) { return !!el.querySelector(".r") || !upcoming(el); },
      sport: function (el) { return el.getAttribute("data-sport"); },
      key: function (el) { var a = el.querySelector("a[href]"); return a ? a.getAttribute("href") : el.getAttribute("data-abbr") + el.getAttribute("data-start"); } },
    { id: "pf", sel: ".pf-card[data-pf-key]",
      skip: function (el) { return !!el.querySelector(".pf-res"); },
      sport: function (el) { return String(el.getAttribute("data-pf-key") || "").split(":")[0]; },
      key: function (el) { return el.getAttribute("data-pf-key"); } },
    { id: "tick", sel: ".ticker .track > a", card: false,
      skip: function () { return false; },
      sport: function (el) { var s = el.querySelector("small"); return s ? s.textContent.trim().toLowerCase() : "x"; },
      key: function (el) { return el.getAttribute("href"); } },
  ];

  var CSS = [
    ".pl-lock-card :is(.chip,.bv-tag,.tipflag,.pc,.bar,.prices dd),",
    ".pl-lock-row :is(.p,.chip-with-warn,.fp,.gap,.best-tag),",
    ".pl-lock-pf :is(.pf-lights,.pf-gauge,.pf-pick b,.pf-foot-r,.pf-tick),",
    ".pl-lock-tick :is(b,.pc){filter:blur(6px) grayscale(1);-webkit-user-select:none;user-select:none;opacity:.8}",
    ".pl-lock-card.tip,.pl-lock-card.super{border-color:var(--line-hi,#2a3150)!important;box-shadow:none!important}",
    ".pl-lock-card.tip::before,.pl-lock-card.super::before{display:none!important}",
    ".pl-lock-row.has-value{background:none!important}",
    ".pl-lock-pf{--pf-lc:var(--pf-line-hi,#343d5e)!important;--pf-lc-soft:rgba(52,61,94,.2)!important}",
    "html.pf .pf-card.pl-lock-pf{box-shadow:inset 4px 0 0 var(--pf-line-hi,#343d5e)!important}",
    ".pl-lock-pf .pf-team.pf-picked{font-weight:inherit!important;color:inherit!important}",
    ".pl-unlock-wrap,ul.games>li.pl-unlock-wrap{display:block!important;list-style:none;grid-column:1/-1;margin:12px 0!important;padding:0!important;border:0!important;background:none!important;min-height:0!important}",
    ".pl-unlock{position:relative;padding:18px;border:1px solid var(--cyan,#19e3ff);border-radius:12px;color:var(--ink,#e8ecf5);",
    "background:linear-gradient(160deg,rgba(25,227,255,.12),rgba(255,47,192,.06) 70%);box-shadow:0 0 32px rgba(25,227,255,.18)}",
    ".pl-unlock .plu-eyebrow{margin:0 0 6px;font:600 11px var(--f-mono,monospace);letter-spacing:.16em;text-transform:uppercase;color:var(--cyan,#19e3ff)}",
    ".pl-unlock .plu-title{margin:0 0 6px;font:700 clamp(17px,2.2vw,21px)/1.2 var(--f-display,inherit);letter-spacing:.02em;text-transform:none;color:var(--ink,#fff)}",
    ".pl-unlock .plu-sub{margin:0 0 12px;font-size:14px;line-height:1.45;color:var(--muted,#8a96ab)}",
    ".pl-unlock .plu-row{display:flex;gap:8px;flex-wrap:wrap}",
    ".pl-unlock input[type=email]{flex:1 1 200px;min-width:0;min-height:48px;box-sizing:border-box;background:var(--bg,#07080f);color:var(--ink,#fff);border:1px solid var(--line-hi,#2a3150);border-radius:10px;padding:10px 12px;font-size:16px}",
    ".pl-unlock input[type=email]:focus{outline:2px solid var(--cyan,#19e3ff);outline-offset:1px}",
    ".pl-unlock button,.pl-unlock .plu-discord{flex:0 0 auto;min-height:48px;padding:10px 18px;border:0;border-radius:10px;background:var(--magenta,#ff2fc0);color:#fff;font-weight:700;font-size:15px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;box-shadow:0 0 22px rgba(255,47,192,.45);font-family:var(--f-display,inherit)}",
    ".pl-unlock button:disabled{opacity:.6;cursor:progress}",
    ".pl-unlock .plu-discord{display:flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;text-decoration:none;background:var(--cyan,#19e3ff);color:#07080f;box-shadow:0 0 22px rgba(25,227,255,.4);text-align:center;line-height:1.25}",
    ".pl-unlock .hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}",
    ".pl-unlock [data-ts]:empty{display:none}.pl-unlock [data-ts]{margin:10px 0 0}",
    ".pl-unlock .plu-msg{margin:8px 0 0;font-size:13.5px;color:var(--cyan,#19e3ff)}.pl-unlock .plu-msg:empty{display:none}",
    ".pl-unlock .plu-fine{margin:8px 0 0;font-size:12px;color:var(--muted,#8a96ab)}",
    ".pl-unlock .plu-fine a{display:inline!important;padding:0!important;color:var(--cyan,#19e3ff)}",
    "@media (max-width:480px){.pl-unlock .plu-row button{flex-basis:100%}}",
  ].join("");

  var cardEl = null;
  function buildCard() {
    var d = document.createElement("div");
    d.className = "pl-unlock";
    d.setAttribute("role", "region");
    d.setAttribute("aria-label", "Unlock the free board");
    var src = "free-board" + location.pathname.replace(/\/+$/, "").replace(/\//g, ":");
    d.innerHTML =
      '<p class="plu-eyebrow">🔒 Free · no card needed</p>' +
      '<h3 class="plu-title">' + esc(HEADLINE) + "</h3>" +
      '<p class="plu-sub">' + esc(SUBTEXT) + "</p>" +
      '<form class="plu-form" action="/api/subscribe" method="post" data-unlock novalidate>' +
      '<div class="plu-row"><input type="email" name="email" required maxlength="254" placeholder="you@example.com" autocomplete="email" inputmode="email" aria-label="Email address">' +
      '<button type="submit">Unlock free board</button></div>' +
      '<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<input type="hidden" name="source" value="' + esc(src.slice(0, 60)) + '">' +
      '<div data-ts></div><p class="plu-msg" role="status" aria-live="polite"></p>' +
      '<p class="plu-fine">Free. Unsubscribe any time. 18+. <a href="/privacy">Privacy</a></p></form>';
    d.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, m = f.querySelector(".plu-msg"), b = f.querySelector("button");
      b.disabled = true; m.textContent = "Unlocking…";
      submit(f).then(function (j) {
        b.disabled = false;
        if (!j.ok) { m.textContent = j.error || "Something went wrong. Please try again."; if (j.field) f.email.focus(); }
      });
    });
    return d;
  }
  function doneHtml() {
    return '<p class="plu-eyebrow">✓ Board unlocked on this device</p>' +
      '<a class="plu-discord" href="' + DISCORD + '" target="_blank" rel="noopener noreferrer">' + esc(DONE_BTN) + "</a>" +
      '<p class="plu-fine">Your free Discord link is on its way to your inbox too.</p>';
  }

  var observer = null, timer = null, active = false;
  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
  function clearLocks() {
    TYPES.forEach(function (t) {
      var cls = "pl-lock-" + t.id;
      document.querySelectorAll("." + cls).forEach(function (el) { el.classList.remove(cls); });
    });
  }
  function apply() {
    timer = null;
    if (!active) return;
    if (observer) observer.disconnect();
    var firstLocked = null;
    TYPES.forEach(function (t) {
      var cls = "pl-lock-" + t.id, free = {};
      document.querySelectorAll(t.sel).forEach(function (el) {
        if (el.closest(".pl-unlock-wrap") || t.skip(el)) { el.classList.remove(cls); return; }
        var sp = t.sport(el) || "x", k = t.key(el) || "";
        var list = free[sp] || (free[sp] = []);
        if (list.indexOf(k) < 0 && list.length < FREE_PER_SPORT) list.push(k);
        var locked = list.indexOf(k) < 0;
        el.classList.toggle(cls, locked);
        if (locked && t.card !== false && !firstLocked && visible(el)) firstLocked = el;
      });
    });
    placeCard(firstLocked);
    if (observer) observer.observe(document.body, { childList: true, subtree: true });
  }
  function placeCard(before) {
    var wrap = cardEl && cardEl.parentNode && cardEl.parentNode.classList && cardEl.parentNode.classList.contains("pl-unlock-wrap") ? cardEl.parentNode : null;
    if (!before) { if (wrap) wrap.remove(); return; }
    if (wrap && wrap.nextElementSibling === before) return; // already in place: keep typed email / widget
    if (!cardEl) cardEl = buildCard();
    var w = document.createElement(before.tagName === "LI" ? "li" : "div");
    w.className = "pl-unlock-wrap";
    if (wrap) wrap.remove();
    w.appendChild(cardEl);
    before.parentNode.insertBefore(w, before);
  }
  function schedule() { if (!timer) timer = setTimeout(apply, 60); }

  function unlock() {
    store.set(KEY, "1");
    document.documentElement.classList.add("pl-unlocked");
    active = false;
    if (observer) { observer.disconnect(); observer = null; }
    clearLocks();
    if (cardEl) cardEl.innerHTML = doneHtml();
  }

  function start() {
    if (isUnlocked() || !PATH_OK.test(location.pathname)) return;
    var st = document.createElement("style");
    st.id = "pl-gate-css";
    st.textContent = CSS;
    document.head.appendChild(st);
    active = true;
    observer = new MutationObserver(schedule);
    apply();
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
  }

  window.PLSignup = { submit: submit, loadTurnstile: loadTurnstile };
  window.PLGate = { unlock: unlock, isUnlocked: isUnlocked, apply: function () { if (active) apply(); }, FREE_PER_SPORT: FREE_PER_SPORT, PATH_OK: PATH_OK };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
