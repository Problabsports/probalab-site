/* Private tips desk client. Units only. Logged-out users go to /members. */
(function () {
  const SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
  const M = window.TipsModel;
  const selectedColours = new Set(M.colours);
  const summarySports = new Set(["NBA", "NFL", "NHL", "EPL"]);
  function resolveTipster() {
    const root = document.querySelector(".tips-app[data-tipster]");
    if (root && root.dataset.tipster) return String(root.dataset.tipster).toLowerCase();
    const m = location.pathname.match(/\/members\/tips\/([^\/?#]+)/);
    if (m) return String(m[1]).toLowerCase();
    const q = new URLSearchParams(location.search).get("tipster");
    return String(q || "john").toLowerCase();
  }
  const tipsterId = (function (t) { return t === "sniper" || t === "probalab" ? t : "john"; })(resolveTipster());
  const compareToPl = tipsterId === "john";
  const tipster = M.tipsterMeta(tipsterId);
  let sb, data = null, tipsterData = null, tab = "today";
  const $ = (id) => document.getElementById(id);
  const fmtPct = (x) => (M.number(x) == null ? "—" : (Number(x) * 100).toFixed(1).replace(/\.0$/, "") + "%");
  const fmtOdds = (x) => (M.number(x) == null ? "—" : '<span class="odds" data-dec="' + Number(x) + '">' + Number(x).toFixed(2) + "</span>");
  const fmtU = (x) => {
    if (M.number(x) == null) return "—";
    const n = Number(x);
    return (n > 0 ? "+" : "") + n.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") + "u";
  };
  const clsU = (x) => (x == null ? "" : Number(x) > 0 ? "pos" : Number(x) < 0 ? "neg" : "");
  const chip = (l) => (l ? '<span class="chip ' + esc(l) + '">' + esc(l === "UNRATED" ? "Off-pick" : l) + "</span>" : "—");
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
    const why = f.includes("UNDER_MIN") ? "Taken at " + Number(r.price_taken).toFixed(2) + ", below the minimum " + Number(r.min_price).toFixed(2) + (r.win_pct ? " (fair price for " + fmtPct(r.win_pct) + " win chance)" : "") : "NBA rule: Green only, minimum price up to 1.49";
    return (no ? '<span class="badge break" title="' + esc(why) + '">NO · ' + (f.includes("UNDER_MIN") ? "below min" : "rule") + '</span>' : yes ? '<span class="badge ok">QUALIFIES</span>' : "") + " " + (r.result === "open" || r.result == null ? warnTag(r) : "");
  }
  async function loadInjuries() {
    for (const sp of ["nba", "nfl"]) {
      try { const f = await (await fetch("/api/feed?sport=" + sp)).json(); (f.games || []).forEach((g) => { feedById[String(g.game_id)] = g; }); } catch (_) {}
    }
  }
  const sports = ["NBA", "NFL", "NHL", "EPL"];
  const CODES = {"Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN", "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE", "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET", "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND", "LA Clippers": "LAC", "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL", "Memphis Grizzlies": "MEM", "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN", "New Orleans Pelicans": "NOP", "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX", "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS", "Toronto Raptors": "TOR", "Utah Jazz": "UTA", "Washington Wizards": "WAS", "Anaheim Ducks": "ANA", "Boston Bruins": "BOS", "Buffalo Sabres": "BUF", "Calgary Flames": "CGY", "Carolina Hurricanes": "CAR", "Chicago Blackhawks": "CHI", "Colorado Avalanche": "COL", "Columbus Blue Jackets": "CBJ", "Dallas Stars": "DAL", "Detroit Red Wings": "DET", "Edmonton Oilers": "EDM", "Florida Panthers": "FLA", "Los Angeles Kings": "LAK", "Minnesota Wild": "MIN", "Montreal Canadiens": "MTL", "Montr\u00e9al Canadiens": "MTL", "Nashville Predators": "NSH", "New Jersey Devils": "NJD", "New York Islanders": "NYI", "New York Rangers": "NYR", "Ottawa Senators": "OTT", "Philadelphia Flyers": "PHI", "Pittsburgh Penguins": "PIT", "San Jose Sharks": "SJS", "Seattle Kraken": "SEA", "St. Louis Blues": "STL", "St Louis Blues": "STL", "Tampa Bay Lightning": "TBL", "Toronto Maple Leafs": "TOR", "Utah Mammoth": "UTA", "Utah Hockey Club": "UTA", "Vancouver Canucks": "VAN", "Vegas Golden Knights": "VGK", "Washington Capitals": "WSH", "Winnipeg Jets": "WPG"};
  const short = (x) => String(x || "").split(" @ ").map((t) => CODES[t.trim()] || t.trim()).join(" @ ");
  const shortSel = (x) => CODES[String(x || "").trim()] || x;
  const dateTime = (v) => v && !Number.isNaN(new Date(v).getTime()) ? new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Sydney', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', timeZoneName:'short'}).format(new Date(v)) : "—";
  function colourControls() {
    $("colourFilters").innerHTML = M.colours.map(c => '<button type="button" class="chip '+c+'" aria-pressed="'+selectedColours.has(c)+'" data-colour="'+c+'">'+(c==='UNRATED'?'Off-pick':c)+'</button>').join('');
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
    return rows.filter(r => M.visibleFor(tipsterId, r) && selectedColours.has(M.colour(r)) && inRange(r)
      && (summary ? summarySports.has(r.sport) : !$("fSport").value || r.sport===$("fSport").value));
  }
  function statsHtml(title, rows) {
    const st=M.stats(rows);
    return '<div class="stat-card"><h3>'+esc(title)+'</h3><dl class="stat-grid">'
      +'<div><dt>Settled</dt><dd>'+st.bets+'</dd></div><div><dt>W–L</dt><dd>'+st.wins+'–'+st.losses+'</dd></div>'
      +'<div><dt>Win %</dt><dd>'+fmtPct(st.win_pct)+'</dd></div><div><dt>Net units</dt><dd class="'+clsU(st.units)+'">'+fmtU(st.units)+'</dd></div>'
      +'<div><dt>ROI</dt><dd>'+fmtPct(st.roi)+'</dd></div></dl><p class="note">Units/ROI coverage: '+st.covered+'/'+st.bets+' settled.</p></div>';
  }
  function chartHtml(john, pl, withPl) {
    const a=M.series(john), b=withPl?M.series(pl):[], dates=[...new Set([...a,...b].map(p=>p.date))].sort();
    if(!dates.length) return '<p class="muted">No dated, unit-covered results for this selection yet.</p>';
    const W=800,H=380,L=58,R=withPl?118:78,T=18,B=44;
    const start=Date.parse(dates[0]), end=Date.parse(dates[dates.length-1]);
    const vals=[0,...a.map(p=>p.units),...b.map(p=>p.units)];
    const span=Math.max(1,Math.max(...vals)-Math.min(...vals));
    const step=[1,2,5,10,20,50].find(st=>span/st<=8)||100;
    const low=Math.floor(Math.min(...vals)/step)*step, high=Math.ceil(Math.max(...vals)/step)*step||step;
    const x=d=>L+(Date.parse(d)-start)/Math.max(86400000,end-start)*(W-L-R);
    const y=v=>T+(high-v)/Math.max(step,high-low)*(H-T-B);
    const dfmt=d=>new Intl.DateTimeFormat('en-AU',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));
    const fu=v=>(v>0?'+':'')+(Math.round(v*100)/100)+'u';
    let g='';
    for(let v=low; v<=high+1e-9; v+=step){
      const zero=Math.abs(v)<1e-9;
      g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="'+(zero?'#8a96ab':'rgba(138,150,171,.18)')+'"'+(zero?' stroke-width="1.5"':'')+'/>'
        +'<text x="'+(L-8)+'" y="'+(y(v)+4)+'" text-anchor="end"'+(zero?' font-weight="700"':'')+'>'+(zero?'0u':fu(v))+'</text>';
    }
    const n=dates.length, every=Math.max(1,Math.ceil(n/(window.innerWidth<600?4:8)));
    dates.forEach((d,i)=>{ if(i%every===0||i===n-1) g+='<text x="'+x(d)+'" y="'+(H-B+20)+'" text-anchor="middle">'+dfmt(d)+'</text>'; });
    const line=(pts,c)=>{ if(!pts.length) return ''; let p='M '+x(dates[0])+' '+y(0); pts.forEach(q=>{p+=' L '+x(q.date)+' '+y(q.units);}); return '<path d="'+p+'" fill="none" stroke="'+c+'" stroke-width="3" stroke-linejoin="round"/>'; };
    const endLab=(pts,c,lab)=>{ if(!pts.length) return ''; const q=pts[pts.length-1]; return '<circle cx="'+x(q.date)+'" cy="'+y(q.units)+'" r="4.5" fill="'+c+'"/><text x="'+(x(q.date)+8)+'" y="'+(y(q.units)+4)+'" fill="'+c+'" style="fill:'+c+'" font-weight="700">'+lab+' '+fu(q.units)+'</text>'; };
    // avoid overlapping end labels when both series are drawn
    let la=a.length?y(a[a.length-1].units):0, lb=b.length?y(b[b.length-1].units):0;
    const at=(pts)=>{const m={};let v=0;pts.forEach(q=>m[q.date]=q.units);return dates.map(d=>(v=(d in m?m[d]:v)));};
    const ca=at(a), cb=at(b);
    const data=JSON.stringify(withPl
      ? dates.map((d,i)=>[x(d),dfmt(d),a.length?fu(ca[i]):'—',b.length?fu(cb[i]):'—'])
      : dates.map((d,i)=>[x(d),dfmt(d),a.length?fu(ca[i]):'—']));
    let lbB=withPl?endLab(b,'#39d98a','PL'):'';
    if(withPl&&a.length&&b.length&&Math.abs(la-lb)<16){ const sh=la<lb?16:-16; lbB=lbB.replace(/ y="([\d.]+)" fill/,(m0,v)=>' y="'+(Number(v)+sh)+'" fill'); }
    const aria=withPl?'Cumulative net units: Tips and PL site picks':'Cumulative net units: Tips growth';
    const legend=withPl
      ? '<p class="note"><span style="color:#63b3ff">● '+(tipster.shortLabel||'Tips')+(!a.length?' (no unit data)':'')+'</span> · <span style="color:#39d98a">● PL site picks'+(!b.length?' (no unit data)':'')+'</span></p>'
      : '<p class="note"><span style="color:#63b3ff">● '+(tipster.shortLabel||'Tips')+(!a.length?' (no unit data)':'')+'</span></p>';
    return '<div class="chart-wrap" data-pts=\''+esc(data)+'\'><svg class="units-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+aria+'">'
      +g+(withPl?line(b,'#39d98a'):'')+line(a,'#63b3ff')+endLab(a,'#63b3ff','Tips')+lbB
      +'<line class="hov" x1="0" x2="0" y1="'+T+'" y2="'+(H-B)+'" stroke="#c9d3e6" stroke-dasharray="3 3" visibility="hidden"/>'
      +'<rect x="'+L+'" y="'+T+'" width="'+(W-L-R)+'" height="'+(H-T-B)+'" fill="transparent" class="hit"/></svg>'
      +'<div class="chart-tip" hidden></div></div>'
      +legend;
  }
  function wireChart() {
    const w=document.querySelector('#summary .chart-wrap'); if(!w) return;
    const pts=JSON.parse(w.dataset.pts), svg=w.querySelector('svg'), tip=w.querySelector('.chart-tip'), hov=svg.querySelector('.hov');
    const move=(ev)=>{
      const e=ev.touches?ev.touches[0]:ev, r=svg.getBoundingClientRect(), vx=(e.clientX-r.left)/r.width*800;
      let best=pts[0]; pts.forEach(p=>{ if(Math.abs(p[0]-vx)<Math.abs(best[0]-vx)) best=p; });
      hov.setAttribute('x1',best[0]); hov.setAttribute('x2',best[0]); hov.setAttribute('visibility','visible');
      tip.hidden=false;
      tip.innerHTML=best.length>3
        ? '<b>'+esc(best[1])+'</b><br><span style="color:#63b3ff">Tips '+esc(best[2])+'</span><br><span style="color:#39d98a">PL '+esc(best[3])+'</span>'
        : '<b>'+esc(best[1])+'</b><br><span style="color:#63b3ff">Tips '+esc(best[2])+'</span>';
      const left=best[0]/800*r.width; tip.style.left=Math.min(Math.max(0,left-60),r.width-130)+'px';
    };
    svg.addEventListener('mousemove',move); svg.addEventListener('touchstart',move,{passive:true}); svg.addEventListener('touchmove',move,{passive:true});
    svg.addEventListener('mouseleave',()=>{tip.hidden=true;hov.setAttribute('visibility','hidden');});
  }
  function renderSummary() {
    const withPl = compareToPl;
    const mine=filtered((tipsterData && tipsterData.results) || [],true), pl=withPl?filtered(data.pl_results || [],true):[];
    const tipLabel = tipster.shortLabel || 'Tips';
    const controls='<div class="summary-sports" role="group" aria-label="Summary sports"><button type="button" data-summary-sport="all" aria-pressed="'+(summarySports.size===4)+'">All sports</button>'
      +sports.map(sp=>'<button type="button" data-summary-sport="'+sp+'" aria-pressed="'+summarySports.has(sp)+'">'+sp+'</button>').join('')+'</div>';
    const note=withPl
      ? '<p class="note"><b>'+esc(tipster.countNote)+'</b> Sport buttons apply to both records and the chart. Colour and date filters above apply to both. The sport dropdown is for the other tabs.</p>'
      : '<p class="note"><b>'+esc(tipster.countNote)+'</b> Sport buttons apply to this tipster\'s record and the chart. Colour and date filters above apply too. The sport dropdown is for the other tabs.</p>';
    const cards=withPl
      ? '<div class="cards cols-2">'+statsHtml(tipLabel+' settled',mine)+statsHtml('PL site picks',pl)+'</div>'
      : '<div class="cards">'+statsHtml(tipLabel+' settled',mine)+'</div>';
    let comparison='';
    if(withPl){
      const rows=M.colours.filter(c=>selectedColours.has(c)&&(c!=='UNRATED'||mine.concat(pl).some(r=>M.colour(r)==='UNRATED'))).map(c=>{
        const a=M.stats(mine.filter(r=>M.colour(r)===c)), b=M.stats(pl.filter(r=>M.colour(r)===c));
        const cells=st=>'<td>'+st.bets+'</td><td>'+fmtPct(st.win_pct)+'</td><td>'+fmtU(st.units)+'</td><td>'+fmtPct(st.roi)+'</td><td>'+st.covered+'/'+st.bets+'</td>';
        return '<tr><th scope="row">'+chip(c)+'</th>'+cells(a)+cells(b)+'</tr>';
      }).join('');
      comparison='<section class="panel"><h3>Same-colour comparison</h3><div class="table-wrap"><table class="tips"><thead><tr><th rowspan="2">Colour</th><th colspan="5">'+esc(tipLabel)+'</th><th colspan="5">All PL site picks</th></tr><tr>'
        +'<th>Count</th><th>Win %</th><th>Units</th><th>ROI</th><th>Coverage</th>'.repeat(2)+'</tr></thead><tbody>'+rows+'</tbody></table></div>'
        +'<p class="note">Win % excludes ties/voids. Tipster units use recorded stakes and net P/L (including commission where recorded; paper 1u when a Sniper tip was not taken). PL uses a hypothetical flat 1u stake at captured odds, before commission; missing prices are excluded from units/ROI, never treated as zero. Coverage shows results with known units. No fair-price odds are substituted.</p>'
        +'<p class="note">Dates are Australia/Sydney: settlement when available, otherwise game start (or placement as a last resort). The two records may cover different games and date ranges; this is not a matched-bet backtest. Bets with no PL pick on that side or market are Off-pick, never guessed. Captured PL history only; no pre-capture backtest.</p>'
        +(!Array.isArray(data.pl_results)?'<p class="msg">PL history has not been exported yet. Comparison unavailable until the next enriched snapshot.</p>':'')+'</section>';
    } else {
      comparison='<p class="note">Win % excludes ties/voids. Tipster units use recorded stakes and net P/L (including commission where recorded; paper 1u when a Sniper tip was not taken). Coverage shows results with known units. Dates are Australia/Sydney: settlement when available, otherwise game start (or placement as a last resort).</p>';
    }
    $("summary").innerHTML=controls+note+cards
      +'<section class="panel"><h3>Cumulative units</h3>'+chartHtml(mine,pl,withPl)+'</section>'
      +comparison;
    wireChart();
    document.querySelectorAll('[data-summary-sport]').forEach(b=>b.addEventListener('click',()=>{
      const sp=b.dataset.summarySport;
      if(sp==='all') { const all=summarySports.size===4; summarySports.clear(); if(!all) sports.forEach(s=>summarySports.add(s)); }
      else summarySports.has(sp)?summarySports.delete(sp):summarySports.add(sp);
      renderSummary();
    }));
  }
  function renderAttention() {
    if (tipsterId === 'sniper' || tipsterId === 'probalab') {
      $("attnPanel").classList.add("hidden");
      $("attention").innerHTML = '';
      return;
    }
    const hiddenIds=new Set([...(data.open_bets||[]),...(data.results||[])].filter(r=>String(r.tag).toUpperCase()==='CL').map(r=>r.bet_id));
    const items=(data.needs_attention||[]).filter(a=>!hiddenIds.has(a.bet_id) && String(a.tag||'').toUpperCase()!=='CL');
    const warnings=items.filter(a=>['warn','error'].includes(String(a.severity).toLowerCase()));
    const info=items.filter(a=>String(a.severity).toLowerCase()==='info');
    const item=a=>'<div class="attn '+esc(a.severity)+'"><b>'+esc(String(a.severity).toUpperCase())+'</b> '+esc(a.message)+(a.game?' <span class="muted">('+esc(a.sport||'')+' · '+esc(a.game)+')</span>':'')+'</div>';
    $("attnPanel").classList.toggle("hidden", !warnings.length);
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
    const now = Date.now();
    const rows = filtered(data.today || []).filter((p) => Date.parse(p.tipoff_utc) > now).sort((a, b) => Date.parse(a.tipoff_utc) - Date.parse(b.tipoff_utc));
    const by = {};
    rows.forEach((p) => { (by[p.sport] ??= []).push(p); });
    const order = ["NBA", "NFL", "NHL", "EPL"].filter((s) => by[s]);
    if (!order.length) { $("today").innerHTML = '<p class="muted">No upcoming picks.</p>'; return; }
    $("today").innerHTML = order.map((sport) => {
      const body = by[sport].map((p) => {
        const q = qualifies(p);
        const qBadge = q === true ? '<span class="badge ok">QUALIFIES</span>' : q === false ? '<span class="badge break" title="Price outside the rule: Green only, minimum price up to 1.49">NO</span>' : "";
        const taken = p.taken ? '<span class="badge taken">TAKEN</span>' : "";
        return "<tr><td>" + esc(dateTime(p.tipoff_utc)) + "</td>"
          + '<td class="game">' + esc(short(p.game)) + "</td>"
          + "<td>" + esc(shortSel(p.selection)) + "</td>"
          + "<td>" + chip(p.light) + "</td>"
          + "<td>" + fmtPct(p.win_pct) + "</td>"
          + "<td>" + fmtOdds(p.min_price) + "</td>"
          + "<td>" + fmtOdds(p.current_price) + "</td>"
          + "<td>" + qBadge + " " + taken + " " + warnTag(p) + "</td></tr>";
      }).join("");
      return '<div class="sport-block panel"><div class="oddsfmt-bar"><h3>' + esc(sport) + '</h3><button type="button" class="oddsfmt" aria-label="Odds format">DEC ⇄</button></div><div class="table-wrap"><table class="tips"><thead><tr>'
        + "<th>Tip-off</th><th>Game</th><th>Pick</th><th>Light</th><th>Win %</th><th>Min</th><th>Price</th><th>Flags</th>"
        + "</tr></thead><tbody>" + body + "</tbody></table></div></div>";
    }).join("");
  }
  function betFilter(rows) { return filtered(rows); }
  const shortDate = (v) => v && !Number.isNaN(new Date(v).getTime()) ? new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Sydney', day:'numeric', month:'short'}).format(new Date(v)) : "—";
  const gameCell = (r) => '<td class="game"><span class="sp">' + esc(r.sport || "") + '</span> ' + esc(short(r.game)) + "</td>";
  function renderOpen() {
    const rows = betFilter((tipsterData && tipsterData.open_bets) || []);
    if (!rows.length) { $("open").innerHTML = '<p class="muted">'+(tipsterId!=="john"?"No tips yet.":"No tips in this filter.")+'</p>'; return; }
    $("open").innerHTML = '<div class="oddsfmt-bar"><button type="button" class="oddsfmt" aria-label="Odds format">DEC ⇄</button></div><div class="table-wrap"><table class="tips compact"><thead><tr>'
      + "<th>Placed</th><th>Game day</th><th>Game</th><th>Pick</th><th>Light</th><th>Price</th><th>Units</th><th>Flags</th>"
      + "</tr></thead><tbody>"
      + rows.map((r) => "<tr><td>" + esc(shortDate(r.placed_utc)) + "</td><td>" + esc(shortDate(r.kickoff_utc)) + "</td>" + gameCell(r)
        + "<td>" + esc(shortSel(r.selection)) + "</td>"
        + "<td>" + chip(r.light) + "</td>"
        + "<td>" + fmtOdds(r.price_taken) + "</td>"
        + '<td class="u">' + fmtU(r.units) + "</td>"
        + '<td class="fl">' + betFlags(r) + "</td></tr>").join("")
      + "</tbody></table></div>";
  }
  function renderResults() {
    const rows = betFilter((tipsterData && tipsterData.results) || []).filter((r) => r.result === "W" || r.result === "L").sort((a, b) => String(b.placed_utc || "").localeCompare(String(a.placed_utc || "")));
    if (!rows.length) { $("results").innerHTML = '<p class="muted">No results in this filter.</p>'; return; }
    $("results").innerHTML = '<div class="oddsfmt-bar"><button type="button" class="oddsfmt" aria-label="Odds format">DEC ⇄</button></div><div class="table-wrap"><table class="tips compact"><thead><tr>'
      + "<th>Game day</th><th>Game</th><th>Pick</th><th>Light</th><th>Odds</th><th>Res</th><th>Stake</th><th>P/L</th><th class=\"opt\">CLV</th><th class=\"opt\">Flags</th>"
      + "</tr></thead><tbody>"
      + rows.map((r) => "<tr><td>" + esc(shortDate(r.kickoff_utc || r.placed_utc)) + "</td>" + gameCell(r)
        + "<td>" + esc(shortSel(r.selection)) + "</td>"
        + "<td>" + chip(r.light) + "</td>"
        + "<td>" + fmtOdds(r.price_taken) + "</td>"
        + "<td>" + esc(r.result) + "</td>"
        + '<td class="u">' + fmtU(r.units) + "</td>"
        + '<td class="u ' + clsU(M.pnl(r)) + '">' + fmtU(M.pnl(r)) + "</td>"
        + '<td class="opt">' + fmtPct(r.clv_pct) + "</td>"
        + '<td class="opt fl">' + betFlags(r) + "</td></tr>").join("")
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
    $("meta").textContent = "Updated " + gen + " · units only · " + tipster.name + " vs PL board";
    const pitch = $("deskPitch"); if (pitch) pitch.textContent = tipster.pitch + " · " + tipster.focus;
    const title = $("deskTitle"); if (title) title.textContent = tipster.name;
    const onote = $("openNote"); if (onote) onote.textContent = tipster.openNote;
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
  async function loadSniperBlock() {
    // Prefer isolated snapshot id=sniper (never John's open_bets/results).
    const { data: row } = await sb.from("tips_page_snapshot").select("payload").eq("id", "sniper").maybeSingle();
    if (row && row.payload) {
      const p = row.payload;
      if (Array.isArray(p.open_bets) || Array.isArray(p.results)) {
        return { open_bets: p.open_bets || [], results: p.results || [] };
      }
    }
    const block = (data.tipsters && data.tipsters.sniper) || {};
    return {
      open_bets: Array.isArray(block.open_bets) ? block.open_bets : [],
      results: Array.isArray(block.results) ? block.results : [],
    };
  }
  async function loadIsolatedBlock(id) {
    // Isolated snapshot only (never John's open_bets/results).
    const { data: row } = await sb.from("tips_page_snapshot").select("payload").eq("id", id).maybeSingle();
    const p = (row && row.payload) || {};
    return { open_bets: Array.isArray(p.open_bets) ? p.open_bets : [], results: Array.isArray(p.results) ? p.results : [] };
  }
  async function loadTips() {
    const { data: row, error } = await sb.from("tips_page_snapshot").select("payload, generated_at, updated_at").eq("id", "latest").maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("No tips snapshot yet");
    await loadInjuries();
    data = row.payload;
    if (row.generated_at && !data.generated_at) data.generated_at = row.generated_at;
    if (tipsterId === "sniper") {
      tipsterData = await loadSniperBlock();
    } else if (tipsterId === "probalab") {
      tipsterData = await loadIsolatedBlock("probalab");
    } else {
      tipsterData = {
        open_bets: data.open_bets || [],
        results: data.results || [],
      };
    }
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
