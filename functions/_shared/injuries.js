// Injury reports: ESPN public injuries feed (free), cached at the edge for 15 minutes.
// We show only facts (player, position, our status label, injury area, date), never ESPN's written notes.
const PATHS = { nba: "basketball/nba", nfl: "football/nfl", nhl: "hockey/nhl", epl: "soccer/eng.1" };
export const INJ_TTL = 900;
const RANK = { Out: 0, "Injured Reserve": 1, Suspension: 1, Doubtful: 2, Questionable: 3, "Day-To-Day": 4 };
const label = (s) => (/injured reserve|^ir$/i.test(s) ? "Injured reserve" : /out/i.test(s) ? "Out" : /doubt/i.test(s) ? "Doubtful" : /question/i.test(s) ? "Questionable" : /day/i.test(s) ? "Day-to-day" : /susp/i.test(s) ? "Suspended" : null);
export const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export async function getInjuries(ctx, sport) {
  const path = PATHS[sport]; if (!path) return null;
  const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/injuries`;
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const key = new Request(`https://injuries.cache/${sport}`);
  let body = null;
  if (cache) { const hit = await cache.match(key); if (hit) body = await hit.json(); }
  if (!body) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" }, cf: { cacheTtl: INJ_TTL } });
      if (!r.ok) return null;
      const raw = await r.json();
      const byTeam = {};
      for (const t of raw.injuries || []) {
        const list = (t.injuries || []).map((i) => ({
          player: i.athlete?.displayName, pos: i.athlete?.position?.abbreviation || "",
          status: label(i.status || i.type?.description || ""), area: i.details?.type || "", date: i.date || null,
        })).filter((m) => m.player && m.status).sort((a, b) => (RANK[a.status] ?? 5) - (RANK[b.status] ?? 5));
        if (list.length) byTeam[norm(t.displayName)] = list;
      }
      body = { updated: new Date().toISOString(), byTeam };
      if (cache) ctx.waitUntil?.(cache.put(key, new Response(JSON.stringify(body), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${INJ_TTL}` } })));
    } catch (e) { return null; }
  }
  return body;
}

// Find a team's list by full name (falls back to the trailing nickname for small naming differences).
export function teamInjuries(inj, name) {
  if (!inj || !name) return null;
  const n = norm(name);
  if (inj.byTeam[n]) return inj.byTeam[n];
  const nick = n.split(" ").slice(-1)[0];
  const k = Object.keys(inj.byTeam).find((x) => x.endsWith(" " + nick) || x === nick);
  return k ? inj.byTeam[k] : null;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const when = (iso) => { try { return new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso)); } catch { return ""; } };
const SHOW = new Set(["Out", "Doubtful", "Questionable", "Injured reserve", "Suspended"]);

// key players: NFL quarterbacks; NBA players our model lists at 20+ minutes a game
export function keyNames(sport, game, side) {
  const d = game?.detail || {};
  if (sport === "nba") return new Set(((side === "home" ? d.missing_home : d.missing_away) || []).filter((m) => Number(m.min || 0) >= 20).map((m) => norm(m.player)));
  return new Set();
}
const isKey = (sport, m, keys) => (sport === "nfl" ? m.pos === "QB" : keys.has(norm(m.player)));

export function teamListHtml(sport, teamName, list, keys = new Set(), max = 12) {
  const xs = (list || []).filter((m) => SHOW.has(m.status));
  if (!xs.length) return `<p class="small">${esc(teamName)}: no players listed out, doubtful or questionable.</p>`;
  return `<h3>${esc(teamName)}</h3><ul class="inj">${xs.slice(0, max).map((m) => `<li><b>${esc(m.player)}</b>${m.pos ? ` <span class="small">${esc(m.pos)}</span>` : ""} · <span class="st ${esc(m.status.replace(/\s/g, ""))}">${esc(m.status)}</span>${m.area ? ` · ${esc(m.area)}` : ""}${isKey(sport, m, keys) ? ` <b class="key">key player</b>` : ""}${m.date ? ` <span class="small">(${esc(when(m.date))})</span>` : ""}</li>`).join("")}${xs.length > max ? `<li class="small">+${xs.length - max} more</li>` : ""}</ul>`;
}

// Block for a game page: hidden when neither team has anyone listed.
export function gameInjuriesHtml(sport, inj, game, awayName, homeName) {
  if (!inj) return "";
  const a = (teamInjuries(inj, awayName) || []).filter((m) => SHOW.has(m.status));
  const h = (teamInjuries(inj, homeName) || []).filter((m) => SHOW.has(m.status));
  if (!a.length && !h.length) return "";
  const ka = keyNames(sport, game, "away"), kh = keyNames(sport, game, "home");
  const keyOut = [...a.filter((m) => isKey(sport, m, ka)), ...h.filter((m) => isKey(sport, m, kh))].filter((m) => /Out|Doubtful|Injured/.test(m.status));
  return `<section class="panel injuries"><h2>Injury report</h2>
    ${keyOut.length ? `<p class="keynote">⚠ Key player${keyOut.length > 1 ? "s" : ""} out or doubtful: ${keyOut.map((m) => `<b>${esc(m.player)}</b> (${esc(m.status)})`).join(", ")}.</p>` : ""}
    <div class="inj-cols">${teamListHtml(sport, awayName, a, ka)}${teamListHtml(sport, homeName, h, kh)}</div>
    <p class="small">Statuses from the official team injury reports. Updated ${esc(when(inj.updated))}; refreshed every 15 minutes.</p></section>`;
}
export const INJ_CSS = `<style>.inj{list-style:none;padding:0;margin:0 0 10px}.inj li{padding:4px 0;border-top:1px solid var(--line)}.inj .st.Out,.inj .st.Injuredreserve,.inj .st.Suspended{color:var(--red)}.inj .st.Doubtful{color:var(--orange)}.inj .st.Questionable{color:var(--yellow,#ffd84d)}.inj .key{color:var(--red);font-size:11px;text-transform:uppercase;margin-left:4px}.keynote{border-left:3px solid var(--red);padding-left:10px}.inj-cols{display:grid;gap:12px}@media(min-width:720px){.inj-cols{grid-template-columns:1fr 1fr}}</style>`;
