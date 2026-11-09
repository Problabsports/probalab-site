// Public green-record summary for the home page. Same grading as /results.
import { SPORT_ORDER, loadSportRecord, lightTally } from "../_shared/record-pages.js";
import { sportName } from "../_shared/site.js";

function pct(w, n) {
  return n ? Math.round((100 * w) / n) : null;
}

/** Latest real results timestamp across finished picks (not request time). */
function resultsUpdatedAt(views) {
  let best = null;
  for (const v of views) {
    if (v.error) continue;
    for (const row of v.rows || []) {
      const ts = row.last_update_utc || row.posted_utc || row.start_utc || null;
      if (!ts) continue;
      const t = Date.parse(ts);
      if (!Number.isFinite(t)) continue;
      if (best == null || t > best) best = t;
    }
  }
  return best == null ? null : new Date(best).toISOString();
}

export async function onRequestGet(ctx) {
  const views = await Promise.all(SPORT_ORDER.map((sport) => loadSportRecord(ctx, sport)));
  const sports = [];
  let gW = 0, gN = 0, sW = 0, sN = 0;
  for (const v of views) {
    if (v.error) {
      sports.push({ sport: v.sport, name: v.name, green: { w: 0, n: 0, pct: null }, error: v.error });
      continue;
    }
    const g = lightTally(v.rows, "GREEN");
    const s = lightTally(v.rows, "SUPER");
    gW += g.w; gN += g.n; sW += s.w; sN += s.n;
    sports.push({
      sport: v.sport,
      name: v.name || sportName(v.sport),
      green: { w: g.w, n: g.n, pct: pct(g.w, g.n) },
      super: s.n ? { w: s.w, n: s.n, pct: pct(s.w, s.n) } : null,
    });
  }
  const body = {
    generated_at: resultsUpdatedAt(views),
    green: { w: gW, n: gN, pct: pct(gW, gN) },
    super: sN ? { w: sW, n: sN, pct: pct(sW, sN), label: "Super — best value", note: "NBA only" } : null,
    sports,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300, must-revalidate",
      "access-control-allow-origin": "*",
    },
  });
}
export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
