// Hidden EPL / NHL views inside the live app shell (served only at /epl and /nhl, noindex). Uses the app's own
// components and CSS (card, daynav, legend, side .mini). Lights: GREEN >= 60%, ORANGE 50-60%, RED < 50%.
(function () {
  const HS = window.HIDDEN_SPORT; if (!HS) return;
  const IS_EPL = HS === "epl", LBL = HS.toUpperCase();
  const NHLN = { ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres", CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks", COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars", DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers", LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montréal Canadiens", NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders", NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers", PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken", STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs", UTA: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights", WSH: "Washington Capitals", WPG: "Winnipeg Jets" };
  const nm = (c) => (IS_EPL ? c : NHLN[c] ?? c);
  const lightOf = (p) => (p >= 0.6 ? "GREEN" : p >= 0.5 ? "ORANGE" : "RED");
  const H = { games: [], grades: {}, table: null, bt: null, ready: false };
  let SELR = null, SELD = null;
  const get = (u, d) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : d)).catch(() => d);
  async function load() {
    const [raw, grades, table, bt] = await Promise.all([get(`/data/${HS}-picks.json`, []), IS_EPL ? {} : get("/data/nhl-grades.json", {}), get(`/api/hidden-table?sport=${HS}`, null), IS_EPL ? null : get("/data/nhl-backtest.json", null)]);
    H.games = (Array.isArray(raw) ? raw : raw.games ?? []).map((g) => {
      const x = { ...g, game_id: String(g.game_id), start_utc: g.start_utc ?? g.kickoff_utc ?? g.puck_drop_utc, home_name: nm(g.home), away_name: nm(g.away) };
      x.pick_p = Number(x.pick === "home" ? x.p_home : x.pick === "away" ? x.p_away : x.p_draw);
      x.pick_name = x.pick === "home" ? x.home_name : x.pick === "away" ? x.away_name : "Draw";
      x.light = lightOf(x.pick_p);
      const gr = grades[x.game_id]; x.graded = !!gr?.graded; x.correct = gr?.graded ? gr.correct : null; x.flag = gr && !gr.graded ? gr.flag : null;
      if (gr?.graded) { x.home_score = gr.home_score; x.away_score = gr.away_score; }
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
      <div class="nm">${esc(name)}</div><div class="role">${role}${post ? ` · <b style="color:var(--ink)">${role === "Home" ? g.home_score : g.away_score}</b>` : ""}</div><div class="pc">${pct(p)}</div></div>`;
    const mid = IS_EPL ? `<div class="team ${g.pick === "draw" ? "picked" : ""}" style="text-align:center"><div class="nm" style="font-size:13px;color:var(--magenta)">Draw</div><div class="role">&nbsp;</div><div class="pc">${pct(g.p_draw)}</div></div>` : `<div class="at">@</div>`;
    const first = IS_EPL ? team("home", g.home_name, "Home", g.p_home) : team("away", g.away_name, "Away", g.p_away);
    const last = IS_EPL ? team("away", g.away_name, "Away", g.p_away).replace('class="team  ', 'class="team r ') : team("home", g.home_name, "Home", g.p_home);
    const segs = IS_EPL ? [["home", g.p_home], ["draw", g.p_draw], ["away", g.p_away]] : [["away", g.p_away], ["home", g.p_home]];
    const status = post ? "Final" : g.finished ? "Result being checked" : fmtTime.format(new Date(g.start_utc));
    return `<article class="card ${g.light === "GREEN" ? "tip" : ""} ${post ? "done" : ""}" data-game="${esc(g.game_id)}" tabindex="0" role="link" aria-label="${esc(g.home_name)} and ${esc(g.away_name)}, details">
    <div class="card-top"><span class="time">${status}</span>${chip(g.light)}${post ? `<span class="mark ${g.correct ? "W" : "L"}">${g.correct ? "✓" : "✕"}</span>` : ""}</div>
    <div class="teams" ${IS_EPL ? 'style="grid-template-columns:1fr auto 1fr"' : ""}>${first}${mid}${last}</div>
    <div class="bar">${segs.map(([k, p]) => `<i class="${g.pick === k ? "pk" : ""}" style="width:${p * 100}%"></i>`).join("")}</div>
    <div class="card-top"><dl class="prices"><div><dt>Pick</dt><dd>${esc(g.pick_name)}</dd></div><div><dt>Chance</dt><dd>${pct(g.pick_p)}</dd></div></dl><span class="more">Details →</span></div>
  </article>`;
  }
  const legend = `<div class="legend" aria-label="Light key"><span><i class="chip GREEN">Green</i> 60%+, rated likely</span><span><i class="chip ORANGE">Orange</i> lean</span><span><i class="chip RED">Red</i> under 50%</span></div>`;

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
    <div class="daysum"><span><b>${list.length}</b> games</span><span><b>${gr.length}</b> green</span>${done.length ? `<span>Picks <b>${W(done)}–${done.length - W(done)}</b></span>` : ""}<span>Times in ${esc(TZNAME)}</span></div>
    ${legend}
    ${list.length ? Object.entries(byDay).map(([k, xs]) => `<div class="dayhead">${esc(fmtDay.format(new Date(k + "T12:00")))}</div>${xs.map(hcard).join("")}`).join("")
      : `<div class="panel"><h2>No games yet</h2><p>Predictions appear here before ${IS_EPL ? "kick-off" : "puck drop"}.</p></div>`}`;
  }
  // ---------- record ----------
  function record() {
    const g = graded(), gr = g.filter((x) => x.light === "GREEN"), rate = (xs) => (xs.length ? pct(W(xs) / xs.length) : "–");
    const pending = H.games.filter((x) => x.finished && !x.graded).length;
    document.getElementById("main").innerHTML = `<div><h2>Our record</h2><p class="lede" style="margin-top:6px">Live picks only, counted from the first saved live pick. A result is marked only when two independent score sources agree.</p></div>
    ${g.length ? `<div class="panel"><table><thead><tr><th align="left"></th><th>Picks</th><th>Right</th><th>Rate</th></tr></thead><tbody>
      <tr><td>All picks</td><td align="center">${g.length}</td><td align="center">${W(g)}</td><td align="center"><b>${rate(g)}</b></td></tr>
      <tr><td>Green</td><td align="center">${gr.length}</td><td align="center">${W(gr)}</td><td align="center"><b>${rate(gr)}</b></td></tr></tbody></table>
      ${pending ? `<p>${pending} finished game${pending > 1 ? "s are" : " is"} still being checked against a second score source.</p>` : ""}</div>
      <div class="stack">${g.slice().reverse().slice(0, 40).map(hcard).join("")}</div>`
    : `<div class="panel"><h2>No results yet</h2><p>${pending ? `${pending} finished game${pending > 1 ? "s are" : " is"} waiting for a second score source before ${pending > 1 ? "they are" : "it is"} marked. ` : ""}Every pick stays on the record, right or wrong.</p></div>`}`;
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
    const rows = Object.entries(bt.seasons).map(([s, v]) => `<tr><td>${s}–${String(+s + 1).slice(2)}${v.n < 1000 ? " (so far)" : ""}</td><td align="center">${v.n}</td><td align="center"><b>${pct(v.c / v.n)}</b></td><td align="center">${pct(v.home / v.n)}</td>
      ${["GREEN", "ORANGE", "RED"].map((l) => `<td align="center">${v.lights[l][0] ? `${pct(v.lights[l][1] / v.lights[l][0])} <small>(${v.lights[l][0]})</small>` : "–"}</td>`).join("")}</tr>`).join("");
    document.getElementById("main").innerHTML = `<div><h2>Stats</h2></div><div class="panel"><h2>Past-season testing</h2>
      <p><b>This is a re-run on past seasons, not the live record.</b> The model was run game by game through each season using only results from earlier days, then checked against the real results. "Always home" is how often simply picking the home team was right.</p>
      <div style="overflow-x:auto"><table><thead><tr><th align="left">Season</th><th>Games</th><th>Model right</th><th>Always home</th><th>Green</th><th>Orange</th><th>Red</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p>Light columns show how often picks with that light were right, with the number of games in brackets.</p></div>`;
  }
  // ---------- sidebar ----------
  function side() {
    const up = H.games.filter((g) => !g.finished), feat = up.slice().sort((a, b) => b.pick_p - a.pick_p)[0], g = graded();
    const last7 = g.filter((x) => new Date(x.start_utc).getTime() > Date.now() - 7 * 864e5);
    document.getElementById("side").innerHTML = `
    ${feat ? `<div class="mini"><h3>Top pick${IS_EPL ? " of the round" : ""}</h3><div class="feat" data-game="${esc(feat.game_id)}" tabindex="0" role="link">
      <div class="lbig">${esc(feat.pick_name)}</div><div class="big">${pct(feat.pick_p)}</div>
      <div class="row"><span class="t">${esc(IS_EPL ? `${feat.home_name} v ${feat.away_name}` : `${feat.away} @ ${feat.home}`)} · ${fmtShort.format(new Date(feat.start_utc))} ${fmtTime.format(new Date(feat.start_utc))}</span></div>
      <div class="row">${chip(feat.light)}</div></div></div>` : ""}
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
          .map(([l, p, k]) => `<tr><td>${esc(l)}${g.pick === k ? " <b>(pick)</b>" : ""}</td><td align="right"><b>${pct(p)}</b></td></tr>`).join("")}</tbody></table>
        <p>The light shows how likely the model rates its pick: ${chip(g.light)} ${g.light === "GREEN" ? "the model rates this pick as likely." : g.light === "ORANGE" ? "a lean." : "under 50%, so the game is open."}</p></div>
      <div class="panel"><h2>Result</h2><p>${g.graded ? `Final: ${esc(g.home_name)} ${g.home_score}–${g.away_score} ${esc(g.away_name)}. The pick was ${g.correct ? '<b class="pos">right ✓</b>' : '<b class="neg">wrong ✕</b>'}.` : g.finished ? "The result is being checked against two score sources before it's marked." : `Not played yet. The prediction refreshes until ${IS_EPL ? "kick-off" : "puck drop"}, then it's locked.`}</p></div>
      <p class="note">Probabilities come from ProbaLab's own model. They are for entertainment, not advice.</p>`;
    window.scrollTo(0, 0);
  }
  // ---------- routing (takes over the app router on this page only) ----------
  const SUBS = { predictions, record, table, stats };
  const TABS = [["predictions", "Predictions"], ["record", "Our record"], ["table", "Standings &amp; scores"], ["stats", "Stats"]];
  const LEDE = IS_EPL ? "Every Premier League match gets three chances from our proprietary data model: home win, draw and away win. Picks refresh until kick-off, then they're locked. A result is marked only when two score sources agree."
    : "Every NHL game gets a win chance for each team from our proprietary data model. Picks refresh until puck drop, then they're locked. A result is marked only when two score sources agree.";
  function hroute() {
    const h = location.hash.slice(1);
    if (/^(nba|nfl)-|^about$|^home$/.test(h)) { location.href = "/#" + h; return; }
    const isGame = h.startsWith("game-"), sub = h.startsWith(HS + "-") && SUBS[h.slice(HS.length + 1)] ? h.slice(HS.length + 1) : "predictions";
    ["home", "sport", "game", "about"].forEach((k) => (document.getElementById("view-" + k).hidden = k !== (isGame ? "game" : "sport")));
    document.getElementById("sportBar").hidden = false;
    document.querySelectorAll("#sportBar [data-sport]").forEach((a) => a.classList.remove("on"));
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
  document.addEventListener("change", (e) => { if (e.target.id === "hroundSel") { SELR = Number(e.target.value); predictions(); side(); } });
  load().then(hroute); hroute();
})();
