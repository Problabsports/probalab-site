// Hidden EPL / NHL views inside the live app shell (served only at /epl and /nhl, noindex). Uses the app's own
// components and CSS (card, daynav, legend, side .mini). Lights: EPL GREEN >= 60%, ORANGE 50-60%; NHL GREEN >= 65%, ORANGE 55-65%, RED < 55%.
// NHL record is graded from the pre-puck-drop snapshot records (/data/nhl-pretip.json).
(function () {
  const HS = window.HIDDEN_SPORT; if (!HS) return;
  const IS_EPL = HS === "epl", LBL = HS.toUpperCase();
  const NHLN = { ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres", CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks", COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars", DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers", LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montréal Canadiens", NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders", NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers", PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken", STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs", UTA: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights", WSH: "Washington Capitals", WPG: "Winnipeg Jets" };
  const nm = (c) => (IS_EPL ? c : NHLN[c] ?? c);
  const [GT, OT] = IS_EPL ? [0.55, 0.45] : [0.65, 0.55]; // EPL 3-way: 60/50. NHL 2-way: 65/55 (John, 23 Oct)
  const lightOf = (p) => (p >= GT ? "GREEN" : p >= OT ? "ORANGE" : "RED");
  // EPL lights (GREEN 55%+, ORANGE 45-55%, RED <45%; from the 2023-26 walk-forward backtest) apply only to matches kicking off
  // from the switch-on time; earlier EPL picks keep no light (no re-colouring). NHL always has lights.
  const EPL_LIGHTS_FROM = "2026-10-23T23:42:00Z";
  const LIGHTS = true;
  const lchip = (l) => (l ? chip(l) : "");
  const H = { games: [], grades: {}, table: null, bt: null, ready: false };
  let SELR = null, SELD = null;
  const get = (u, d) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : d)).catch(() => d);
  async function load() {
    const [raw, grades, table, bt, snap, w2] = await Promise.all([get(`/data/${HS}-picks.json`, []), get(`/data/${HS}-grades.json`, {}), get(`/api/hidden-table?sport=${HS}`, null), get(`/data/${HS}-backtest.json`, null), IS_EPL ? {} : get("/data/nhl-pretip.json", {}), IS_EPL ? get("/data/epl-win2.json", {}) : {}]);
    const SN = snap?.games ?? {};
    H.games = (Array.isArray(raw) ? raw : raw.games ?? []).map((g) => {
      const pc = (v) => (v == null || v === "" ? null : Number(v) > 1 ? Number(v) / 100 : Number(v)); // NHL feed sends 0-100
      const x = { ...g, game_id: String(g.game_id ?? g.id), start_utc: g.start_utc ?? g.kickoff_utc ?? g.puck_drop_utc ?? g.date, home_name: nm(g.home), away_name: nm(g.away),
        p_home: pc(g.p_home ?? g.home_pct), p_away: pc(g.p_away ?? g.away_pct), p_draw: pc(g.p_draw ?? g.draw_pct) };
      x.pick_p = Number(x.pick === "home" ? x.p_home : x.pick === "away" ? x.p_away : x.p_draw);
      x.pick_name = x.pick === "home" ? x.home_name : x.pick === "away" ? x.away_name : "Draw";
      x.light = !IS_EPL || x.start_utc >= EPL_LIGHTS_FROM ? lightOf(x.pick_p) : null;
      const sn = SN[x.game_id]; // pre-puck-drop snapshot: frozen pick, chance and light; record graded from it
      if (sn) { x.pick = sn.pick === g.home ? "home" : "away"; x.pick_p = Number(sn.pick_p); x.pick_name = x.pick === "home" ? x.home_name : x.away_name; x.light = sn.light; }
      const gr = grades[x.game_id]; x.graded = !!gr?.graded; x.correct = gr?.graded ? gr.correct : null; x.flag = gr && !gr.graded ? gr.flag : null;
      if (gr?.graded) { x.home_score = gr.home_score; x.away_score = gr.away_score; }
      if (sn && typeof sn.won === "boolean") { x.graded = true; x.correct = sn.won; x.flag = null; }
      const w = IS_EPL ? w2?.games?.[x.game_id] : null; // model chance the higher-chance team wins by 2+ goals (dc_xg v1)
      x.w2 = w && (w.side === "home" || w.side === "away") ? { name: w.side === "home" ? x.home_name : x.away_name, p: Number(w.p) } : null;
      x.finished = x.graded || x.status === "post" || new Date(x.start_utc).getTime() < Date.now() - 3 * 3600e3;
      return x; }).sort((a, b) => a.start_utc.localeCompare(b.start_utc));
    H.grades = grades; H.table = table; H.bt = bt; H.ready = true;
    const up = H.games.find((g) => !g.finished) ?? H.games[H.games.length - 1];
    if (up) { SELR = up.round ?? null; SELD = keyOf(up.start_utc); }
  }
  const graded = () => H.games.filter((g) => g.graded);
  const W = (xs) => xs.filter((g) => g.correct).length;

  // ---------- card (same markup/classes as the live card) ----------
  function hcard(g) {
    const post = g.graded;
    const team = (side, name, role, p) => `<div class="team ${role === "Home" ? "r" : ""} ${g.pick === side ? "picked" : ""}">
      <div class="nm">${esc(name)}</div><div class="role">${role}${post && g.home_score != null ? ` · <b style="color:var(--ink)">${role === "Home" ? g.home_score : g.away_score}</b>` : ""}</div><div class="pc">${pct(p)}</div></div>`;
    const mid = IS_EPL ? `<div class="team ${g.pick === "draw" ? "picked" : ""}" style="text-align:center"><div class="nm" style="font-size:13px;color:var(--magenta)">Draw</div><div class="role">&nbsp;</div><div class="pc">${pct(g.p_draw)}</div></div>` : `<div class="at">@</div>`;
    const first = IS_EPL ? team("home", g.home_name, "Home", g.p_home).replace('class="team r ', 'class="team ') : team("away", g.away_name, "Away", g.p_away);
    const last = IS_EPL ? team("away", g.away_name, "Away", g.p_away).replace('class="team  ', 'class="team r ') : team("home", g.home_name, "Home", g.p_home);
    const segs = IS_EPL ? [["home", g.p_home], ["draw", g.p_draw], ["away", g.p_away]] : [["away", g.p_away], ["home", g.p_home]];
    const status = post ? "Final" : g.finished ? "Result being checked" : fmtTime.format(new Date(g.start_utc));
    return `<article class="card ${LIGHTS && g.light === "GREEN" ? "tip" : ""} ${post ? "done" : ""}" data-game="${esc(g.game_id)}" tabindex="0" role="link" aria-label="${esc(g.home_name)} and ${esc(g.away_name)}, details">
    <div class="card-top"><span class="time">${status}</span>${lchip(g.light)}${post ? `<span class="mark ${g.correct ? "W" : "L"}">${g.correct ? "✓" : "✕"}</span>` : ""}</div>
    <div class="teams" ${IS_EPL ? 'style="grid-template-columns:1fr auto 1fr"' : ""}>${first}${mid}${last}</div>
    <div class="bar${IS_EPL ? " bar3" : ""}">${segs.map(([k, p]) => `<i class="seg-${k} ${g.pick === k ? "pk" : ""}" style="width:${p * 100}%"></i>`).join("")}</div>
    <div class="card-top"><dl class="prices"><div><dt>Pick</dt><dd>${esc(g.pick_name)}</dd></div><div><dt>Chance</dt><dd>${pct(g.pick_p)}</dd></div></dl><span class="more">Details →</span></div>
    ${IS_EPL && g.w2 && !g.finished ? `<div class="card-top"><dl class="prices"><div><dt>Chance of winning by 2+</dt><dd>${esc(g.w2.name)} ${pct(g.w2.p)}</dd></div></dl></div>` : ""}
  </article>`;
  }
  const legend = () => (!LIGHTS ? "" : `<div class="legend" aria-label="Light key"><span><i class="chip GREEN">Green</i> ${pct(GT)}+, rated likely</span><span><i class="chip ORANGE">Orange</i> lean</span><span><i class="chip RED">Red</i> under ${pct(OT)}</span></div>`);

  // ---------- predictions ----------
  function predictions() {
    let list, head, keys, cur;
    if (IS_EPL) { keys = [...new Set(H.games.map((g) => g.round))].sort((a, b) => a - b); cur = SELR; list = H.games.filter((g) => g.round === SELR); head = `Round ${SELR ?? "–"} · 2026–27`; }
    else { keys = [...new Set(H.games.map((g) => keyOf(g.start_utc)))].sort(); cur = SELD; list = H.games.filter((g) => keyOf(g.start_utc) === SELD); head = SELD ? `${SELD === keyOf(Date.now()) ? "Today · " : ""}${fmtDay.format(new Date(SELD + "T12:00"))}` : "No games"; }
    const i = keys.indexOf(cur), done = list.filter((g) => g.graded), gr = list.filter((g) => g.light === "GREEN");
    const byDay = {}; list.forEach((g) => (byDay[keyOf(g.start_utc)] ??= []).push(g));
    document.getElementById("main").innerHTML = `
    <div class="daynav">
      <button type="button" data-hstep="-1" aria-label="Previous" ${i <= 0 ? "disabled" : ""}>‹</button><h2>${esc(head)}</h2>
      <button type="button" data-hstep="1" aria-label="Next" ${i >= keys.length - 1 ? "disabled" : ""}>›</button>
      ${IS_EPL ? `<select class="season" id="hroundSel" aria-label="Round">${keys.map((k) => `<option value="${k}" ${k === cur ? "selected" : ""}>Round ${k}</option>`).join("")}</select>` : ""}
    </div>
    <div class="daysum"><span><b>${list.length}</b> games</span>${LIGHTS ? `<span><b>${gr.length}</b> green</span>` : ""}${done.length ? `<span>Picks <b>${W(done)}–${done.length - W(done)}</b></span>` : ""}<span>Times in ${esc(TZNAME)}</span></div>
    ${legend()}
    ${list.length ? Object.entries(byDay).map(([k, xs]) => `<div class="dayhead">${esc(fmtDay.format(new Date(k + "T12:00")))}</div>${xs.map(hcard).join("")}`).join("")
      : `<div class="panel"><h2>No games yet</h2><p>Predictions appear here before ${IS_EPL ? "kick-off" : "puck drop"}.</p></div>`}`;
  }
  // ---------- record ----------
  let HFILTER = "all";
  function record() {
    if (!IS_EPL) return recordNHL();
    return recordPlain();
  }
  // NHL record in the same layout as the NBA/NFL record tab (stats, by light, calibration, every pick); graded from /data/nhl-pretip.json snapshots
  function recordNHL() {
    const lede = `<div><h2>Our record</h2><p class="lede" style="margin-top:6px">Live picks only, counted from the first saved live pick. Each pick, chance and light is saved before puck drop and can't change after the start; the record is graded from those saved picks.</p></div>`;
    const done = graded().slice().reverse(), tips = done.filter((x) => x.light === "GREEN"), w = W, rate = (xs) => (xs.length ? pct(w(xs) / xs.length) : "–");
    const pending = H.games.filter((x) => x.finished && !x.graded).length;
    if (!done.length) { document.getElementById("main").innerHTML = lede + `<div class="panel"><h2>No results yet</h2><p>Every pick stays on the record, right or wrong.</p></div>`; return; }
    const rows = (HFILTER === "tips" ? tips : done).slice(0, 80);
    document.getElementById("main").innerHTML = lede + `
    <div class="stats">${[["All picks", rate(done), `${w(done)}–${done.length - w(done)} from ${done.length} games`], ["Top picks", rate(tips), `${w(tips)}–${tips.length - w(tips)} green picks`]]
      .map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("")}</div>
    <div class="conf">
      <div class="panel"><h2>By light</h2><div class="tablewrap"><table>
        <thead><tr><th>Light</th><th class="n">Picks</th><th class="n">Won</th><th class="n">Rate</th><th class="n">We said</th></tr></thead><tbody>
        ${["GREEN", "ORANGE", "RED"].map((l) => { const xs = done.filter((g) => g.light === l);
          return `<tr><td>${chip(l)}</td><td class="n">${xs.length}</td><td class="n">${w(xs)}</td><td class="n">${rate(xs)}</td><td class="n">${xs.length ? pct(xs.reduce((s, g) => s + g.pick_p, 0) / xs.length) : "–"}</td></tr>`; }).join("")}
      </tbody></table></div></div>
      <div class="panel"><h2>Are the percentages honest?</h2><p>Dots near the dashed line mean our 70% picks win about 70% of the time.</p>${calibSvg(done.map((g) => ({ pick_p: g.pick_p, won: !!g.correct })))}</div>
    </div>
    ${pending ? `<p class="note">${pending} finished game${pending > 1 ? "s are" : " is"} still being checked.</p>` : ""}
    <div class="panel">
      <div class="toolbar"><h2 class="grow">Every pick</h2>
        <div class="seg" id="hfilters"><button type="button" data-hf="all" aria-pressed="${HFILTER === "all"}">All</button><button type="button" data-hf="tips" aria-pressed="${HFILTER === "tips"}">Top picks only</button></div></div>
      <div class="tablewrap"><table>
        <thead><tr><th>Date</th><th>Game</th><th>Pick</th><th class="n">Chance</th><th>Light</th><th>Result</th><th class="n">Score</th></tr></thead><tbody>
        ${rows.map((g) => `<tr data-game="${esc(g.game_id)}" style="cursor:pointer"><td>${fmtShort.format(new Date(g.start_utc))}</td><td>${esc(g.away)} @ ${esc(g.home)}</td><td>${esc(g.pick === "home" ? g.home : g.away)}</td>
          <td class="n">${pct(g.pick_p)}</td><td>${chip(g.light)}</td><td><span class="wl ${g.correct ? "W" : "L"}">${g.correct ? "✓" : "✕"}</span></td>
          <td class="n">${g.away_score ?? "–"}–${g.home_score ?? "–"}</td></tr>`).join("")}
      </tbody></table></div>
    </div>`;
  }
  // EPL record in the NBA/NFL record layout, percentages only (no lights yet). A result is marked only when ESPN and football-data agree.
  function recordPlain() {
    const lede = `<div><h2>Our record</h2><p class="lede" style="margin-top:6px">Live picks only, counted from the first saved live pick (round 8, 2026–27). Each pick and chance is saved before kick-off and can't change after the start. A result is marked only when two score sources agree.</p></div>`;
    const done = graded().slice().reverse(), rate = (xs) => (xs.length ? pct(W(xs) / xs.length) : "–");
    const pending = H.games.filter((x) => x.finished && !x.graded).length;
    const note = pending ? `<p class="note">${pending} finished game${pending > 1 ? "s are" : " is"} still being checked against a second score source.</p>` : "";
    if (!done.length) { document.getElementById("main").innerHTML = lede + `<div class="panel"><h2>No results yet</h2><p>Every pick stays on the record, right or wrong.</p></div>` + note; return; }
    const draws = done.filter((g) => g.result === "draw" || (g.home_score != null && g.home_score === g.away_score)).length;
    const said = done.reduce((t, g) => t + g.pick_p, 0) / done.length;
    document.getElementById("main").innerHTML = lede + `
    <div class="stats">${[["All picks", rate(done), `${W(done)}–${done.length - W(done)} from ${done.length} game${done.length > 1 ? "s" : ""}`], ["We said", pct(said), "average chance of our picks"], ["Draws", pct(draws / done.length), `${draws} of ${done.length} ended level`]]
      .map(([k, v, s2]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s2}</div></div>`).join("")}</div>
    <div class="panel"><h2>Are the percentages honest?</h2><p>Picks grouped by the chance we gave them. If the chances are honest, each group's "Right" sits close to "We said". It takes a few rounds before this means much.</p>
      <div class="tablewrap"><table><thead><tr><th>Our chance</th><th class="n">Picks</th><th class="n">Right</th><th class="n">We said</th></tr></thead><tbody>
      ${[["Under 45%", 0, 0.45], ["45–55%", 0.45, 0.55], ["55–65%", 0.55, 0.65], ["65% or more", 0.65, 2]].map(([l, a, b]) => { const xs = done.filter((g) => g.pick_p >= a && g.pick_p < b);
        return `<tr><td>${l}</td><td class="n">${xs.length}</td><td class="n">${rate(xs)}</td><td class="n">${xs.length ? pct(xs.reduce((t, g) => t + g.pick_p, 0) / xs.length) : "–"}</td></tr>`; }).join("")}
      </tbody></table></div></div>
    ${note}
    <div class="panel"><div class="toolbar"><h2 class="grow">Every pick</h2></div>
      <div class="tablewrap"><table>
        <thead><tr><th>Match</th><th>Pick</th><th class="n">Chance</th><th>Result</th></tr></thead><tbody>
        ${done.slice(0, 120).map((g) => `<tr data-game="${esc(g.game_id)}" style="cursor:pointer"><td style="white-space:normal">${esc(g.home_name)} <b>${g.home_score ?? "–"}–${g.away_score ?? "–"}</b> ${esc(g.away_name)}<br><small style="color:var(--muted)">${fmtShort.format(new Date(g.start_utc))}</small></td>
          <td style="white-space:normal">${esc(g.pick_name)}</td><td class="n">${pct(g.pick_p)}</td><td><span class="wl ${g.correct ? "W" : "L"}">${g.correct ? "✓" : "✕"}</span></td></tr>`).join("")}
      </tbody></table></div></div>`;
  }
  // ---------- standings ----------
  function table() {
    const t = H.table;
    document.getElementById("main").innerHTML = `<div><h2>Standings &amp; scores</h2></div>` + (!t || !t.length ? `<div class="panel"><p>The table couldn't be loaded just now.</p></div>`
      : `<div class="panel" style="overflow-x:auto"><table><thead><tr><th align="left">#</th><th align="left">Team</th><th>P</th><th>W</th>${IS_EPL ? "<th>D</th>" : ""}<th>L</th>${IS_EPL ? "<th>GD</th>" : "<th>OTL</th>"}<th>Pts</th></tr></thead><tbody>
      ${t.map((r, i) => `<tr><td>${i + 1}</td><td><span class="tm">${IS_EPL ? "" : `<span class="badge">${esc(r.abbr)}</span>`}${esc(r.team)}</span></td><td align="center">${r.gp}</td><td align="center">${r.w}</td>${IS_EPL ? `<td align="center">${r.d}</td>` : ""}<td align="center">${r.l}</td><td align="center">${IS_EPL ? (r.gd > 0 ? "+" : "") + r.gd : r.otl}</td><td align="center"><b>${r.pts}</b></td></tr>`).join("")}</tbody></table></div>`)
      + `<div class="panel"><h2>Recent scores</h2><div class="stack">${H.games.filter((g) => g.graded).slice().reverse().slice(0, 12).map(hcard).join("") || "<p>No confirmed scores yet.</p>"}</div></div>`;
  }
  // ---------- stats (NHL past-season testing) ----------
  function stats() {
    const bt = H.bt;
    if (!bt) { document.getElementById("main").innerHTML = `<div><h2>Stats</h2></div><div class="panel"><h2>Past-season testing</h2><p>Coming soon.</p></div>`; return; }
    if (IS_EPL) {
      const er = Object.entries(bt.seasons).map(([y, v]) => `<tr><td>${y}–${String(+y + 1).slice(2)}${v.tuned ? " *" : ""}</td><td align="center">${v.n}</td><td align="center"><b>${pct(v.c / v.n)}</b></td><td align="center">${pct(v.home / v.n)}</td><td align="center">${pct(v.draws / v.n)}</td></tr>`).join("");
      document.getElementById("main").innerHTML = `<div><h2>Stats</h2></div><div class="panel"><h2>Past-season testing</h2>
        <p><b>This is a re-run on past seasons, not the live record.</b> The model was run match by match through each season using only results from earlier days, then checked against the real results. "Always home" is how often simply picking the home team was right.</p>
        <div style="overflow-x:auto"><table><thead><tr><th align="left">Season</th><th>Matches</th><th>Model right</th><th>Always home</th><th>Draws</th></tr></thead><tbody>${er}</tbody></table></div>
        <p>* Seasons used to choose the model's settings, so they flatter it a little. 2023–24 onwards is a clean test. With three possible results, about half right is a good season; draws are the hardest to call.</p></div>`;
      return;
    }
    const rows = Object.entries(bt.seasons).map(([s, v]) => `<tr><td>${s}–${String(+s + 1).slice(2)}${v.n < 1000 ? " (so far)" : ""}</td><td align="center">${v.n}</td><td align="center"><b>${pct(v.c / v.n)}</b></td><td align="center">${pct(v.home / v.n)}</td>
      ${["GREEN", "ORANGE", "RED"].map((l) => `<td align="center">${v.lights[l][0] ? `${pct(v.lights[l][1] / v.lights[l][0])} <small>(${v.lights[l][0]})</small>` : "–"}</td>`).join("")}</tr>`).join("");
    document.getElementById("main").innerHTML = `<div><h2>Stats</h2></div><div class="panel"><h2>Past-season testing</h2>
      <p><b>This is a re-run on past seasons, not the live record.</b> The model was run game by game through each season using only results from earlier days, then checked against the real results. "Always home" is how often simply picking the home team was right.</p>
      <div style="overflow-x:auto"><table><thead><tr><th align="left">Season</th><th>Games</th><th>Model right</th><th>Always home</th><th>Green</th><th>Orange</th><th>Red</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p>Light columns show how often picks with that light were right, with the number of games in brackets.</p></div>`;
  }
  // ---------- trends (NHL): every figure computed from this season's official NHL API results ----------
  let SEASONG = null;
  async function trends() {
    const main = document.getElementById("main");
    if (!SEASONG) { main.innerHTML = `<div class="panel"><h2>Loading trends</h2></div>`; SEASONG = await get("/api/nhl-season", { games: [] }); if (!location.hash.endsWith("-trends")) return; }
    const T = {};
    const add = (c, r, gf, ga, home, last) => { const x = (T[c] ??= { c, res: [], w: 0, l: 0, otl: 0, hw: 0, hl: 0, aw: 0, al: 0, gf: 0, ga: 0, one: [0, 0], ot: [0, 0] });
      x.res.push(r); x.gf += gf; x.ga += ga;
      if (r === "W") { x.w++; home ? x.hw++ : x.aw++; } else { last === "REG" ? x.l++ : x.otl++; home ? x.hl++ : x.al++; }
      if (Math.abs(gf - ga) === 1) x.one[r === "W" ? 0 : 1]++; if (last !== "REG") x.ot[r === "W" ? 0 : 1]++; };
    for (const g of SEASONG.games) { const hw = g.hs > g.as; add(g.home, hw ? "W" : "L", g.hs, g.as, true, g.last); add(g.away, hw ? "L" : "W", g.as, g.hs, false, g.last); }
    const rows = Object.values(T).map((x) => { const gp = x.res.length, cur = x.res[gp - 1]; let k = 0; for (let i = gp - 1; i >= 0 && x.res[i] === cur; i--) k++;
      const l10 = x.res.slice(-10); return { ...x, gp, pts: 2 * x.w + x.otl, sk: cur === "W" ? k : -k, streak: cur ? `${cur}${k}` : "–", w10: l10.filter((r) => r === "W").length, n10: l10.length }; })
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
    if (!rows.length) { main.innerHTML = `<div class="panel"><h2>No games yet</h2><p>Trends start after the first games of the season.</p></div>`; return; }
    const rec = (w, l) => `${w}–${l}`, per = (n, gp) => (gp ? (n / gp).toFixed(2) : "–");
    const mini = (title, xs, val, note = "") => `<div class="panel"><h2>${title}</h2>${note ? `<p>${note}</p>` : ""}<div class="formlist">${xs.map((r) => `<div class="fr"><span class="badge">${r.c}</span><span class="t">${esc(nm(r.c))}</span><span class="mono">${val(r)}</span></div>`).join("")}</div></div>`;
    const by = (f, n = 5) => rows.slice().sort(f).slice(0, n);
    const totalG = SEASONG.games.reduce((s, g) => s + g.hs + g.as, 0), n = SEASONG.games.length, otN = SEASONG.games.filter((g) => g.last !== "REG").length, homeW = SEASONG.games.filter((g) => g.hs > g.as).length;
    const lab = `${SEASONG.season.slice(0, 4)}–${SEASONG.season.slice(6)}`;
    main.innerHTML = `
    <div><h2>Season trends · ${lab}</h2><p class="lede" style="margin-top:6px">Form, streaks and scoring across the league, from this season's official NHL results. ${n} games played.</p></div>
    <div class="stats">${[["Goals per game", (totalG / n).toFixed(2), `${totalG} goals in ${n} games`], ["Home wins", pct(homeW / n), `${homeW} of ${n} games`], ["Past 60 minutes", pct(otN / n), `${otN} games went to overtime or a shootout`]]
      .map(([k, v, s2]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s2}</div></div>`).join("")}</div>
    <div class="statgrid">${mini("Hottest · last 10", by((a, b) => b.w10 - a.w10 || b.pts - a.pts), (r) => rec(r.w10, r.n10 - r.w10), "Wins in each team's last 10 games. Overtime and shootout losses count as losses here.")}
      ${mini("Coldest · last 10", by((a, b) => a.w10 - b.w10 || a.pts - b.pts), (r) => rec(r.w10, r.n10 - r.w10))}</div>
    <div class="statgrid">${mini("Longest streaks", by((a, b) => Math.abs(b.sk) - Math.abs(a.sk)), (r) => r.streak)}
      ${mini("Best at home", by((a, b) => b.hw / (b.hw + b.hl || 1) - a.hw / (a.hw + a.hl || 1) || b.hw - a.hw), (r) => rec(r.hw, r.hl))}</div>
    <div class="statgrid">${mini("Best on the road", by((a, b) => b.aw / (b.aw + b.al || 1) - a.aw / (a.aw + a.al || 1) || b.aw - a.aw), (r) => rec(r.aw, r.al))}
      ${mini("Most goals per game", by((a, b) => b.gf / b.gp - a.gf / a.gp), (r) => per(r.gf, r.gp))}</div>
    <div class="statgrid">${mini("Fewest goals allowed per game", by((a, b) => a.ga / a.gp - b.ga / b.gp), (r) => per(r.ga, r.gp))}
      ${mini("One-goal games", by((a, b) => (b.one[0] + b.one[1]) - (a.one[0] + a.one[1]) || b.one[0] - a.one[0]), (r) => rec(r.one[0], r.one[1]), "Most games decided by a single goal, with the team's record in them.")}</div>
    <div class="panel"><h2>Form guide · all ${rows.length} teams</h2><p>Last 10 games, oldest to newest. Green win, red loss (including overtime and shootout losses). Ordered by points.</p>
      <div class="formlist">${rows.map((r, i) => `<div class="fr"><span class="mono" style="color:var(--muted)">${i + 1}</span><span class="t"><span class="tm"><span class="badge">${r.c}</span>${esc(nm(r.c))}</span></span>${dots(r.res)}</div>`).join("")}</div></div>`;
  }
  // ---------- sidebar ----------
  function side() {
    const up = H.games.filter((g) => !g.finished), feat = up.slice().sort((a, b) => b.pick_p - a.pick_p)[0], g = graded();
    const last7 = g.filter((x) => new Date(x.start_utc).getTime() > Date.now() - 7 * 864e5);
    document.getElementById("side").innerHTML = `
    ${feat ? `<div class="mini"><h3>Top pick${IS_EPL ? " of the round" : ""}</h3><div class="feat" data-game="${esc(feat.game_id)}" tabindex="0" role="link">
      <div class="lbig">${esc(feat.pick_name)}</div><div class="big">${pct(feat.pick_p)}</div>
      <div class="row"><span class="t">${esc(IS_EPL ? `${feat.home_name} v ${feat.away_name}` : `${feat.away} @ ${feat.home}`)} · ${fmtShort.format(new Date(feat.start_utc))} ${fmtTime.format(new Date(feat.start_utc))}</span></div>
      ${feat.light ? `<div class="row">${chip(feat.light)}</div>` : ""}</div></div>` : ""}
    <div class="mini"><h3>Record</h3>
      <div class="row"><span class="t">All time</span><span class="n">${g.length ? `${W(g)}–${g.length - W(g)}` : "–"}</span></div>
      <div class="row"><span class="t">Last 7 days</span><span class="n">${last7.length ? `${W(last7)}–${last7.length - W(last7)}` : "–"}</span></div>
      <a class="back" href="#${HS}-record">Our record →</a></div>
    ${H.table?.length ? `<div class="mini"><h3>Best records</h3>${H.table.slice(0, 8).map((r, i) => `<div class="row"><span class="n">${i + 1}</span>${IS_EPL ? "" : `<span class="badge">${esc(r.abbr)}</span>`}<span class="t">${esc(r.team)}</span><span class="n">${r.pts} pts</span></div>`).join("")}
      <a class="back" href="#${HS}-table">Standings &amp; scores →</a></div>` : ""}`;
  }
  // ---------- game page ----------
  function game(id) {
    const g = H.games.find((x) => x.game_id === id), el = document.getElementById("view-game");
    if (!g) { el.innerHTML = `<a class="back" href="#${HS}-predictions">← Back</a><div class="panel"><h2>Game not found</h2></div>`; return; }
    const s = (k, name, role, p) => `<div class="side-t ${role === "Home" ? "r" : ""} ${g.pick === k ? "picked" : ""}"><div class="crest">${esc(IS_EPL ? (k === "draw" ? "–" : name.slice(0, 3).toUpperCase()) : g[k])}</div><div class="tn">${esc(name)}</div><div class="role eyebrow" style="margin:0">${role}</div><div class="pcbig">${pct(p)}</div></div>`;
    el.innerHTML = `<a class="back" href="#${HS}-predictions">← All games</a>
      <div class="eyebrow">${LBL}${g.round ? ` · Round ${g.round}` : ""} · ${esc(fmtDay.format(new Date(g.start_utc)))} ${esc(fmtTime.format(new Date(g.start_utc)))}</div>
      <h1>${esc(IS_EPL ? `${g.home_name} vs ${g.away_name}` : `${g.away_name} vs ${g.home_name}`)}</h1>
      ${hcard(g).replace('role="link"', "")}
      <div class="panel"><h2>The model's chances</h2><table><tbody>
        ${(IS_EPL ? [[`${g.home_name} win`, g.p_home, "home"], ["Draw", g.p_draw, "draw"], [`${g.away_name} win`, g.p_away, "away"]] : [[`${g.away_name} win`, g.p_away, "away"], [`${g.home_name} win`, g.p_home, "home"]])
          .map(([l, p, k]) => `<tr><td>${esc(l)}${g.pick === k ? " <b>(pick)</b>" : ""}</td><td align="right"><b>${pct(p)}</b></td></tr>`).join("")}${IS_EPL && g.w2 && !g.finished ? `<tr><td>Chance of winning by 2+: ${esc(g.w2.name)}</td><td align="right"><b>${pct(g.w2.p)}</b></td></tr>` : ""}</tbody></table>
        ${g.light ? `<p>The light shows how likely the model rates its pick: ${chip(g.light)} ${g.light === "GREEN" ? "the model rates this pick as likely." : g.light === "ORANGE" ? "a lean." : `under ${pct(OT)}, so the game is open.`}</p>` : `<p>The pick is the most likely of the three results.</p>`}</div>
      <div class="panel"><h2>Result</h2><p>${g.graded ? `Final: ${esc(g.home_name)} ${g.home_score}–${g.away_score} ${esc(g.away_name)}. The pick was ${g.correct ? '<b class="pos">right ✓</b>' : '<b class="neg">wrong ✕</b>'}.` : g.finished ? "The result is being checked against two score sources before it's marked." : `Not played yet. The prediction refreshes until ${IS_EPL ? "kick-off" : "puck drop"}, then it's frozen.`}</p></div>
      <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;
    window.scrollTo(0, 0);
  }
  // ---------- routing (takes over the app router on this page only) ----------
  const SUBS = IS_EPL ? { predictions, record, table, stats } : { predictions, record, trends, table, stats };
  const TABS = [["predictions", "Predictions"], ["record", "Our record"], ...(IS_EPL ? [] : [["trends", "Trends"]]), ["table", "Standings &amp; scores"], ["stats", "Stats"]];
  const LEDE = IS_EPL ? "Every Premier League match gets three chances from our proprietary data model: home win, draw and away win. Picks refresh until kick-off, then they're frozen. A result is marked only when two score sources agree."
    : "Every NHL game gets a win chance for each team from our proprietary data model. Picks refresh until puck drop, then they're frozen. A result is marked only when two score sources agree.";
  function hroute() {
    const h = location.hash.slice(1);
    if (/^(nba|nfl)-|^about$|^home$/.test(h)) { location.href = "/#" + h; return; }
    const isGame = h.startsWith("game-"), sub = h.startsWith(HS + "-") && SUBS[h.slice(HS.length + 1)] ? h.slice(HS.length + 1) : "predictions";
    ["home", "sport", "game", "about"].forEach((k) => (document.getElementById("view-" + k).hidden = k !== (isGame ? "game" : "sport")));
    document.getElementById("sportBar").hidden = false;
    document.querySelectorAll("#sportBar [data-sport]").forEach((a) => a.classList.toggle("on", a.dataset.sport === HS));
    document.querySelectorAll("nav.tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.top === "sport" ? "page" : "false"));
    document.getElementById("spEyebrow").textContent = `${IS_EPL ? "Premier League" : "NHL"} · win predictions`;
    document.getElementById("spLede").textContent = LEDE;
    const st = document.getElementById("subtabs"); st.setAttribute("aria-label", `${LBL} sections`);
    st.innerHTML = TABS.map(([k, l]) => `<a href="#${HS}-${k}" aria-current="${k === sub ? "page" : "false"}">${l}</a>`).join("");
    document.title = `${IS_EPL ? "Premier League" : "NHL"} Predictions | ProbaLab`;
    if (!H.ready) { document.getElementById("main").innerHTML = `<div class="panel"><h2>Loading predictions</h2></div>`; document.getElementById("side").innerHTML = ""; return; }
    if (isGame) return game(h.slice(5));
    SUBS[sub](); side();
  }
  // replace the app router; the app's own hashchange listener still fires first, then ours repaints
  route = hroute; // eslint-disable-line no-global-assign
  window.addEventListener("hashchange", hroute);
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-hstep]"); if (!b) return; e.stopPropagation();
    const d = Number(b.dataset.hstep);
    if (IS_EPL) { const ks = [...new Set(H.games.map((g) => g.round))].sort((a, b) => a - b); SELR = ks[Math.max(0, Math.min(ks.length - 1, ks.indexOf(SELR) + d))]; }
    else { const ks = [...new Set(H.games.map((g) => keyOf(g.start_utc)))].sort(); SELD = ks[Math.max(0, Math.min(ks.length - 1, ks.indexOf(SELD) + d))]; }
    predictions(); side();
  }, true);
  document.addEventListener("click", (e) => { const f = e.target.closest("#hfilters [data-hf]"); if (!f) return; e.stopPropagation(); HFILTER = f.dataset.hf; record(); }, true);
  document.addEventListener("change", (e) => { if (e.target.id === "hroundSel") { SELR = Number(e.target.value); predictions(); side(); } });
  load().then(hroute); hroute();
})();
