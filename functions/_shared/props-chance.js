// Props "Chance" (chance-v1): pure, no I/O. Shared by the NFL / NHL boards, the NBA data-only rows and the phone cards.
//
// Chance = the bookie's price with its margin taken out, moved toward the player's season hit rate on today's line
// (the more games, the more it moves):
//   pb      = bookie's Over chance with the margin removed (Sportsbet, else the AU book with the lowest overround,
//             else 0.5 when nothing has both sides)
//   p_over  = (season overs  + m * pb)       / (season games + m)
//   p_under = (season unders + m * (1 - pb)) / (season games + m)
// side = the higher of the two (tie -> Over), clamped to 5-95%. No AU price at all (incl. Avg lines) -> no Chance ("-"),
// no light. Data only.
//
// pb is internal: it never goes on the returned objects, so it never reaches HTML, data-* attributes or pp-pv JSON.
import { propsLight } from "./lights.js";

export const CHANCE_VERSION = "chance-v1";
export const PRIOR_WEIGHT = { nfl: 10, nhl: 10, nba: 10 }; // m, per sport
export const CLAMP = [0.05, 0.95];
export const MIN_GAMES_FOR_LIGHT = 5;

const num = (x) => (x == null || x === "" || !Number.isFinite(Number(x)) ? null : Number(x));
const twoSided = (b) => b && num(b.over) > 1 && num(b.under) > 1;
const overround = (b) => 1 / Number(b.over) + 1 / Number(b.under);

/** Over chance with the margin removed (multiplicative), or null unless both prices are above 1.0. */
export function fairOver(book) {
  if (!twoSided(book)) return null;
  const io = 1 / Number(book.over), iu = 1 / Number(book.under);
  return io / (io + iu);
}

/** Internal: the book Over chance and where it came from. Never put its result on anything that is rendered. */
export function bookProb(books) {
  const list = Array.isArray(books) ? books : [];
  const sb = list.find((b) => b && b.key === "sportsbet" && b.region !== "us");
  if (twoSided(sb)) return { p_over: fairOver(sb), src: "sportsbet" };
  let best = null;
  for (const b of list) {
    if (!b || b.key === "sportsbet" || b.region === "us" || !twoSided(b)) continue;
    if (!best || overround(b) < overround(best)) best = b; // strict: ties keep the earliest
  }
  if (best) return { p_over: fairOver(best), src: String(best.key || "") };
  return { p_over: 0.5, src: "prior" };
}

/** True when at least one AU book (not region "us") has a price on either side. */
export function hasAuPrice(books) {
  return (Array.isArray(books) ? books : []).some((b) => b && b.region !== "us" && (num(b.over) > 1 || num(b.under) > 1));
}

const clamp = (p) => Math.min(CLAMP[1], Math.max(CLAMP[0], p));

/** Internal: both sides before clamping, with the book chance (tests only; never rendered). */
export function _chanceParts(row, sport) {
  if (!row || row.kind === "yes") return null;
  const s = row.hits && row.hits.season;
  const n = s && s.n > 0 ? s.n : 0;
  const over = n ? num(s.over) || 0 : 0, under = n ? num(s.under) || 0 : 0;
  const m = PRIOR_WEIGHT[sport] ?? 10;
  const { p_over: pb, src } = bookProb(row.books);
  return { p_over: (over + m * pb) / (n + m), p_under: (under + m * (1 - pb)) / (n + m), pb, src, n, over, under, m };
}

/** Chance for an O/U row: { side, p, src, n, k, m }; null for Yes rows and for rows with no AU price at all. */
export function propChance(row, sport) {
  if (!row || !hasAuPrice(row.books)) return null;
  const c = _chanceParts(row, sport);
  if (!c) return null;
  const side = c.p_over >= c.p_under ? "Over" : "Under";
  return { side, p: clamp(side === "Over" ? c.p_over : c.p_under), src: c.src, n: c.n, k: side === "Over" ? c.over : c.under, m: c.m };
}

/** Light for display, on the props scale of the shown (rounded-down) Chance. No light under 5 season games, on an Avg
    line or with no AU price ({ light: "", side: "", p: null }). */
export function chanceLight(row, sport) {
  const c = propChance(row, sport);
  if (!c) return { light: "", side: "", p: null };
  const lit = c.n >= MIN_GAMES_FOR_LIGHT && row.line_source !== "avg";
  return { light: lit ? propsLight(c.p) || "" : "", side: c.side, p: c.p };
}
