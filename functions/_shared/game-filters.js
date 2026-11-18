// Sport + light filters for public Today / Predictions lists.
// Defaults match /results: sport=all, light=green (green first: every green pick, plus Best value picks below the
// green range). The Best value filter shows every game with the Best value tag, green ones included.
import { labelLong } from "./lights.js";
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

/** Edge page cache for the Today lists (/today and /<sport>/today).
 *  The cache key is the canonical filter URL (sport + light, query included), so each filter view gets its own copy
 *  and ?light=GREEN, ?light=green and no light all share the default one. Only the default view (all sports, green)
 *  is kept, for TODAY_PAGE_TTL seconds; a filtered view is rendered fresh on every request from the edge-cached feed,
 *  so switching Green / All lights / Best value always shows that filter's own, current list. */
export const TODAY_PAGE_TTL = 60;
/** ignoreSport: a single-sport page (/<sport>/today) renders the same whatever ?sport= says, so it is left out. */
export function todayCachePlan(url, { basePath = null, defaultLight = "green", ignoreSport = false } = {}) {
  const u = typeof url === "string" ? new URL(url, "https://probalabsports.com") : new URL(url);
  const filters = parseGameFilters(u, { defaultLight });
  if (ignoreSport) filters.sport = "all";
  const isDefault = filters.sport === "all" && filters.light === defaultLight;
  return { key: `${u.origin}${gameFilterHref(basePath || u.pathname, filters)}`, ttl: isDefault ? TODAY_PAGE_TTL : 0, filters };
}

/** Best value tag: the purple Best value light, or a green pick that also beats our fair price (g.best_value). */
export const hasBestValue = (g) => !!g && (g.light === "SUPER" || !!g.best_value);

/** gameOrLight: a game ({light, best_value}) or a bare light name. */
export function matchesLightFilter(gameOrLight, light) {
  const g = gameOrLight && typeof gameOrLight === "object" ? gameOrLight : { light: gameOrLight };
  const lightVal = g.light;
  if (light === "all") return true;
  if (light === "green") return isGreenLight(lightVal);
  if (light === "super") return hasBestValue(g);
  if (light === "orange") return lightVal === "ORANGE";
  if (light === "red") return lightVal === "RED";
  return true;
}

// Green first: Green, then Best value (below the green range), Orange, Red.
export function lightRank(l) {
  if (l === "GREEN") return 0;
  if (l === "SUPER") return 1;
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
  ["super", labelLong("SUPER"), "SUPER"],
  ["orange", "Orange", "ORANGE"],
  ["red", "Red", "RED"],
];

/** What the default (green) view holds. Best value is NBA-only, so it is named only where NBA picks can show:
 *  the NBA pages and the all-sports board. Every other sport shows plain green picks. */
export function greenViewLabel(sport) {
  const s = String(sport || "all").toLowerCase();
  return s === "nba" || s === "all" ? "Green + Best value" : "Green picks";
}
export function greenFilterNote(sport) {
  return `Showing ${greenViewLabel(sport)}. Choose All lights to see every colour.`;
}

/** availableSports: iterable of sport ids present in the current page data. sport: the page's sport (else filters.sport). */
export function renderFilterBar(filters, { basePath = "/today", availableSports = null, showSport = true, showSuper = true, sport = null } = {}) {
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
    ? `<p class="small filter-note">${esc(greenFilterNote(sport || filters.sport))}</p>`
    : filters.light === "super"
    ? `<p class="small filter-note muted">Every NBA game tagged Best value, green ones included. Green ones count in the green record only.</p>`
    : filters.light === "all"
    ? `<p class="small filter-note">All lights, green first.</p>`
    : "";
  return `<div class="game-filter-bar" role="region" aria-label="Game filters">
    ${sportNav}
    ${lightNav}
    ${note}
  </div>`;
}

export function emptyFilterMessage(filters, { basePath = "/today", sport = null } = {}) {
  const allHref = gameFilterHref(basePath, { sport: "all", light: "all" });
  const greenHref = gameFilterHref(basePath, { sport: filters.sport, light: "green" });
  return `<section class="panel filter-empty"><h2>No games match these filters</h2>
    <p>Try another sport or light colour.</p>
    <p class="small"><a href="${esc(allHref)}">All sports · All lights</a>${filters.light !== "green" ? ` · <a href="${esc(greenHref)}">${esc(greenViewLabel(sport || filters.sport))}</a>` : ""}</p>
  </section>`;
}
