// Tennis view inside the live app shell (served at /tennis by functions/tennis/[[path]].js). Live 7 Nov 2026.
// Data: /data/tennis-picks.json (copied from Supabase every 30 minutes by .github/workflows/tennis-picks.yml) and
// /data/tennis-backtest.json (2021-2026 walk-forward re-run). Lights: GREEN 70%+, ORANGE 60-70%, RED under 60% (a close match).
// Layout as approved in the tennis design: tournament dropdown with the main tournaments and LIVE badges, one day at a time,
// tour tabs, Greens only, sort, player search, compact two-player rows. Finished picks show beat-the-close (data/tennis-market.json).
(function () {
  if (window.HIDDEN_SPORT !== "tennis") return;
  const LC = { GREEN: "var(--green)", ORANGE: "var(--orange)", RED: "var(--red)" };
  // the main tournaments, always listed; m = how the live feed's tournament name (or city) is recognised
  const TOURNEYS = [
    ["Grand Slams", [["Australian Open", "Jan", /australian open/i], ["Roland-Garros", "May–Jun", /roland|french open/i], ["Wimbledon", "Jun–Jul", /wimbledon/i], ["US Open", "Aug–Sep", /us open/i]]],
    ["Australian summer", [["Brisbane International", "Jan", /brisbane/i], ["ASB Classic, Auckland", "Jan", /auckland|asb classic/i], ["Adelaide International", "Jan", /adelaide/i], ["Hobart International", "Jan · WTA", /hobart/i]]],
    ["1000 events", [["Doha", "Feb · WTA", /doha|qatar/i], ["Dubai", "Feb · WTA", /dubai/i], ["Indian Wells", "Mar", /indian wells|bnp paribas open/i], ["Miami", "Mar", /miami open/i], ["Monte-Carlo", "Apr · ATP", /monte.?carlo/i],
      ["Madrid", "Apr–May", /madrid/i], ["Rome", "May", /internazionali|italian open|\brome\b/i], ["Canada", "Aug", /canad|national bank|montreal|toronto/i], ["Cincinnati", "Aug", /cincinnati/i],
      ["Beijing", "Oct · WTA", /china open|beijing/i], ["Shanghai", "Oct · ATP", /shanghai/i], ["Wuhan", "Oct · WTA", /wuhan/i], ["Paris", "Nov · ATP", /paris masters|rolex paris/i]]],
    ["Season finals", [["WTA Finals", "Nov", /wta finals/i], ["ATP Finals", "Nov", /atp finals|nitto/i]]],
  ];
  const H = { feed: null, bt: null, ready: false, all: [], tours: [] };
  const S = { sel: "", day: null, tour: "all", light: (["green","all","orange","red"].includes((new URLSearchParams(location.search).get("light")||"green").toLowerCase()) ? (new URLSearchParams(location.search).get("light")||"green").toLowerCase() : "green"), sort: "conf", q: "", open: false };
  const get = (u, d) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : d)).catch(() => d);
  const fmtDayShort = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
  const live = (t) => t && t.live;
  // which static list item a feed tournament belongs to (several feed events can share one: ATP + WTA at a joint event)
  const itemOf = (t) => { for (const [, items] of TOURNEYS) for (const it of items) if (it[2].test(t.name) || it[2].test(t.city ?? "")) return it[0]; return null; };
  const P1 = (x) => (Math.round(x) === 100 ? "99%" : Math.round(x) + "%");

  async function load() {
    const [feed, bt, mk] = await Promise.all([get("/data/tennis-picks.json", null), get("/data/tennis-backtest.json", null), get("/data/tennis-market.json", {})]);
    H.feed = feed; H.bt = bt; H.mk = mk ?? {}; H.ready = true;
    H.tours = (feed?.tournaments ?? []).map((t) => ({ ...t, item: itemOf(t) }));
    H.all = (feed?.matches ?? []).map((m) => { const v = H.mk[m.id]?.[m.pick]; // beat-the-close for our pick (data/tennis-market.json)
      return { ...m, pick_name: m.pick === "a" ? m.player_a : m.player_b, key: keyOf(m.start_utc), right: m.result === "won" ? true : m.result === "lost" ? false : null,
        ...(v && v.vs_close != null ? { posted_price: Number(v.posted_price), close_price: Number(v.close_price), vs_close: Number(v.vs_close) } : {}) }; });
    const lv = H.tours.filter(live);
    S.sel = lv.length > 1 ? "*" : (lv[0] ?? H.tours[H.tours.length - 1])?.id ?? "*";
    pickDay();
  }
  const selTours = () => (S.sel === "*" ? H.tours.filter(live) : S.sel.startsWith("item:") ? H.tours.filter((t) => t.item === S.sel.slice(5)) : H.tours.filter((t) => t.id === S.sel));
  const inSel = () => { const ids = new Set(selTours().map((t) => t.id)); return H.all.filter((m) => ids.has(m.tournament_id)); };
  const daysOf = (xs) => [...new Set(xs.map((m) => m.key))].sort();
  function pickDay() {
    const ks = daysOf(inSel()), today = keyOf(Date.now());
    S.day = ks.includes(today) ? today : ks.find((k) => k > today) ?? ks[ks.length - 1] ?? null;
  }
  const selLabel = () => {
    if (S.sel === "*") return ["All tournaments on now", true];
    const ts = selTours(); if (S.sel.startsWith("item:")) return [S.sel.slice(5), ts.some(live)];
    return ts[0] ? [ts[0].name, live(ts[0])] : ["Tournaments", false];
  };
  const LIVEB = `<span class="tn-live"><i></i>LIVE</span>`;
  const chev = `<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="${S.open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}"></polyline></svg>`;

  // ---------- tournament dropdown ----------
  function picker() {
    const [lab, isLive] = selLabel();
    const opt = (val, name, right, on) => `<button type="button" role="option" class="tn-opt" data-tsel="${esc(val)}" aria-selected="${on}"><span class="nm">${esc(name)}</span>${right}</button>`;
    const extra = H.tours.filter((t) => !t.item);
    const lvN = H.tours.filter(live).length;
    let list = "";
    if (lvN > 1 || extra.length) {
      list += `<div class="tn-grp">On now</div>`;
      if (lvN > 1) list += opt("*", "All tournaments on now", LIVEB, S.sel === "*");
      for (const t of extra) list += opt(t.id, `${t.name} · ${t.tour}`, live(t) ? LIVEB : `<span class="when">Results</span>`, S.sel === t.id);
    }
    for (const [g, items] of TOURNEYS) {
      list += `<div class="tn-grp">${esc(g)}</div>`;
      for (const [name, when] of items) {
        const ts = H.tours.filter((t) => t.item === name), on = ts.some(live);
        list += opt(`item:${name}`, name, on ? LIVEB : ts.length ? `<span class="when">Results</span>` : `<span class="when">${esc(when)}</span>`, S.sel === `item:${name}`);
      }
    }
    return `<div class="tn-pick">
      <button type="button" class="tn-pickbtn" id="tnPickBtn" aria-haspopup="listbox" aria-expanded="${S.open}">${esc(lab)} ${isLive ? LIVEB : ""}${chev}</button>
      ${S.open ? `<div class="tn-list" role="listbox" aria-label="Tournaments">${list}<p class="tn-foot">Every other ATP and WTA main-tour event appears here while it's being played.</p></div>` : ""}
    </div>`;
  }

  // ---------- rows ----------
  function row(m) {
    const col = LC[m.light] ?? "var(--muted)", post = m.status === "post";
    const side = (k, name, p) => { const on = m.pick === k, won = post && m.winner === k;
      return `<div class="tn-pl"><span class="nm ${on ? "on" : ""}">${esc(name)}${won ? '<span class="w" title="Winner"> ●</span>' : ""}</span><span class="pc ${on ? "on" : ""}" style="${on ? `color:${col}` : ""}">${P1(p)}</span></div>`; };
    const tail = post ? (m.result === "void" ? `<span class="tn-st">No result</span>` : `<span class="tn-st"><b class="${m.right ? "pos" : "neg"}">${m.right ? "✓" : "✕"}</b> ${esc(m.score ?? "")}${m.retired ? " ret." : ""}</span>`)
      : m.status === "in" ? `<span class="tn-st"><b class="tn-on">● Playing</b> ${esc(m.score ?? "")}</span>` : m.status === "due" ? `<span class="tn-st">Starting soon</span>` : m.time_tbc ? `<span class="tn-st">time TBC</span>` : `<span class="tn-st">${esc(fmtTime.format(new Date(m.start_utc)))}</span>`;
    return `<div class="tn-row">
      <div class="tn-pls">${side("a", m.player_a, m.a_pct)}${side("b", m.player_b, m.b_pct)}
        <div class="tn-bar"><i style="width:${m.a_pct}%;background:${m.pick === "a" ? col : "var(--line-hi)"}"></i><i style="width:${m.b_pct}%;background:${m.pick === "b" ? col : "var(--line-hi)"}"></i></div></div>
      <div class="tn-r">${chip(m.light)}${post && m.vs_close != null
        ? `<span class="tn-fair" title="Best Australian price for our pick before the start, against the fair closing price $${m.close_price.toFixed(2)}">$${m.posted_price.toFixed(2)} <b class="${m.vs_close > 0 ? "clv-pos" : "clv-neg"}">${sgnPct(m.vs_close)}</b></span>`
        : `<span class="tn-fair" title="Fair price = 1 ÷ our chance">Fair <b>${(100 / m.pick_pct).toFixed(2)}</b></span>`}${tail}</div>
    </div>`;
  }
  const tally = (xs) => { const d = xs.filter((m) => m.right != null), w = d.filter((m) => m.right).length;
    return `${xs.length} match${xs.length === 1 ? "" : "es"} · ${xs.filter((m) => m.light === "GREEN").length} green${d.length ? ` · picks ${w}–${d.length - w}` : ""}`; };

  // ---------- predictions ----------
  function predictions() {
    const main = document.getElementById("main");
    if (!H.tours.length) { main.innerHTML = picker() + `<div class="panel"><h2>No tournament on right now</h2><p>Predictions for every ATP and WTA main-draw match appear here once the next draw is out.</p></div>`; return; }
    const base = inSel();
    if (!base.length) {
      const [lab] = selLabel(); const it = TOURNEYS.flatMap(([, x]) => x).find((x) => `item:${x[0]}` === S.sel);
      main.innerHTML = `<div class="tn-head">${picker()}</div><div class="panel"><h2>${esc(lab)} isn't being played right now</h2><p>Predictions for every main-draw match appear here once the draw is out${it ? ` (${esc(it[1].replace(/ · .*/, ""))})` : ""}. Pick a tournament marked LIVE to see today's matches.</p></div>`;
      return;
    }
    const ks = daysOf(base); if (!ks.includes(S.day)) pickDay();
    const i = ks.indexOf(S.day), dayAll = base.filter((m) => m.key === S.day);
    const q = S.q.trim().toLowerCase();
    const matchTL = (light, f) => f === "all" || (f === "green" ? light === "GREEN" : light === f.toUpperCase());
    let list = dayAll.filter((m) => (S.tour === "all" || m.tour === S.tour) && matchTL(m.light, S.light) && (!q || `${m.player_a} ${m.player_b}`.toLowerCase().includes(q)));
    if (S.light === "all") list = list.slice().sort((a, b) => (a.light === "GREEN" ? 0 : a.light === "ORANGE" ? 1 : 2) - (b.light === "GREEN" ? 0 : b.light === "ORANGE" ? 1 : 2) || a.start_utc.localeCompare(b.start_utc));
    list = list.slice().sort(S.sort === "conf" ? (x, y) => y.pick_pct - x.pick_pct : (x, y) => x.start_utc.localeCompare(y.start_utc) || x.id.localeCompare(y.id));
    const rounds = [...new Set(dayAll.map((m) => m.round))];
    const ts = selTours().filter((t) => (S.tour === "all" || t.tour === S.tour));
    const groups = ts.map((t) => ({ t, xs: list.filter((m) => m.tournament_id === t.id) })).filter((g) => g.xs.length || dayAll.some((m) => m.tournament_id === g.t.id && (S.tour === "all" || m.tour === S.tour)));
    const d = list.filter((m) => m.right != null), w = d.filter((m) => m.right).length;
    const tb = (k, l) => `<button type="button" data-ttour="${k}" aria-pressed="${S.tour === k}">${l}</button>`;
    main.innerHTML = `
    <div class="tn-head">${picker()}
      <div class="tn-day"><button type="button" data-tday="-1" aria-label="Previous day" ${i <= 0 ? "disabled" : ""}>‹</button>
        <div class="lbl">${esc(S.day === keyOf(Date.now()) ? "Today · " : "")}${esc(fmtDayShort.format(dateOfKey(S.day)).toUpperCase())}<br><span>${esc(rounds.join(" · "))} · ${dayAll.length} match${dayAll.length === 1 ? "" : "es"}</span></div>
        <button type="button" data-tday="1" aria-label="Next day" ${i >= ks.length - 1 ? "disabled" : ""}>›</button></div>
    </div>
    <div class="tn-tools">
      <div class="seg tn-seg" role="group" aria-label="Tour">${tb("all", "All")}${tb("ATP", "ATP")}${tb("WTA", "WTA")}</div>
      <button type="button" class="tn-btn" id="tnSort">${S.sort === "conf" ? "Sort: most confident" : "Sort: start time"}</button>
      <label class="tn-q"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
        <span class="sr">Find a player</span><input type="search" id="tnQ" value="${esc(S.q)}" placeholder="Find a player" autocomplete="off"></label>
    </div>
    ${(() => { const btns=[["green","Green","GREEN"],["all","All",""],["orange","Orange","ORANGE"],["red","Red","RED"]]; return `<div class="game-filter-bar"><nav class="game-filters lights" aria-label="Filter by light">${btns.map(([id,lab,cls])=>{const on=S.light===id;return `<button type="button" class="gf-btn${cls?` ${cls}`:""}${on?" on":""}" data-t-light="${id}"${on?' aria-current="true"':""}>${lab}</button>`;}).join("")}</nav>${S.light==="green"?`<p class="filter-note">Showing Green (70%+). Choose All lights for every colour.</p>`:S.light==="all"?`<p class="filter-note">All lights, green first.</p>`:""}</div>`; })()}
    <div class="daysum"><span><b>${list.length}</b> shown</span><span><b>${list.filter((m) => m.light === "GREEN").length}</b> green</span>${d.length ? `<span>Picks <b>${w}–${d.length - w}</b></span>` : ""}<span>Times in ${esc(TZNAME)}</span></div>
    <div class="legend" aria-label="Light key"><span>${chip("GREEN")} 70%+</span><span>${chip("ORANGE")} 60–70%</span><span>${chip("RED")} under 60%, a close match</span><span><a href="/lights">How the lights work</a></span></div>
    <p class="note" style="margin:0">Fair price = 1 ÷ our chance for the pick. Any price above it is better than our model's number; it isn't a tip.</p>
    ${groups.length ? groups.map(({ t, xs }) => `<section class="tn-grpbox">
      <div class="tn-gh"><h2>${esc(t.name)}</h2><span>${t.tour === "ATP" ? "Men's singles" : "Women's singles"} · ${esc(t.tour)} · ${esc(t.surface)} · best of ${t.best_of === 5 ? "five" : "three"} · ${tally(xs)}</span></div>
      ${xs.length ? xs.map(row).join("") : `<p class="tn-empty">No matches in this filter.</p>`}</section>`).join("") : `<div class="panel"><p>No matches in this filter.</p></div>`}
    <p class="note">● = the winner. Picks refresh until the first serve, then they're frozen. Best of five sets for men at the Grand Slams, three otherwise; the model adjusts for it. Qualifying matches aren't predicted.</p>`;
  }

  // ---------- record (live picks) ----------
  function record() {
    const main = document.getElementById("main"), done = H.all.filter((m) => m.right != null).slice().reverse(), rec = H.feed?.record;
    const lede = `<div><h2>Our record</h2><p class="lede" style="margin-top:6px">Live picks only, from 7 November 2026. Each pick, chance and light is saved before the first serve and can't change after it. A retirement counts as a result; a walkover doesn't.</p><p class="note"><a href="/results?sport=tennis">Full results, every pick and CSV →</a> · <a href="/lights">How the lights work</a></p></div>`;
    const R = (k) => rec?.[k] ?? { won: 0, lost: 0 }, rate = (o) => (o.won + o.lost ? pct(o.won / (o.won + o.lost)) : "–");
    if (!R("ALL").won && !R("ALL").lost) { main.innerHTML = lede + `<div class="panel"><h2>No results yet</h2><p>The first live picks are being played now. Every pick stays on the record, right or wrong.</p></div>` + btPanel(); return; }
    // beat the close over every live pick with prices (the market file keeps all of them; the feed keeps 7 days)
    const vc = Object.values(H.mk ?? {}).map((e) => e?.[e.pick]).filter((v) => v && v.vs_close != null).map((v) => Number(v.vs_close));
    const vcStat = vc.length ? [["Beat the close", pct(vc.filter((x) => x > 0).length / vc.length), `avg ${sgnPct(vc.reduce((a, x) => a + x, 0) / vc.length)} vs close · ${vc.length} pick${vc.length > 1 ? "s" : ""}`]] : [];
    main.innerHTML = lede + `
    <div class="stats">${[["All picks", rate(R("ALL")), `${R("ALL").won}–${R("ALL").lost}`], ["Green picks", rate(R("GREEN")), `${R("GREEN").won}–${R("GREEN").lost} · tested 78%`], ...vcStat]
      .map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join("")}</div>
    <div class="panel"><h2>By light</h2><div class="tablewrap"><table><thead><tr><th>Light</th><th class="n">Picks</th><th class="n">Won</th><th class="n">Rate</th></tr></thead><tbody>
      ${["GREEN", "ORANGE", "RED"].map((l) => `<tr><td>${chip(l)}</td><td class="n">${R(l).won + R(l).lost}</td><td class="n">${R(l).won}</td><td class="n">${rate(R(l))}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="panel"><h2>Latest results</h2><p>The last 7 days. The full record keeps counting above.</p><div class="tablewrap"><table>
      <thead><tr><th>Match</th><th>Pick</th><th class="n">Chance</th><th>Light</th><th>Result</th><th class="n">vs close</th></tr></thead><tbody>
      ${done.slice(0, 150).map((m) => `<tr><td style="white-space:normal;min-width:170px">${esc(m.player_a)} v ${esc(m.player_b)}<br><small style="color:var(--muted)">${esc(m.tournament)} · ${esc(m.round)} · ${fmtShort.format(new Date(m.start_utc))}</small></td>
        <td style="white-space:normal">${esc(m.pick_name)}</td><td class="n">${P1(m.pick_pct)}</td><td>${chip(m.light)}</td><td><span class="wl ${m.right ? "W" : "L"}">${m.right ? "✓" : "✕"}</span> <small>${esc(m.score ?? "")}${m.retired ? " ret." : ""}</small></td>
        <td class="n">${m.vs_close != null ? `<b class="${m.vs_close > 0 ? "clv-pos" : "clv-neg"}">${sgnPct(m.vs_close)}</b><br><small style="color:var(--muted)">$${m.posted_price.toFixed(2)}</small>` : "–"}</td></tr>`).join("")}
      </tbody></table></div>
      ${vc.length ? `<p class="note"><b>Price</b> is the best Australian bookmaker price for our pick at our last price check before the first serve (by 7am Sydney time on match day, and at least an hour before). <b>vs close</b> compares it with the fair closing price, with the bookmaker's margin removed. Above zero means the price you could get beat the market's final view, the best long-run sign of an edge. Only bigger tournaments have Australian prices, so smaller events show a dash.</p>` : ""}</div>`;
  }
  // ---------- stats (backtest) ----------
  function btPanel() {
    const bt = H.bt; if (!bt) return "";
    const r = (a, l, n) => (a.lights[l][0] ? `${pct(a.lights[l][1] / a.lights[l][0])}${n ? ` <small>(${a.lights[l][0].toLocaleString()})</small>` : ""}` : "–");
    return `<div class="panel"><h2>Past-season testing</h2>
      <p><b>This is a re-run on past matches, not the live record.</b> Ratings were built match by match from earlier results only, and the model's final step was fitted on 2009–2020, so it never saw these matches. ${bt.all.n.toLocaleString()} ATP and WTA main-draw matches, 2021–2026.</p>
      <div class="tablewrap"><table><thead><tr><th>Season</th><th class="n">Right</th><th class="n">Green</th><th class="n">Orange</th><th class="n">Red</th></tr></thead><tbody>
      ${Object.entries(bt.seasons).map(([y, a]) => `<tr><td>${y}${y === "2026" ? " (to Nov)" : ""}</td><td class="n"><b>${pct(a.c / a.n)}</b></td><td class="n">${r(a, "GREEN")}</td><td class="n">${r(a, "ORANGE")}</td><td class="n">${r(a, "RED")}</td></tr>`).join("")}
      <tr><td><b>All</b></td><td class="n"><b>${pct(bt.all.c / bt.all.n)}</b></td><td class="n">${r(bt.all, "GREEN", 1)}</td><td class="n">${r(bt.all, "ORANGE", 1)}</td><td class="n">${r(bt.all, "RED", 1)}</td></tr>
      </tbody></table></div>
      <p>"Right" is how often the pick won. Light columns show how often picks with that light were right, with the number of matches in brackets on the All row. In tennis the favourite wins about two matches in three, so a red light really does mean a close match.</p>
      ${bt.ao2026 ? `<p>Australian Open 2026 replay: ${bt.ao2026.c} of ${bt.ao2026.n} picks right; green picks ${bt.ao2026.lights.GREEN[1]} of ${bt.ao2026.lights.GREEN[0]}.</p>` : ""}</div>`;
  }
  function stats() {
    document.getElementById("main").innerHTML = `<div><h2>Stats</h2></div>` + (btPanel() || `<div class="panel"><p>Coming soon.</p></div>`) + `
    <div class="panel"><h2>How the tennis model works</h2>
      <p>Every player has a rating that moves after each match: overall and on each surface (hard, clay, grass), built from more than 100,000 ATP and WTA results since 2005. Beating a strong player moves it more than beating a weak one; a retirement counts for half.</p>
      <p>The win chance blends the two players' overall and surface ratings, their ranking and ranking points, how many matches they've played, and whether it's best of five. Picks refresh until the first serve.</p></div>`;
  }
  // ---------- sidebar ----------
  function side() {
    const el = document.getElementById("side"), bt = H.bt;
    const today = keyOf(Date.now()), td = H.all.filter((m) => m.key === today), d = td.filter((m) => m.right != null), w = d.filter((m) => m.right).length;
    const byL = (l) => { const x = d.filter((m) => m.light === l); return `${x.filter((m) => m.right).length} of ${x.length}`; };
    const up = H.all.filter((m) => m.status === "pre").sort((a, b) => b.pick_pct - a.pick_pct).slice(0, 5);
    const L = (l) => (bt ? pct(bt.all.lights[l][1] / bt.all.lights[l][0]) : "–");
    el.innerHTML = `
    ${td.length ? `<div class="mini"><h3>Today so far</h3><div class="tn-big">${d.length ? `${w} of ${d.length}` : "–"}</div>
      <div class="row"><span class="t">${d.length ? `Picks right. <b style="color:var(--green)">Green ${byL("GREEN")}</b>, orange ${byL("ORANGE")}, red ${byL("RED")}.` : `${td.length} match${td.length === 1 ? "" : "es"} today, none finished yet.`}</span></div></div>` : ""}
    ${up.length ? `<div class="mini"><h3>Top picks coming up</h3>${up.map((m) => `<div class="row"><span class="t">${esc(m.pick_name)} <small style="color:var(--muted)">v ${esc(m.pick === "a" ? m.player_b : m.player_a)}</small></span><span class="n" style="color:${LC[m.light]};font-weight:700">${P1(m.pick_pct)}</span><span class="n" style="min-width:38px;text-align:right">${(100 / m.pick_pct).toFixed(2)}</span></div>`).join("")}</div>` : ""}
    <div class="mini"><h3>How our tennis picks have done</h3>
      <div class="row"><span class="t" style="color:var(--muted)">Tested on ${bt ? bt.all.n.toLocaleString() : "30,000+"} ATP and WTA matches, 2021–2026.</span></div>
      <div class="row"><span class="t">${chip("GREEN")} 70%+</span><span class="n"><b>${L("GREEN")}</b></span></div>
      <div class="row"><span class="t">${chip("ORANGE")} 60–70%</span><span class="n"><b>${L("ORANGE")}</b></span></div>
      <div class="row"><span class="t">${chip("RED")} under 60%</span><span class="n"><b>${L("RED")}</b></span></div>
      <div class="row" style="border-top:1px solid var(--line);padding-top:8px"><span class="t">All picks</span><span class="n"><b>${bt ? pct(bt.all.c / bt.all.n) : "–"}</b></span></div>
      ${H.feed?.record?.ALL && H.feed.record.ALL.won + H.feed.record.ALL.lost ? `<div class="row"><span class="t">Live since 7 Nov</span><span class="n">${H.feed.record.ALL.won}–${H.feed.record.ALL.lost}</span></div>` : ""}
      <a class="back" href="#tennis-record">Our record →</a></div>`;
  }
  // ---------- styles ----------
  const css = document.createElement("style");
  css.textContent = `
  .tn-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
  .tn-pick { position: relative; }
  .tn-pickbtn { display: flex; align-items: center; gap: 10px; font: 600 18px var(--f-display); background: var(--surface); color: var(--ink); border: 1px solid var(--line-hi); padding: 8px 14px; min-height: 44px; cursor: pointer; text-align: left; }
  .tn-pickbtn[aria-expanded="true"] { border-color: var(--cyan); }
  .tn-pickbtn svg { color: var(--muted); flex: none; }
  .tn-live { display: inline-flex; align-items: center; gap: 6px; font: 700 11px var(--f-mono); letter-spacing: 0.1em; color: var(--win); border: 1px solid var(--win); padding: 1px 7px; flex: none; }
  .tn-live i { width: 6px; height: 6px; border-radius: 50%; background: var(--win); box-shadow: 0 0 6px var(--win); display: inline-block; }
  .tn-list { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; width: 460px; max-width: calc(100vw - 32px); max-height: min(560px, 70vh); overflow-y: auto; background: var(--surface); border: 1px solid var(--line-hi); box-shadow: 0 24px 50px rgba(0,0,0,.6); padding: 8px 0; }
  .tn-grp { font: 11px var(--f-mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); padding: 10px 16px 4px; }
  .tn-opt { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 0 16px; border: 0; background: transparent; color: #d6dbee; font: 15px var(--f-body); cursor: pointer; text-align: left; }
  .tn-opt:hover, .tn-opt:focus-visible { background: var(--surface-2); }
  .tn-opt[aria-selected="true"] { background: var(--cyan-soft); color: var(--ink); }
  .tn-opt .nm { flex: 1; min-width: 0; }
  .tn-opt .when { flex: none; font: 11px var(--f-mono); letter-spacing: 0.04em; color: var(--muted); }
  .tn-foot { margin: 6px 0 0; padding: 10px 16px 4px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
  .tn-day { display: flex; align-items: center; gap: 6px; margin-left: auto; }
  .tn-day button { width: 44px; height: 44px; background: var(--surface); color: var(--cyan); border: 1px solid var(--line-hi); font: 700 18px var(--f-mono); cursor: pointer; }
  .tn-day button:disabled { color: var(--line-hi); cursor: default; }
  .tn-day .lbl { font: 14px var(--f-mono); padding: 0 10px; text-align: center; line-height: 1.3; }
  .tn-day .lbl span { color: var(--muted); font-size: 12px; }
  .tn-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; }
  .tn-seg { display: flex; border: 1px solid var(--line-hi); }
  .tn-seg button { font: 12px var(--f-mono); letter-spacing: 0.08em; padding: 0 14px; min-height: 44px; border: 0; cursor: pointer; background: var(--surface); color: #b8bfd8; }
  .tn-seg button[aria-pressed="true"] { background: var(--cyan); color: var(--bg); font-weight: 700; }
  .tn-btn { font: 12px var(--f-mono); letter-spacing: 0.06em; padding: 0 14px; min-height: 44px; background: var(--surface); color: #b8bfd8; border: 1px solid var(--line-hi); cursor: pointer; }
  .tn-btn.on { border-color: var(--green); background: var(--green-soft); color: var(--green); }
  .tn-q { display: flex; align-items: center; gap: 8px; flex: 1 1 200px; min-height: 44px; background: var(--surface); border: 1px solid var(--line-hi); padding: 0 12px; color: var(--muted); }
  .tn-q input { flex: 1; min-width: 0; background: transparent; border: 0; color: var(--ink); font-size: 15px; outline: none; }
  .tn-q:focus-within { border-color: var(--cyan); }
  .tn-q .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .tn-grpbox { background: rgba(16, 19, 31, 0.9); border: 1px solid var(--line); }
  .tn-gh { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
  .tn-gh h2 { font: 600 18px var(--f-display); margin: 0; }
  .tn-gh span { font: 12px var(--f-mono); color: var(--muted); }
  .tn-empty { margin: 0; padding: 16px; color: var(--muted); }
  .tn-row { display: grid; grid-template-columns: minmax(0, 1fr) 140px; gap: 6px 16px; align-items: center; padding: 10px 16px; border-bottom: 1px solid #1b2136; }
  .tn-row:last-child { border-bottom: 0; }
  .tn-pls { display: grid; gap: 4px; min-width: 0; }
  .tn-pl { display: grid; grid-template-columns: minmax(0, 1fr) 58px; align-items: center; gap: 10px; }
  .tn-pl .nm { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--muted); }
  .tn-pl .nm.on { font-weight: 600; color: var(--ink); }
  .tn-pl .nm .w { color: var(--win); font-size: 11px; }
  .tn-pl .pc { font-family: var(--f-mono); text-align: right; font-variant-numeric: tabular-nums; font-size: 14px; color: var(--muted); }
  .tn-pl .pc.on { font-size: 17px; font-weight: 700; }
  .tn-bar { display: flex; height: 4px; background: #1b2136; gap: 2px; margin-top: 2px; }
  .tn-bar i { display: block; }
  .tn-r { display: grid; justify-items: end; gap: 6px; }
  .tn-st { font: 12px var(--f-mono); color: #b8bfd8; white-space: nowrap; }
  .tn-st .pos { color: var(--win); } .tn-st .neg { color: #ff6b85; } .tn-on { color: var(--win); }
  .tn-fair { font: 12px var(--f-mono); color: var(--muted); white-space: nowrap; } .tn-fair b { color: var(--ink); font-size: 13px; }
  .tn-big { font: 700 30px var(--f-mono); line-height: 1.1; }
  @media (max-width: 640px) { .tn-day { margin-left: 0; width: 100%; justify-content: space-between; } .tn-row { grid-template-columns: minmax(0, 1fr) 96px; gap: 6px 10px; padding: 10px 12px; } .tn-pl { grid-template-columns: minmax(0, 1fr) 46px; gap: 6px; } .tn-pickbtn { font-size: 16px; } }`;
  document.head.appendChild(css);

  // ---------- routing (takes over the app router on this page only) ----------
  const SUBS = { predictions, record, stats };
  const TABS = [["predictions", "Predictions"], ["record", "Our record"], ["stats", "Stats"]];
  const LEDE = "Every ATP and WTA main-draw match gets a win chance for each player from our own rating model, built from results, surface and match length. Picks refresh until the first serve, then they're frozen. Every result stays on the record.";
  function troute() {
    const h = location.hash.slice(1);
    if (/^(nba|nfl)-|^about$|^home$/.test(h)) { location.href = "/#" + h; return; }
    const sub = h.startsWith("tennis-") && SUBS[h.slice(7)] ? h.slice(7) : "predictions";
    ["home", "sport", "game", "about"].forEach((k) => (document.getElementById("view-" + k).hidden = k !== "sport"));
    document.getElementById("sportBar").hidden = false;
    document.querySelectorAll("#sportBar [data-sport]").forEach((a) => a.classList.toggle("on", a.dataset.sport === "tennis"));
    window.PL_moreSportsMark?.("tennis");
    document.querySelectorAll("nav.tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.top === "sport" ? "page" : "false"));
    document.getElementById("spEyebrow").textContent = "Tennis · win predictions";
    document.getElementById("spLede").textContent = LEDE;
    const st = document.getElementById("subtabs"); st.setAttribute("aria-label", "Tennis sections");
    st.innerHTML = TABS.map(([k, l]) => `<a href="#tennis-${k}" aria-current="${k === sub ? "page" : "false"}">${l}</a>`).join("");
    document.title = "Tennis Predictions | ProbaLab";
    if (!H.ready) { document.getElementById("main").innerHTML = `<div class="panel"><h2>Loading predictions</h2></div>`; document.getElementById("side").innerHTML = ""; return; }
    SUBS[sub](); side();
  }
  route = troute; // eslint-disable-line no-global-assign
  window.addEventListener("hashchange", troute);
  const repaint = () => { predictions(); side(); };
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("#tnPickBtn")) { e.stopPropagation(); S.open = !S.open; predictions(); document.getElementById("tnPickBtn")?.focus(); return; }
    const o = t.closest("[data-tsel]");
    if (o) { e.stopPropagation(); S.sel = o.dataset.tsel; S.open = false; pickDay(); repaint(); document.getElementById("tnPickBtn")?.focus(); return; }
    if (S.open && !t.closest(".tn-list")) { S.open = false; predictions(); }
    const dd = t.closest("[data-tday]");
    if (dd) { e.stopPropagation(); const ks = daysOf(inSel()), i = ks.indexOf(S.day) + Number(dd.dataset.tday); if (ks[i]) { S.day = ks[i]; repaint(); } return; }
    const tt = t.closest("[data-ttour]"); if (tt) { e.stopPropagation(); S.tour = tt.dataset.ttour; predictions(); return; }
    const tlb = t.closest("[data-t-light]"); if (tlb) { e.stopPropagation(); S.light = tlb.dataset.tLight; const u = new URL(location.href); if (S.light === "green") u.searchParams.delete("light"); else u.searchParams.set("light", S.light); history.replaceState(null, "", u.pathname + u.search + u.hash); predictions(); return; }
    if (t.closest("#tnSort")) { e.stopPropagation(); S.sort = S.sort === "conf" ? "time" : "conf"; predictions(); }
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.open) { S.open = false; predictions(); document.getElementById("tnPickBtn")?.focus(); } });
  document.addEventListener("input", (e) => {
    if (e.target.id !== "tnQ") return;
    S.q = e.target.value; const pos = e.target.selectionStart; predictions();
    const n = document.getElementById("tnQ"); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
  });
  load().then(troute); troute();
})();
