// Last settled Sydney day of GREEN/SUPER picks for the home "Yesterday's results" strip.
// Real finished picks only — hide the strip when empty.
import { SPORT_ORDER, loadSportRecord } from "../_shared/record-pages.js";
import { sportName } from "../_shared/site.js";

function sydDay(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(t)); // YYYY-MM-DD
  } catch {
    return null;
  }
}

function labelDay(ymd) {
  try {
    const [y, m, d] = ymd.split("-").map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d, 12));
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(utc);
  } catch {
    return ymd;
  }
}

export async function onRequestGet(ctx) {
  const views = await Promise.all(SPORT_ORDER.map((sport) => loadSportRecord(ctx, sport)));
  const byDay = new Map();
  for (const v of views) {
    if (v.error) continue;
    for (const g of v.rows || []) {
      if (g.won == null) continue;
      const day = sydDay(g.start_utc);
      if (!day) continue;
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push({
        sport: g.sport,
        sport_name: sportName(g.sport),
        pick: g.pick,
        light: g.light,
        won: !!g.won,
        chance: g.pick_p,
        start_utc: g.start_utc,
        game_id: g.id,
      });
    }
  }
  const days = [...byDay.keys()].sort();
  // Prefer the latest day that has at least one GREEN or SUPER; else empty.
  let chosen = null;
  for (let i = days.length - 1; i >= 0; i--) {
    const rows = byDay.get(days[i]);
    if (rows.some((r) => r.light === "GREEN" || r.light === "SUPER")) {
      chosen = days[i];
      break;
    }
  }
  if (!chosen) {
    return new Response(JSON.stringify({ day: null, label: null, greens: [], other: { w: 0, n: 0 }, hide: true }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=120, must-revalidate", "access-control-allow-origin": "*" },
    });
  }
  const rows = byDay.get(chosen);
  const greens = rows
    .filter((r) => r.light === "GREEN" || r.light === "SUPER")
    .sort((a, b) => {
      const ra = a.light === "SUPER" ? 0 : 1;
      const rb = b.light === "SUPER" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return (b.chance ?? 0) - (a.chance ?? 0);
    });
  const other = rows.filter((r) => r.light !== "GREEN" && r.light !== "SUPER");
  const oW = other.filter((r) => r.won).length;
  const body = {
    day: chosen,
    label: labelDay(chosen),
    greens,
    other: { w: oW, n: other.length },
    hide: greens.length === 0,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=120, must-revalidate",
      "access-control-allow-origin": "*",
    },
  });
}
export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
