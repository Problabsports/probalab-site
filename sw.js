/* ProbaLab service worker: makes the site installable (Add to Home Screen) and shows a small
   offline page when there is no connection. Registered by phone.js on phones only.

   Privacy rule: it only ever stores the public app shell (styles, scripts, icons, offline page).
   Pages, /api/*, /data/*, /members/*, /join, sign-in and billing are never written to the cache,
   so nothing one member sees can be served to another account on the same phone.
   Static files are network-first, so a deploy shows straight away; the cache is only a fallback. */
var VERSION = "pl-shell-v1";
var SHELL = [
  "/offline.html",
  "/phone.css",
  "/phone-core.js",
  "/phone.js",
  "/site-nav.css",
  "/site-nav.js",
  "/page.css",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// Paths that must never be stored, whatever their file type.
var PRIVATE = /^\/(api|data|members|join|functions|admin|owner|checkout|billing)(\/|$|\.)/i;
var STATIC = /\.(css|js|png|svg|ico|webp|jpg|jpeg|woff2?)$/i;

/** What to do with a request: "shell" (network-first, cached copy as fallback),
    "page" (network only, offline page on failure) or "pass" (leave it to the browser). */
function classify(method, url, mode, origin) {
  if (method !== "GET") return "pass";
  var u;
  try { u = new URL(url); } catch (e) { return "pass"; }
  if (u.origin !== origin) return "pass";
  if (PRIVATE.test(u.pathname)) return mode === "navigate" ? "page" : "pass";
  if (mode === "navigate") return "page";
  if (u.search && !/^\?v=[\w-]+$/.test(u.search)) return "pass";
  if (STATIC.test(u.pathname)) return "shell";
  return "pass";
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function" && typeof module === "undefined") {
  self.addEventListener("install", function (e) {
    e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
  });
  self.addEventListener("activate", function (e) {
    e.waitUntil(caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }));
  });
  self.addEventListener("fetch", function (e) {
    var req = e.request;
    var kind = classify(req.method, req.url, req.mode, self.location.origin);
    if (kind === "page") {
      e.respondWith(fetch(req).catch(function () { return caches.match("/offline.html"); }));
    } else if (kind === "shell") {
      e.respondWith(fetch(req).then(function (res) {
        if (res && res.ok && res.type === "basic") {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || Response.error(); });
      }));
    }
    // "pass": no respondWith, the browser handles it as normal (nothing stored here)
  });
}

if (typeof module !== "undefined" && module.exports) module.exports = { classify: classify, SHELL: SHELL, VERSION: VERSION };
