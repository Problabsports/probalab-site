// Attach injury_warning + injury_note to upcoming games using ESPN public injuries
// (same field names as NBA public_feed). Never changes light colours.
// Sports without a reliable free source are skipped (see ops README).

import { getInjuries, teamInjuries, norm } from "./injuries.js";

const CLOSING =
  "Light not changed by this. Players listed may miss the game or play reduced minutes, so factor that in.";

const UNCERTAIN = /^(Out|Injured reserve|Doubtful|Questionable|Day-to-day)$/i;
const HARSH = /^(Out|Injured reserve|Doubtful)$/i;

/** Long-term / inactive list noise — never shown on NFL Injury watch (John 10 Nov 2026). */
const NFL_NOISE = /^(Injured reserve|PUP|NFI|Physically unable|Non-football|Suspended)$/i;

/** NFL week-facing statuses (practice-report / game status). */
const NFL_WEEK = /^(Out|Doubtful|Questionable)$/i;

/** NFL: QB any week status; skill + OL when Out/Doubtful/Questionable. IR/PUP/NFI/Suspended excluded. */
const NFL_SKILL = new Set(["QB", "RB", "WR", "TE", "FB", "T", "G", "C", "OT", "OG", "OL"]);

/** NHL: skaters + goalies on uncertain list (proxy for top-6 F / top-4 D / starter G without ice-time file). */
const NHL_POS = new Set(["C", "LW", "RW", "W", "F", "D", "G", "LH", "RH"]);

/** Soccer: outfield + GK when Out/Doubtful/Questionable. */
const SOCCER_OK = true;

function statusOf(m) {
  return String(m?.status || "").trim();
}

function isKeyPlayer(sport, m) {
  const st = statusOf(m);
  if (!UNCERTAIN.test(st)) return false;
  const pos = String(m.pos || "").toUpperCase();
  if (sport === "nfl") {
    if (NFL_NOISE.test(st)) return false;
    if (!NFL_WEEK.test(st)) return false;
    if (pos === "QB") return true;
    return NFL_SKILL.has(pos);
  }
  if (sport === "nhl") {
    // Proxy for top-6 F / top-4 D / starter G: skip long-term IR for skaters (too noisy).
    if (pos === "G") return /Out|Doubtful|Day-to-day|Questionable|Injured reserve/i.test(st);
    if (/Injured reserve/i.test(st)) return false;
    return /Out|Doubtful|Day-to-day|Questionable/i.test(st);
  }
  if (sport === "epl" || sport === "championship") {
    return SOCCER_OK && (HARSH.test(st) || /Questionable|Day-to-day/i.test(st));
  }
  return false;
}

function teamNameOf(g, side) {
  if (side === "home") return g.home_name || g.home || "";
  return g.away_name || g.away || "";
}

function collectKey(sport, inj, g) {
  const home = teamNameOf(g, "home");
  const away = teamNameOf(g, "away");
  const lists = [
    ...(teamInjuries(inj, away) || []).map((m) => ({ ...m, _team: away })),
    ...(teamInjuries(inj, home) || []).map((m) => ({ ...m, _team: home })),
  ];
  const seen = new Set();
  const out = [];
  for (const m of lists) {
    if (!isKeyPlayer(sport, m)) continue;
    const k = norm(m.player) + "|" + statusOf(m);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  // Prefer harsher statuses first, then name
  out.sort((a, b) => {
    const ra = HARSH.test(statusOf(a)) ? 0 : 1;
    const rb = HARSH.test(statusOf(b)) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return String(a.player).localeCompare(String(b.player));
  });
  return out.slice(0, 8);
}

export function buildInjuryNote(players) {
  if (!players.length) return "";
  const body = players.map((m) => `${m.player} (${statusOf(m)})`).join(", ");
  return `⚠️ Key players uncertain: ${body}. ${CLOSING}`;
}

/**
 * Mutates games in place. Skips games that already have injury_warning from the feed.
 * Tennis is not enriched here (no reliable free injuries feed) — caller should skip.
 */
export function applyInjuryEnrichment(sport, games, inj) {
  if (!inj || !Array.isArray(games)) return;
  if (sport === "tennis") return;
  if (!["nba", "nfl", "nhl", "epl", "championship"].includes(sport)) return;
  for (const g of games) {
    if (!g || typeof g !== "object") continue;
    if (Object.prototype.hasOwnProperty.call(g, "injury_warning")) continue; // feed owns it
    const status = String(g.status || "pre");
    if (status === "post" || status === "void") continue;
    const keys = collectKey(sport, inj, g);
    if (!keys.length) {
      g.injury_warning = false;
      g.injury_note = "";
      continue;
    }
    g.injury_warning = true;
    g.injury_note = buildInjuryNote(keys);
  }
}

export async function enrichGamesWithInjuries(ctx, sport, games) {
  if (sport === "tennis") return games;
  if (!["nba", "nfl", "nhl", "epl", "championship"].includes(sport)) return games;
  // NBA usually ships feed fields; still fill gaps when keys absent.
  const inj = await getInjuries(ctx, sport);
  applyInjuryEnrichment(sport, games, inj);
  return games;
}

export const INJURY_SPORT_RULES = {
  nba: "Feed public_feed: Questionable/Doubtful/GTD/Out+GTD averaging ≥20 min (v2 rotation).",
  nfl: "ESPN NFL injuries JSON: QB Out/Doubtful/Questionable; RB/WR/TE/OL same. IR/PUP/NFI/Suspended excluded (week noise).",
  nhl: "ESPN NHL injuries JSON: G and skaters (C/W/D) on Out/Doubtful/IR/Day-to-day/Questionable.",
  epl: "ESPN eng.1 injuries JSON: Out/Doubtful/Questionable/Day-to-day (regular XI proxy).",
  championship: "ESPN eng.2 injuries JSON: same rule as EPL.",
  tennis: "SKIPPED — no reliable free pre-match injury/withdrawal feed keyed to our fixtures.",
};
