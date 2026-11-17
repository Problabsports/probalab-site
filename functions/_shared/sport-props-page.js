// /props/nfl and /props/nhl pages: same layout and filters as /props/nba (Game / Team / Market, light toggles,
// "Props scale" key), data only. Members get the full board from /api/props-<sport> (props-nba.js swaps it in).
import { shell, html, esc } from "./site.js";
import { verifyMember } from "./member-session.js";
import { SPORTS, loadSportBoard, renderSportBoard, boardCounts, teamsOfBoard, marketsOnBoard, sortedGames, propsSportNav, shortDay, FREE_PER_GAME } from "./sport-props.js";
import { memberButtons, updatedLabel } from "./nba-props.js";

export async function sportPropsPage(ctx, sport) {
  const S = SPORTS[sport];
  const board = await loadSportBoard(ctx, sport);
  const st = boardCounts(board);
  const games = sortedGames(board);
  const sample = !!board.sample;
  const updated = board.generated_at ? updatedLabel(board.generated_at) : "";
  const strip = `<div class="pp-strip mono" role="status">
    ${sample ? '<span class="pp-sample" title="Preview fixture: fictional players, invented numbers">Sample data</span>' : ""}
    ${st.day ? `<span>${esc(st.day)}</span>` : ""}
    <span>${st.games} game${st.games === 1 ? "" : "s"}</span>
    <span>${st.players} player${st.players === 1 ? "" : "s"}</span>
    ${updated ? `<span>Updated ${esc(updated)}</span>` : ""}
  </div>`;
  const sel = (id, label, opts) => `<label class="pp-team-filter">${label}<select id="${id}">${opts}</select></label>`;
  const filters = games.length ? `<div class="game-filter-bar pp-filters" role="region" aria-label="Props filters">
    <div class="game-filters pp-selects">
      ${sel("ppGame", "Game", `<option value="">All games</option>${games.map((g) => `<option value="${esc(g.event_id || "")}">${esc(shortDay(g.commence_utc))} · ${esc(g.away)} @ ${esc(g.home)}</option>`).join("")}`)}
      ${sel("ppTeam", "Team", `<option value="">All teams</option>${teamsOfBoard(board).map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}`)}
      ${sel("ppMarket", "Market", `<option value="">All markets</option>${marketsOnBoard(sport, board).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}`)}
    </div>
    <nav class="game-filters lights" id="ppLights" aria-label="Filter by light">${[["GREEN", "Green"], ["ORANGE", "Orange"], ["RED", "Red"]].map(([c, l]) =>
      `<button type="button" class="gf-btn ${c} on" data-light="${c}" aria-pressed="true">${l}</button>`).join("")}</nav>
    <p class="small filter-note" id="ppLegend" data-basis="hit">Lights: how often the player cleared today's line this season. <span class="chip GREEN">Green</span> 60%+ · <span class="chip ORANGE">Orange</span> 55–59% · <span class="chip RED">Red</span> under 55%</p>
  </div>` : "";
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/${sport}">${S.name} predictions</a> › <span>Player props</span></nav>
  <p class="eyebrow">// ${S.name} player props · Australia/Sydney</p>
  <h1>${S.name} player props</h1>
  ${propsSportNav(sport)}
  <p>Every posted ${S.name} player prop with the line, Sportsbet's prices and the best price at another Australian bookmaker, next to the player's last 8 games against that line and how often he has cleared it. Bet your own way.</p>
  <p class="note">Bookie prices and player stats only. No tips. Prices move; check them with the bookmaker.</p>
  ${strip}
  ${filters}
  ${games.length ? `<div id="ppMemberNote" class="pp-member-note"><p class="note">Free view shows ${FREE_PER_GAME} players per market in each game. Members see every player.</p>${memberButtons("pp-cta-left")}</div>` : ""}
  <div id="pp-view-preds" class="pp-view">
    <div id="propsBoard" data-api="/api/props-${sport}">${renderSportBoard(sport, board, { full: false })}</div>
    <p id="ppNone" class="note" hidden>No props match these filters.</p>
  </div>
  <p class="note">Prices are from our last pull before the ${S.start} (about a day out, then about 30 minutes out). Implied chance = 1 ÷ price, bookmaker margin included. Last 8 and hit rates are this season's games. 18+. <a href="/responsible-gambling">Gamble responsibly</a>.</p>
  <link rel="stylesheet" href="/props.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/props-nba.js"></script>`;
  return html(shell({
    title: `${S.name} Player Props: Bookie Prices and Player Form | ProbaLab`,
    description: `${S.name} player props with Sportsbet and best Australian bookmaker prices, each player's last 8 games against the line and hit rates. Data only.`,
    path: `/props/${sport}`, body, noindex: sample,
  }), 200, 60);
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", vary: "authorization", "x-robots-tag": "noindex, nofollow" },
});

/** GET /api/props-<sport>: the full board for signed-in members. */
export async function sportPropsApi(ctx, sport) {
  const member = await verifyMember(ctx.request);
  if (!member) return json({ ok: false, error: "members only" }, 401);
  const board = await loadSportBoard(ctx, sport);
  return json({ ok: true, html: renderSportBoard(sport, board, { full: true }) });
}

/** Raw sample files are members-only, like the NBA fixture. */
export async function sportFixtureGuard(ctx, sport) {
  const denied = () => new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  if (parts.length !== 1) return denied();
  if (!(await verifyMember(ctx.request))) return denied();
  const res = await ctx.env.ASSETS.fetch(new URL(`/data/${sport}_props/` + String(parts[0]).toLowerCase(), ctx.request.url));
  if (!res.ok) return denied();
  const headers = new Headers(res.headers);
  headers.set("cache-control", "private, no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(res.body, { status: res.status, headers });
}
