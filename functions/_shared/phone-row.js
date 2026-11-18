// Phone game card data contract. Every server game row (any sport, any page) carries these data attributes, and
// phone.js draws the one shared phone game card (phone-core.js cardHtml) from them. Attributes only: the desktop row
// looks exactly the same. A new sport gets the shared card and Injury watch chip by giving its rows phoneAttrs(g, sport).
//
//   data-sport       sport id (nba, nfl, nhl, epl, championship, tennis, ...)
//   data-start       ISO start time (the card shows the AEDT time; the list groups by AEDT day)
//   data-tbc="1"     start time not known yet (tennis time_tbc)
//   data-group       a group header instead of the day (NFL: "Week 12"), with data-group-key to order the groups
//   data-match       optional "Away @ Home" / "Home v Away" when the row's own text isn't the matchup (team pages)
//   data-pick, data-p optional pick name and chance (0-1) when the row's own text isn't "Pick 62%"
import { sportCfg } from "./lights.js";

const escA = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Sports whose games are grouped by week on the phone; every other sport is grouped by day.
export const WEEK_SPORTS = new Set(["nfl"]);
export const weekLabel = (w) => (w >= 22 ? "Super Bowl" : w === 21 ? "Conference Championships" : w === 20 ? "Divisional Round" : w === 19 ? "Wild Card Round" : `Week ${w}`);

/** "Away @ Home", or "Home v Away" for three-way (football) sports and "A v B" for tennis players. */
export function matchText(g, sport) {
  const s = String(sport ?? g.sport ?? "").toLowerCase();
  const A = g.away_name ?? g.away, H = g.home_name ?? g.home;
  if (s === "tennis") return `${A} v ${H}`;
  return sportCfg(s)?.scale === "three-way" ? `${H} v ${A}` : `${A} @ ${H}`;
}

/** The data attributes for one game row, as an HTML attribute string (leading space). extra: more attributes. */
export function phoneAttrs(g, sport, extra = {}) {
  const s = String(sport ?? g?.sport ?? "").toLowerCase();
  if (!g || !s) return "";
  const a = { "data-sport": s, "data-start": g.start_utc ?? "" };
  if (g.time_tbc || g.tbc) a["data-tbc"] = "1";
  if (WEEK_SPORTS.has(s) && g.week != null && g.week !== "") {
    a["data-group"] = weekLabel(Number(g.week));
    a["data-group-key"] = String(g.week).padStart(3, "0");
  }
  Object.assign(a, extra);
  return Object.entries(a).filter(([, v]) => v != null && v !== "").map(([k, v]) => ` ${k}="${escA(v)}"`).join("");
}
