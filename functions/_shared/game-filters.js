// Sport + light filters for public Today / Predictions lists.
// Defaults match /results: sport=all, light=green (Green + Best value, includes SUPER).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sportName = (s) => ({ nba: "NBA", nfl: "NFL", nhl: "NHL", epl: "Premier League", championship: "Championship", tennis: "Tennis" }[s] ?? String(s).toUpperCase());

export const FILTER_SPORTS = ["nba", "nfl", "nhl", "epl", "championship", "tennis"];
export const FILTER_LIGHTS = ["green", "all", "super", "orange", "red"];

export const isGreenLight = (l) => l === "GREEN" || l === "SUPER";

export function parseGameFilters(url, { defaultLight = "green" } = {}) {
  const u = typeof url === "string" ? new URL(url, "https://probalabsports.com") : new URL(url);
  const sportRaw = (u.searchParams.get("sport") || "all").toLowerCase();
  const lightRaw = (u.searchParams.get("light") || defaultLight).toLowerCase();
  const sport = sportRaw === "all" || FILTER_SPORTS.includes(sportRaw) ? sportRaw : "all";
  const light = FILTER_LIGHTS.includes(lightRaw) ? lightRaw : defaultLight;
  return { sport, light };
}

export function gameFilterHref(basePath, { sport = "all", light = "green" } = {}) {
  const q = new URLSearchParams();
  if (sport && sport !== "all") q.set("sport", sport);
  if (light && light !== "green") q.set("light", light);
  const s = q.toString();
  const path = basePath || "/today";
  return s ? `${path}?${s}` : path;
}

export function matchesLightFilter(lightVal, light) {
  if (light === "all") return true;
  if (light === "green") return isGreenLight(lightVal);
  if (light === "super") return lightVal === "SUPER";
  if (light === "orange") return lightVal === "ORANGE";
  if (light === "red") return lightVal === "RED";
  return true;
}

export function lightRank(l) {
  if (l === "SUPER") return 0;
  if (l === "GREEN") return 1;
  if (l === "ORANGE") return 2;
  if (l === "RED") return 3;
  return 4;
}

export function sortGreenFirst(games) {
  return games.slice().sort((a, b) => {
    const lr = lightRank(a.light) - lightRank(b.light);
    if (lr) return lr;
    return String(a.start_utc || "").localeCompare(String(b.start_utc || ""));
  });
}

const SPORT_BTN = {
  all: "All",
  nba: "NBA",
  nfl: "NFL",
  nhl: "NHL",
  epl: "EPL",
  championship: "Champ",
  tennis: "Tennis",
};

const LIGHT_BTN = [
  ["green", "Green", "GREEN"],
  ["all", "All", ""],
  ["super", "Super — best value", "SUPER"],
  ["orange", "Orange", "ORANGE"],
  ["red", "Red", "RED"],
];

/** availableSports: iterable of sport ids present in the current page data */
export function renderFilterBar(filters, { basePath = "/today", availableSports = null, showSport = true, showSuper = true } = {}) {
  const sports = ["all", ...(availableSports
    ? FILTER_SPORTS.filter((s) => availableSports.has(s) || availableSports.has(s.toUpperCase()))
    : FILTER_SPORTS)];
  const sportNav = showSport
    ? `<nav class="game-filters sports" aria-label="Filter by sport">${sports.map((id) => {
        const href = gameFilterHref(basePath, { sport: id, light: filters.light });
        const on = filters.sport === id;
        const label = SPORT_BTN[id] || sportName(id);
        return on
          ? `<a class="gf-btn on" href="${esc(href)}" aria-current="true">${esc(label)}</a>`
          : `<a class="gf-btn" href="${esc(href)}">${esc(label)}</a>`;
      }).join("")}</nav>`
    : "";
  const lights = LIGHT_BTN.filter(([id]) => showSuper || id !== "super");
  const lightNav = `<nav class="game-filters lights" aria-label="Filter by light">${lights.map(([id, label, cls]) => {
    const href = gameFilterHref(basePath, { sport: filters.sport, light: id });
    const on = filters.light === id;
    const c = cls ? ` ${cls}` : "";
    return on
      ? `<a class="gf-btn${c} on" href="${esc(href)}" aria-current="true">${esc(label)}</a>`
      : `<a class="gf-btn${c}" href="${esc(href)}">${esc(label)}</a>`;
  }).join("")}</nav>`;
  const note = filters.light === "green"
    ? `<p class="small filter-note">Showing Green + Best value (green picks, plus NBA Super). Choose All lights to see every colour.</p>`
    : filters.light === "all"
    ? `<p class="small filter-note">All lights, green first.</p>`
    : "";
  return `<div class="game-filter-bar" role="region" aria-label="Game filters">
    ${sportNav}
    ${lightNav}
    ${note}
  </div>`;
}

export function emptyFilterMessage(filters, { basePath = "/today" } = {}) {
  const allHref = gameFilterHref(basePath, { sport: "all", light: "all" });
  const greenHref = gameFilterHref(basePath, { sport: filters.sport, light: "green" });
  return `<section class="panel filter-empty"><h2>No games match these filters</h2>
    <p>Try another sport or light colour.</p>
    <p class="small"><a href="${esc(allHref)}">All sports · All lights</a>${filters.light !== "green" ? ` · <a href="${esc(greenHref)}">Green + Best value</a>` : ""}</p>
  </section>`;
}
