/* Private tips desk client. Units only. Logged-out users go to /members. */
(function () {
  const SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
  const M = window.TipsModel;
  const selectedColours = new Set(M.colours);
  const summarySports = new Set(["NBA", "NFL", "NHL", "EPL"]);
  let sb, data = null, tab = "today";
  const $ = (id) => document.getElementById(id);
  const fmtPct = (x) => (M.number(x) == null ? "—" : (Number(x) * 100).toFixed(1).replace(/\.0$/, "") + "%");
  const fmtOdds = (x) => (M.number(x) == null ? "—" : Number(x).toFixed(2));
  const fmtU = (x) => {
    if (M.number(x) == null) return "—";
    const n = Number(x);
    return (n > 0 ? "+" : "") + n.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") + "u";
  };
  const clsU = (x) => (x == null ? "" : Number(x) > 0 ? "pos" : Number(x) < 0 ? "neg" : "");
  const chip = (l) => (l ? '<span class="chip ' + esc(l) + '">' + esc(l) + "</span>" : "—");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dash = (v) => (v == null || v === "" ? "—" : esc(v));
  // Same rule as the live site's Important note (index.html hasNote/qbLine/nbaLine).
  const QB_OUT = /out|doubtful|injured reserve|suspend/i, QB_Q = /questionable/i, NBA_UNSURE = /questionable|doubtful/i;
  let feedById = {};
  function injuryText(sport, pickId) {
    const g = feedById[(String(pickId || "").match(/(\d+)$/) || [])[1]];
    const d = g && g.detail; if (!d || !g.pick || g.status === "post") return "";
    if (String(sport).toUpperCase() === "NFL") {
      return [[g.away, d.qb_away, d.qb_flag_away], [g.home, d.qb_home, d.qb_flag_home]].filter(([, q, f]) => f || QB_OUT.test((q && q.status) || "") || QB_Q.test((q && q.status) || ""))
        .map(([t, q, f]) => t + " QB " + ((q && q.name) || "unknown") + (q && q.status ? " (" + q.status + ")" : f ? " (starter flagged)" : "")).join("; ");
    }
    return [[g.away, d.missing_away], [g.home, d.missing_home]].flatMap(([t, xs]) => (xs || []).filter((m) => NBA_UNSURE.test(m.status || "") && Number(m.min || 0) >= 20)
      .map((m) => t + " " + m.player + " (" + m.status + ", " + Math.round(m.min) + " min)")).join("; ");
  }
  const warnTag = (r) => { const t = injuryText(r.sport, r.pick_id); return t ? '<span class="badge warn" title="' + esc(t) + '">⚠️ ' + esc(t) + "</span>" : ""; };
  function betFlags(r) {
    const f = r.rule_flags || [];
    const no = f.some((x) => /BREAK|UNDER_MIN/.test(x)), yes = f.includes("NBA_RULE_V2");
    return (no ? '<span class="badge break">NO</span>' : yes ? '<span class="badge ok">QUALIFIES</span>' : "") + " " + (r.result === "open" || r.result == null ? warnTag(r) : "");
  }
  async function loadInjuries() {
    for (const sp of ["nba", "nfl"]) {
      try { const f = await (await fetch("/api/feed?sport=" + sp)).json(); (f.games || []).forEach((g) => { feedById[String(g.game_id)] = g; }); } catch (_) {}
    }
  }
  const sports = ["NBA", "NFL", "NHL", "EPL"];
  const dateTime = (v) => v && !Number.isNaN(new Date(v).getTime()) ? new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Sydney', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', timeZoneName:'short'}).format(new Date(v)) : "—";
  function colourControls() {
    $("colourFilters").innerHTML = M.colours.map(c => '<button type="button" class="chip '+c+'" aria-pressed="'+selectedColours.has(c)+'" data-colour="'+c+'">'+(c==='UNRATED'?'Unrated':c)+'</button>').join('');
    document.querySelectorAll('[data-colour]').forEach(b => b.addEventListener('click', () => {
      const c=b.dataset.colour; selectedColours.has(c) ? selectedColours.delete(c) : selectedColours.add(c);
      colourControls(); renderAll();
    }));
  }
  function inRange(r) {
    const d=M.date(r), from=$("fFrom").value, to=$("fTo").value;
    return (!from || (d && d>=from)) && (!to || (d && d<=to));
  }
  function filtered(rows, summary=false) {
    return rows.filter(r => M.visible(r) && selectedColours.has(M.colour(r)) && inRange(r)
      && (summary ? summarySports.has(r.sport) : !$("fSport").value || r.sport===$("fSport").value));
  }
  function statsHtml(title, rows) {
    const st=M.stats(rows);
    return '<div class="stat-card"><h3>'+esc(title)+'</h3><dl class="stat-grid">'
      +'<div><dt>Settled</dt><dd>'+st.bets+'</dd></div><div><dt>W–L</dt><dd>'+st.wins+'–'+st.losses+'</dd></div>'
      +'<div><dt>Win %</dt><dd>'+fmtPct(st.win_pct)+'</dd></div><div><dt>Net units</dt><dd class="'+clsU(st.units)+'">'+fmtU(st.units)+'</dd></div>'
      +'<div><dt>ROI</dt><dd>'+fmtPct(st.roi)+'</dd></div></dl><p class="note">Units/ROI coverage: '+st.covered+'/'+st.bets+' settled.</p></div>';
  }
  function chartHtml(john, pl) {
    const a=M.series(john), b=M.series(pl), dates=[...new Set([...a,...b].map(p=>p.date))].sort();
    if(!dates.length) return '<p class="muted">No dated, unit-covered results for this selection yet.</p>';
    const start=Date.parse(dates[0]), end=Date.parse(dates[dates.length-1]);
    const values=[0,...a.map(p=>p.units),...b.map(p=>p.units)], low=Math.min(...values), high=Math.max(...values);
    const x=d=>62+(Date.parse(d)-start)/Math.max(86400000,end-start)*704;
    const y=v=>222-(v-low)/Math.max(1,high-low)*190;
    function line(points, colour, label) {
      if(!points.length) return '';
      let path='M '+x(dates[0])+' '+y(0);
      points.forEach(p=>{path+=' H '+x(p.date)+' V '+y(p.units);});
      path+=' H '+x(dates[dates.length-1]);
      return '<path d="'+path+'" fill="none" stroke="'+colour+'" stroke-width="3"><title>'+label+'</title></path><circle cx="'+x(points[points.length-1].date)+'" cy="'+y(points[points.length-1].units)+'" r="4" fill="'+colour+'"/>';
    }
    return '<svg class="units-chart" viewBox="0 0 800 270" role="img" aria-label="Cumulative net units: My bets and PL site picks"><title>Cumulative net units</title>'
      +'<line x1="62" y1="'+y(0)+'" x2="766" y2="'+y(0)+'" stroke="#69758a" stroke-dasharray="4 4"/>'
      +'<text x="4" y="32">'+esc(fmtU(high))+'</text><text x="4" y="224">'+esc(fmtU(low))+'</text>'
      +line(a,'#63b3ff','My bets')+line(b,'#39d98a','PL site picks')
      +'<text x="62" y="255">'+dates[0]+'</text><text x="766" y="255" text-anchor="end">'+dates[dates.length-1]+'</text></svg>'
      +'<p class="note"><span style="color:#63b3ff">● My bets'+(!a.length?' (no unit data)':'')+'</span> · <span style="color:#39d98a">● PL site picks'+(!b.length?' (no unit data)':'')+'</span></p>';
  }
  function renderSummary() {
    const john=filtered(data.results || [],true), pl=filtered(data.pl_results || [],true);
    const controls='<div class="summary-sports" role="group" aria-label="Summary sports"><button type="button" data-summary-sport="all" aria-pressed="'+(summarySports.size===4)+'">All sports</button>'
      +sports.map(sp=>'<button type="button" data-summary-sport="'+sp+'" aria-pressed="'+summarySports.has(sp)+'">'+sp+'</button>').join('')+'</div>';
    const rows=M.colours.filter(c=>selectedColours.has(c)).map(c=>{
      const a=M.stats(john.filter(r=>M.colour(r)===c)), b=M.stats(pl.filter(r=>M.colour(r)===c));
      const cells=st=>'<td>'+st.bets+'</td><td>'+fmtPct(st.win_pct)+'</td><td>'+fmtU(st.units)+'</td><td>'+fmtPct(st.roi)+'</td><td>'+st.covered+'/'+st.bets+'</td>';
      return '<tr><th scope="row">'+chip(c)+'</th>'+cells(a)+cells(b)+'</tr>';
    }).join('');
    $("summary").innerHTML=controls+'<p class="note">Sport buttons apply to both records and the chart. Colour and date filters above apply to both. The sport dropdown is for the other tabs.</p>'
      +'<div class="cards cols-2">'+statsHtml('My settled bets',john)+statsHtml('PL site picks',pl)+'</div>'
      +'<section class="panel"><h3>Cumulative units</h3>'+chartHtml(john,pl)+'</section>'
      +'<section class="panel"><h3>Same-colour comparison</h3><div class="table-wrap"><table class="tips"><thead><tr><th rowspan="2">Colour</th><th colspan="5">My settled bets</th><th colspan="5">All PL site picks</th></tr><tr>'
      +'<th>Count</th><th>Win %</th><th>Units</th><th>ROI</th><th>Coverage</th>'.repeat(2)+'</tr></thead><tbody>'+rows+'</tbody></table></div>'
      +'<p class="note">Win % excludes ties/voids. My bets use recorded stakes and net P/L (including commission where recorded). PL uses a hypothetical flat 1u stake at captured odds, before commission; missing prices are excluded from units/ROI, never treated as zero. Counts include all settled picks, not only picks I took. Coverage shows results with known units. No fair-price odds are substituted.</p>'
      +'<p class="note">Dates are Australia/Sydney: settlement when available, otherwise game start (or placement as a last resort). The two records may cover different games and date ranges; this is not a matched-bet backtest. Unknown-colour bets are Unrated, never guessed. Captured PL history only; no pre-capture backtest.</p>'
      +(!Array.isArray(data.pl_results)?'<p class="msg">PL history has not been exported yet. Comparison unavailable until the next enriched snapshot.</p>':'')+'</section>';
    document.querySelectorAll('[data-summary-sport]').forEach(b=>b.addEventListener('click',()=>{
      const sp=b.dataset.summarySport;
      if(sp==='all') { const all=summarySports.size===4; summarySports.clear(); if(!all) sports.forEach(s=>summarySports.add(s)); }
      else summarySports.has(sp)?summarySports.delete(sp):summarySports.add(sp);
      renderSummary();
    }));
  }
  function renderAttention() {
    const hiddenIds=new Set([...(data.open_bets||[]),...(data.results||[])].filter(r=>String(r.tag).toUpperCase()==='CL').map(r=>r.bet_id));
    const items=(data.needs_attention||[]).filter(a=>!hiddenIds.has(a.bet_id) && String(a.tag||'').toUpperCase()!=='CL');
    const warnings=items.filter(a=>['warn','error'].includes(String(a.severity).toLowerCase()));
    const info=items.filter(a=>String(a.severity).toLowerCase()==='info');
    const item=a=>'<div class="attn '+esc(a.severity)+'"><b>'+esc(String(a.severity).toUpperCase())+'</b> '+esc(a.message)+(a.game?' <span class="muted">('+esc(a.sport||'')+' · '+esc(a.game)+')</span>':'')+'</div>';
    $("attention").innerHTML=(warnings.length?warnings.map(item).join(''):'<p class="muted">No warnings.</p>')
      +(info.length?'<details><summary>'+info.length+' informational notes</summary>'+info.map(item).join('')+'</details>':'');
  }
  function qualifies(p) {
    if (typeof p.qualifies === "boolean") return p.qualifies;
    if (String(p.sport).toUpperCase() !== "NBA") return null;
    const lightOk = p.light === "GREEN";
    const price = p.current_price;
    if (!lightOk || price == null || p.min_price == null) return null;
    return price >= p.min_price && price <= 1.49;
  }
  function renderToday() {
    const rows = filtered(data.today || []);
    const by = {};
    rows.forEach((p) => { (by[p.sport] ??= []).push(p); });
    const order = ["NBA", "NFL", "NHL", "EPL"].filter((s) => by[s]);
    if (!order.length) { $("today").innerHTML = '<p class="muted">No captured picks for today.</p>'; return; }
    $("today").innerHTML = order.map((sport) => {
      const body = by[sport].map((p) => {
        const q = qualifies(p);
        const qBadge = q === true ? '<span class="badge ok">QUALIFIES</span>' : q === false ? '<span class="badge break">NO</span>' : "";
        const taken = p.taken ? '<span class="badge taken">TAKEN</span>' : "";
        return "<tr><td>" + esc(dateTime(p.tipoff_utc)) + "</td>"
          + '<td class="game">' + esc(p.game) + "</td>"
          + "<td>" + esc(p.selection) + "</td>"
          + "<td>" + chip(p.light) + "</td>"
          + "<td>" + fmtPct(p.win_pct) + "</td>"
          + "<td>" + fmtOdds(p.min_price) + "</td>"
          + "<td>" + fmtOdds(p.current_price) + "</td>"
          + "<td>" + qBadge + " " + taken + " " + warnTag(p) + "</td></tr>";
      }).join("");
      return '<div class="sport-block panel"><h3>' + esc(sport) + '</h3><div class="table-wrap"><table class="tips"><thead><tr>'
        + "<th>Tip-off</th><th>Game</th><th>Pick</th><th>Light</th><th>Win %</th><th>Min</th><th>Price</th><th>Flags</th>"
        + "</tr></thead><tbody>" + body + "</tbody></table></div></div>";
    }).join("");
  }
  function betFilter(rows) { return filtered(rows); }
  function renderOpen() {
    const rows = betFilter(data.open_bets || []);
    if (!rows.length) { $("open").innerHTML = '<p class="muted">No open bets in this filter.</p>'; return; }
    $("open").innerHTML = '<div class="table-wrap"><table class="tips"><thead><tr>'
      + "<th>Placed</th><th>Sport</th><th>Game</th><th>Pick</th><th>Record</th><th>Light</th><th>Price</th><th>Units</th><th>Flags</th>"
      + "</tr></thead><tbody>"
      + rows.map((r) => "<tr><td>" + esc(dateTime(r.placed_utc)) + "</td>"
        + "<td>" + esc(r.sport) + "</td>"
        + '<td class="game">' + esc(r.game) + "</td>"
        + "<td>" + esc(r.selection) + "</td>"
        + "<td>" + esc(r.tag === "OTHER" ? "My bet" : "PL") + "</td>"
        + "<td>" + chip(r.light) + "</td>"
        + "<td>" + fmtOdds(r.price_taken) + "</td>"
        + "<td>" + fmtU(r.units) + "</td>"
        + "<td>" + betFlags(r) + "</td></tr>").join("")
      + "</tbody></table></div>";
  }
  function renderResults() {
    const rows = betFilter(data.results || []);
    if (!rows.length) { $("results").innerHTML = '<p class="muted">No results in this filter.</p>'; return; }
    $("results").innerHTML = '<div class="table-wrap"><table class="tips"><thead><tr>'
      + "<th>Date</th><th>Sport</th><th>Game</th><th>Pick</th><th>Record</th><th>Light</th><th>Taken</th><th>Close</th><th>CLV</th><th>Result</th><th>Stake</th><th>P/L</th><th>Flags</th>"
      + "</tr></thead><tbody>"
      + rows.map((r) => "<tr><td>" + dash(M.date(r)) + "</td>"
        + "<td>" + esc(r.sport) + "</td>"
        + '<td class="game">' + esc(r.game) + "</td>"
        + "<td>" + esc(r.selection) + "</td>"
        + "<td>" + esc(r.tag === "OTHER" ? "My bet" : "PL") + "</td>"
        + "<td>" + chip(r.light) + "</td>"
        + "<td>" + fmtOdds(r.price_taken) + "</td>"
        + "<td>" + fmtOdds(r.closing_price) + "</td>"
        + "<td>" + fmtPct(r.clv_pct) + "</td>"
        + "<td>" + esc(r.result) + "</td>"
        + "<td>" + fmtU(r.units) + "</td>"
        + '<td class="' + clsU(M.pnl(r)) + '">' + fmtU(M.pnl(r)) + "</td>"
        + "<td>" + betFlags(r) + "</td></tr>").join("")
      + "</tbody></table></div>";
  }
  function showTab(name) {
    tab = name;
    ["today", "open", "results", "summary"].forEach((t) => {
      $(t + "Pane").classList.toggle("hidden", t !== name);
      const b = document.querySelector('[data-tab="' + t + '"]');
      if (b) b.classList.toggle("on", t === name);
    });
    $("filters").classList.remove("hidden");
    $("fSport").disabled = name === "summary";
  }
  function renderAll() {
    const gen = dateTime(data.generated_at);
    $("meta").textContent = "Updated " + gen + " · units only · PL picks and my bets";
    renderAttention();
    renderSummary();
    renderToday();
    renderOpen();
    renderResults();
  }
  async function ensureProfile(session) {
    const email = session.user.email;
    const { data: allow } = await sb.from("member_allowlist").select("role").ilike("email", email).maybeSingle();
    if (!allow) return false;
    await sb.from("member_profiles").upsert({ user_id: session.user.id, email, role: allow.role }, { onConflict: "user_id" });
    return true;
  }
  async function loadTips() {
    const { data: row, error } = await sb.from("tips_page_snapshot").select("payload, generated_at, updated_at").eq("id", "latest").maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("No tips snapshot yet");
    await loadInjuries();
    data = row.payload;
    if (row.generated_at && !data.generated_at) data.generated_at = row.generated_at;
    renderAll();
  }
  function setAuthed(on, email) {
    const boot = $("bootPane");
    if (boot) boot.classList.toggle("hidden", on);
    $("appPane").classList.toggle("hidden", !on);
    $("who").textContent = on ? ("Signed in as " + email) : "";
  }
  function hasAuthParams() {
    const h = location.hash || "";
    const q = location.search || "";
    return /access_token|refresh_token|type=magiclink|type=recovery|type=signup|code=/.test(h + q);
  }
  function goWaitlist() {
    if (hasAuthParams()) return;
    location.replace("/members");
  }
  async function boot() {
    sb = window.supabase.createClient(SB_URL, SB_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    $("signOut").addEventListener("click", async () => {
      await sb.auth.signOut();
      location.replace("/members");
    });
    document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
    ["fSport", "fFrom", "fTo"].forEach((id) => {
      $(id).addEventListener("change", () => {
        renderAttention(); renderSummary(); renderToday(); renderOpen(); renderResults();
      });
    });
    colourControls();
    showTab("today");

    let sawSession = false;
    sb.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
      if (!session) {
        setAuthed(false);
        setTimeout(() => { if (!sawSession) goWaitlist(); }, hasAuthParams() ? 2500 : 400);
        return;
      }
      sawSession = true;
      const ok = await ensureProfile(session);
      if (!ok) {
        await sb.auth.signOut();
        location.replace("/members?denied=1");
        return;
      }
      setAuthed(true, session.user.email);
      try { await loadTips(); $("loadMsg").textContent = ""; }
      catch (err) { $("loadMsg").textContent = "Could not load tips: " + (err.message || err); }
      }, 0);
    });
  }
  boot();
})();
