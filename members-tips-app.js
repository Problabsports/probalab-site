/* Private tips desk client. Units only. Logged-out users go to /members. */
(function () {
  const SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
  const M = window.TipsModel;
  const selectedColours = new Set(M.colours);
  const summarySports = new Set(["NBA", "NFL", "NHL", "EPL", "CHAMP", "TENNIS"]);
  // Sport codes in the snapshot -> label shown on the desk (CHAMP = EFL Championship, added 7 Nov 2026; TENNIS = ATP/WTA, added 10 Nov 2026)
  const SPORT_LABEL = { CHAMP: "Championship", TENNIS: "Tennis" };
  const sportLabel = (s) => SPORT_LABEL[String(s || "").toUpperCase()] || s || "";
  function resolveTipster() {
    const root = document.querySelector(".tips-app[data-tipster]");
    if (root && root.dataset.tipster) return String(root.dataset.tipster).toLowerCase();
    const m = location.pathname.match(/\/members\/tips\/([^\/?#]+)/);
    if (m) return String(m[1]).toLowerCase();
    const q = new URLSearchParams(location.search).get("tipster");
    return String(q || "john").toLowerCase();
  }
  const tipsterId = (function (t) { return (t === "sniper" || t === "probalab" || t === "nfl-weather" || t === "nba-price-gap" || t === "nhl-value") ? t : "john"; })(resolveTipster());
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
  const sports = ["NBA", "NFL", "NHL", "EPL", "CHAMP", "TENNIS"];
  const CODES = {"Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN", "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE", "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET", "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND", "LA Clippers": "LAC", "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL", "Memphis Grizzlies": "MEM", "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN", "New Orleans Pelicans": "NOP", "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX", "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS", "Toronto Raptors": "TOR", "Utah Jazz": "UTA", "Washington Wizards": "WAS", "Anaheim Ducks": "ANA", "Boston Bruins": "BOS", "Buffalo Sabres": "BUF", "Calgary Flames": "CGY", "Carolina Hurricanes": "CAR", "Chicago Blackhawks": "CHI", "Colorado Avalanche": "COL", "Columbus Blue Jackets": "CBJ", "Dallas Stars": "DAL", "Detroit Red Wings": "DET", "Edmonton Oilers": "EDM", "Florida Panthers": "FLA", "Los Angeles Kings": "LAK", "Minnesota Wild": "MIN", "Montreal Canadiens": "MTL", "Montr\u00e9al Canadiens": "MTL", "Nashville Predators": "NSH", "New Jersey Devils": "NJD", "New York Islanders": "NYI", "New York Rangers": "NYR", "Ottawa Senators": "OTT", "Philadelphia Flyers": "PHI", "Pittsburgh Penguins": "PIT", "San Jose Sharks": "SJS", "Seattle Kraken": "SEA", "St. Louis Blues": "STL", "St Louis Blues": "STL", "Tampa Bay Lightning": "TBL", "Toronto Maple Leafs": "TOR", "Utah Mammoth": "UTA", "Utah Hockey Club": "UTA", "Vancouver Canucks": "VAN", "Vegas Golden Knights": "VGK", "Washington Capitals": "WSH", "Winnipeg Jets": "WPG"};
  const short = (x) => String(x || "").split(" @ ").map((t) => CODES[t.trim()] || t.trim()).join(" @ ");
  const shortSel = (x) => CODES[String(x || "").trim()] || x;
  const dateTime = (v) => v && !Number.isNaN(new Date(v).getTime()) ? new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Sydney', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', timeZoneName:'short'}).format(new Date(v)) : "—";
  function colourControls() {
    if (tipsterId === "nfl-weather" || tipsterId === "nba-price-gap" || tipsterId === "nhl-value") {
      $("colourFilters").innerHTML = "";
      return;
    }
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
    return rows.filter(r => M.visibleFor(tipsterId, r) && (tipsterId === "nfl-weather" || selectedColours.has(M.colour(r))) && inRange(r)
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
    if(!dates.length) return tipsterId === 'nfl-weather'
      ? '<p class="muted">No settled tips yet. The growth line is this desk only (flat 1u) — it starts with the first graded tip.</p>'
      : tipsterId === 'nba-price-gap'
        ? '<p class="muted">No settled tips yet. The growth line is this desk only (flat 1 unit) and starts with the first graded tip.</p>'
        : tipsterId === 'nhl-value'
          ? '<p class="muted">No settled tips yet. The growth line is this desk only (flat paper 1 unit) and starts with the first graded tip.</p>'
          : '<p class="muted">No dated, unit-covered results for this selection yet.</p>';
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
    const lineLab = tipsterId === 'nfl-weather' ? 'NFL Totals' : tipsterId === 'nba-price-gap' ? (tipster.shortLabel || 'Price Gap') : (tipster.shortLabel || 'Tips');
    const legend=withPl
      ? '<p class="note"><span style="color:#63b3ff">● '+(tipster.shortLabel||'Tips')+(!a.length?' (no unit data)':'')+'</span> · <span style="color:#39d98a">● PL site picks'+(!b.length?' (no unit data)':'')+'</span></p>'
      : '<p class="note"><span style="color:#63b3ff">● '+lineLab+(!a.length?' (no unit data)':'')+'</span></p>';
    return '<div class="chart-wrap" data-pts=\''+esc(data)+'\'><svg class="units-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+aria+'">'
      +g+(withPl?line(b,'#39d98a'):'')+line(a,'#63b3ff')+endLab(a,'#63b3ff',lineLab)+lbB
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
      const seriesName = (tipsterId === "nba-price-gap" || tipsterId === "nhl-value") ? (tipster.shortLabel || "Tips") : "Tips";
      tip.innerHTML=best.length>3
        ? '<b>'+esc(best[1])+'</b><br><span style="color:#63b3ff">Tips '+esc(best[2])+'</span><br><span style="color:#39d98a">PL '+esc(best[3])+'</span>'
        : '<b>'+esc(best[1])+'</b><br><span style="color:#63b3ff">'+esc(seriesName)+' '+esc(best[2])+'</span>';
      const left=best[0]/800*r.width; tip.style.left=Math.min(Math.max(0,left-60),r.width-130)+'px';
    };
    svg.addEventListener('mousemove',move); svg.addEventListener('touchstart',move,{passive:true}); svg.addEventListener('touchmove',move,{passive:true});
    svg.addEventListener('mouseleave',()=>{tip.hidden=true;hov.setAttribute('visibility','hidden');});
  }
  function renderSummary() {
    if (tipsterId === "nba-price-gap") { renderGapSummary(); return; }
    if (tipsterId === "nhl-value") { renderNhlSummary(); return; }
    const withPl = tipsterId === 'nfl-weather' ? false : compareToPl;
    const mineRaw = (tipsterData && tipsterData.results) || [];
    const mine = tipsterId === 'nfl-weather'
      ? mineRaw.filter(r => M.visibleFor(tipsterId, r) && inRange(r) && String(r.sport || '').toUpperCase() === 'NFL')
      : filtered(mineRaw, true);
    const pl = withPl ? filtered(data.pl_results || [], true) : [];
    const tipLabel = tipsterId === 'nfl-weather' ? 'NFL Totals' : (tipster.shortLabel || 'Tips');
    const controls = tipsterId === 'nfl-weather'
      ? ''
      : ('<div class="summary-sports" role="group" aria-label="Summary sports"><button type="button" data-summary-sport="all" aria-pressed="'+(summarySports.size===sports.length)+'">All sports</button>'
      +sports.map(sp=>'<button type="button" data-summary-sport="'+sp+'" aria-pressed="'+summarySports.has(sp)+'">'+esc(sportLabel(sp))+'</button>').join('')+'</div>');
    const note = tipsterId === 'nfl-weather'
      ? '<p class="note"><b>'+esc(tipster.countNote)+'</b> Summary shows this desk\'s 1u growth only — one line.</p>'
      : (withPl
      ? '<p class="note"><b>'+esc(tipster.countNote)+'</b> Sport buttons apply to both records and the chart. Colour and date filters above apply to both. The sport dropdown is for the other tabs.</p>'
      : '<p class="note"><b>'+esc(tipster.countNote)+'</b> Sport buttons apply to this tipster\'s record and the chart. Colour and date filters above apply too. The sport dropdown is for the other tabs.</p>');
    const cards = withPl
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
    } else if (tipsterId === 'nfl-weather') {
      comparison='<p class="note">Win % excludes ties/voids. Flat 1u. One growth line for this desk only. Dates are Australia/Sydney.</p>';
    } else {
      comparison='<p class="note">Win % excludes ties/voids. Tipster units use recorded stakes and net P/L (including commission where recorded; paper 1u when a Sniper tip was not taken). Coverage shows results with known units. Dates are Australia/Sydney: settlement when available, otherwise game start (or placement as a last resort).</p>';
    }
    $("summary").innerHTML=controls+note+cards
      +'<section class="panel"><h3>'+(tipsterId==='nfl-weather'?'Growth (this desk only)':'Cumulative units')+'</h3>'+chartHtml(mine,pl,withPl)+'</section>'
      +comparison;
    wireChart();
    document.querySelectorAll('[data-summary-sport]').forEach(b=>b.addEventListener('click',()=>{
      const sp=b.dataset.summarySport;
      if(sp==='all') { const all=summarySports.size===sports.length; summarySports.clear(); if(!all) sports.forEach(s=>summarySports.add(s)); }
      else summarySports.has(sp)?summarySports.delete(sp):summarySports.add(sp);
      renderSummary();
    }));
  }
  function renderAttention() {
    if (tipsterId === 'sniper' || tipsterId === 'probalab' || tipsterId === 'nfl-weather' || tipsterId === 'nba-price-gap' || tipsterId === 'nhl-value') {
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
  function totalsSide(r) {
    const sel = String(r.selection || "");
    const m = sel.match(/^(Over|Under)\s+([0-9.]+)/i);
    if (m) return { side: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(), total: m[2] };
    if (r.total_line != null) return { side: /over/i.test(sel) ? "Over" : "Under", total: String(r.total_line) };
    return { side: sel || "—", total: "—" };
  }
  function bookieLabel(r) {
    const b = r.price_book || r.bookie || r.book || "";
    const map = { sportsbet: "Sportsbet", tab: "TAB", neds: "Neds", ladbrokes_au: "Ladbrokes", unibet: "Unibet",
      betr_au: "Betr", pointsbetau: "PointsBet", tabtouch: "TABtouch", pinnacle: "Pinnacle", betfair_ex_au: "Betfair" };
    return map[b] || (b ? String(b) : "—");
  }
  function renderTotalsRows(rows, emptyMsg) {
    if (!rows.length) return '<p class="muted">' + esc(emptyMsg) + "</p>";
    const body = rows.map((r) => {
      const t = totalsSide(r);
      return "<tr><td>" + esc(dateTime(r.kickoff_utc)) + "</td>"
        + '<td class="game">' + esc(short(r.game) || r.game || "") + "</td>"
        + "<td>" + esc(t.total) + "</td>"
        + "<td>" + esc(t.side) + "</td>"
        + "<td>" + esc(bookieLabel(r)) + "</td></tr>";
    }).join("");
    return '<div class="table-wrap"><table class="tips compact"><thead><tr>'
      + "<th>Kickoff</th><th>Game</th><th>Total</th><th>Side</th><th>Bookie</th>"
      + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }
  function renderTotalsUpcoming() {
    const now = Date.now();
    const rows = ((tipsterData && tipsterData.open_bets) || [])
      .filter((r) => r.published !== false)
      .filter((r) => !r.kickoff_utc || Date.parse(r.kickoff_utc) > now)
      .sort((a, b) => Date.parse(a.kickoff_utc || 0) - Date.parse(b.kickoff_utc || 0));
    $("today").innerHTML = '<div class="sport-block panel"><h3>Upcoming</h3>'
      + renderTotalsRows(rows, "No tips yet.")
      + "</div>";
  }
  const GAP_ABOUT = "This desk does not pick winners. It treats Pinnacle as the sharpest price, turns that into a fair chance with proportional de-vig — (1/price) ÷ (1/home + 1/away) — and alerts when the best Australian price times that chance is at least 1.03. NBA moneylines only, back bets only (no lays, no spreads). Books: Sportsbet, Ladbrokes, Neds, TAB, PointsBet, Unibet, and Betfair AU. Betfair is scored after 8% commission: 1 + (price − 1) × 0.92. Flat 1 unit at the alerted price. A favourite is a fair chance of 50% or more; the rest are underdogs.";
  const GAP_BOOKS = {
    sportsbet: "Sportsbet", ladbrokes: "Ladbrokes", ladbrokes_au: "Ladbrokes", neds: "Neds", tab: "TAB",
    pointsbet: "PointsBet", pointsbetau: "PointsBet", unibet: "Unibet", betfair: "Betfair AU",
    betfair_au: "Betfair AU", betfair_ex_au: "Betfair AU"
  };
  function gapBook(r) {
    const b = r.book || r.price_book || r.bookie || "";
    return GAP_BOOKS[String(b).toLowerCase()] || (b ? String(b) : "—");
  }
  function gapFair(r) {
    return M.number(r.pinnacle_fair != null ? r.pinnacle_fair : (r.pinnacle_fair_chance != null ? r.pinnacle_fair_chance : r.fair_chance));
  }
  function gapPct(r) {
    const g = M.number(r.gap_pct != null ? r.gap_pct : r.gap);
    if (g != null) return g;
    const price = M.number(r.price_taken != null ? r.price_taken : r.price);
    const fair = gapFair(r);
    return price != null && fair != null ? price * fair - 1 : null;
  }
  function gapRole(r) {
    const raw = String(r.role || r.side_role || "").toLowerCase();
    if (raw === "favourite" || raw === "favorite" || raw === "fav") return "Favourite";
    if (raw === "underdog" || raw === "dog") return "Underdog";
    const fair = gapFair(r);
    if (fair == null) return "—";
    return fair >= 0.5 ? "Favourite" : "Underdog";
  }
  function fmtSignedPct(x) {
    if (M.number(x) == null) return "—";
    const n = Number(x) * 100;
    const body = Math.abs(n).toFixed(1).replace(/\.0$/, "") + "%";
    return n > 0 ? "+" + body : n < 0 ? "-" + body : body;
  }
  function gapRows(rows) {
    return (rows || [])
      .filter((r) => r && r.published !== false && M.visibleFor(tipsterId, r) && inRange(r))
      .filter((r) => !$("fSport").value || r.sport === $("fSport").value);
  }
  function renderGapTable(rows, emptyMsg, mode) {
    if (!rows.length) return '<p class="muted">' + esc(emptyMsg) + "</p>";
    const body = rows.map((r) => {
      const price = r.price_taken != null ? r.price_taken : r.price;
      const units = mode === "results" ? M.pnl(r) : r.units;
      return "<tr><td>" + esc(dateTime(r.kickoff_utc || r.placed_utc)) + "</td>"
        + '<td class="game">' + esc(short(r.game) || r.game || "") + "</td>"
        + "<td>" + esc(shortSel(r.side || r.selection)) + "</td>"
        + "<td>" + esc(gapRole(r)) + "</td>"
        + "<td>" + esc(gapBook(r)) + "</td>"
        + "<td>" + fmtOdds(price) + "</td>"
        + "<td>" + fmtPct(gapFair(r)) + "</td>"
        + "<td>" + fmtSignedPct(gapPct(r)) + "</td>"
        + "<td>" + fmtSignedPct(r.vs_close != null ? r.vs_close : r.vsClose) + "</td>"
        + "<td>" + esc(mode === "results" ? (r.result || "—") : (r.result && r.result !== "open" ? r.result : "Open")) + "</td>"
        + '<td class="u' + (mode === "results" ? " " + clsU(units) : "") + '">' + fmtU(units) + "</td></tr>";
    }).join("");
    return '<div class="oddsfmt-bar"><button type="button" class="oddsfmt" aria-label="Odds format">DEC ⇄</button></div><div class="table-wrap"><table class="tips compact"><thead><tr>'
      + "<th>Tip-off</th><th>Game</th><th>Side</th><th>Tag</th><th>Book</th><th>Price</th><th>Pinnacle fair</th><th>Gap</th><th>vs close</th><th>Result</th><th>Units</th>"
      + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }
  // Public NBA pages keep a game on the upcoming list until four hours after tip-off.
  // This is the schedule only. It is not the NFL Totals rule that holds tips off the Tips tab.
  const NBA_SCHEDULE_GRACE_MS = 4 * 60 * 60 * 1000;
  function normTeam(c) {
    const u = String(c || "").trim().toUpperCase();
    const alias = { UTAH: "UTA", WSH: "WAS", GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS" };
    return alias[u] || u;
  }
  function teamTokens(s) {
    return short(String(s || "")).toUpperCase().split(/[^A-Z0-9]+/).filter((t) => t.length >= 2).map(normTeam);
  }
  function scheduleHasTip(g, tips) {
    const id = String(g.game_id || "");
    const away = normTeam(g.away);
    const home = normTeam(g.home);
    return tips.some((r) => {
      const rid = String(r.game_id || r.pick_id || "");
      if (id && rid.indexOf(id) !== -1) return true;
      const toks = teamTokens(r.game);
      return toks.length >= 2 && toks[0] === away && toks[1] === home;
    });
  }
  async function loadNbaSchedule() {
    try {
      const res = await fetch("/api/feed?sport=nba", { cache: "no-store" });
      if (!res.ok) return { games: [], error: true };
      const j = await res.json();
      const now = Date.now();
      const games = (j.games || []).filter((g) => {
        if (j.season != null && g.season != null && Number(g.season) !== Number(j.season)) return false;
        if (String(g.status || "") === "post") return false;
        const t = Date.parse(g.start_utc || "");
        return Number.isFinite(t) && t > now - NBA_SCHEDULE_GRACE_MS;
      }).sort((a, b) => Date.parse(a.start_utc) - Date.parse(b.start_utc));
      return { games: games, error: false };
    } catch (_) {
      return { games: [], error: true };
    }
  }
  function renderGapUpcoming() {
    const pack = (tipsterData && tipsterData.schedule) || { games: [], error: true };
    const tips = gapRows((tipsterData && tipsterData.open_bets) || []);
    const sport = $("fSport").value;
    let games = sport && sport !== "NBA" ? [] : (pack.games || []);
    games = games.filter((g) => inRange({ kickoff_utc: g.start_utc }));
    let table;
    if (pack.error) table = '<p class="muted">Could not load upcoming NBA games.</p>';
    else if (!games.length) table = '<p class="muted">No upcoming NBA games.</p>';
    else {
      table = '<div class="table-wrap"><table class="tips compact"><thead><tr>'
        + "<th>Tip-off</th><th>Game</th><th>Alert</th></tr></thead><tbody>"
        + games.map((g) => {
          const matchup = (g.away || "—") + " @ " + (g.home || "—");
          const mark = scheduleHasTip(g, tips) ? '<span class="badge ok">Tip up</span>' : "—";
          return "<tr><td>" + esc(dateTime(g.start_utc)) + '</td><td class="game">' + esc(matchup) + "</td><td>" + mark + "</td></tr>";
        }).join("")
        + "</tbody></table></div>";
    }
    $("today").innerHTML = '<div class="sport-block panel"><h3>Upcoming</h3>'
      + '<p class="note">Coming NBA games from the site schedule, so you can see what is on. This list is not a tip. When a price gap qualifies, the alert is on Tips and the game stays here.</p>'
      + table + "</div>";
  }
  function renderGapSummary() {
    const mine = ((tipsterData && tipsterData.results) || [])
      .filter((r) => r && M.visibleFor(tipsterId, r) && inRange(r) && String(r.sport || "NBA").toUpperCase() === "NBA");
    const fav = mine.filter((r) => gapRole(r) === "Favourite");
    const dog = mine.filter((r) => gapRole(r) === "Underdog");
    $("summary").innerHTML = '<p class="note"><b>' + esc(tipster.countNote) + '</b> One growth line for this desk only.</p>'
      + '<div class="cards">' + statsHtml("NBA Price Gap settled", mine) + "</div>"
      + '<div class="cards cols-2">' + statsHtml("Favourites", fav) + statsHtml("Underdogs", dog) + "</div>"
      + '<section class="panel"><h3>Growth (this desk only)</h3>' + chartHtml(mine, [], false) + "</section>"
      + '<p class="note">Win % excludes ties and voids. Flat 1 unit at the alerted price. Favourites are a Pinnacle fair chance of 50% or more; everyone else is an underdog. Dates are Australia/Sydney. This record stays separate from John, Closing Line Sniper, ProbaLab, EdgeBot, and NFL Totals.</p>';
    wireChart();
  }
  function normalizeGapBet(r) {
    if (!r || typeof r !== "object") return r;
    const side = String(r.side || r.selection || "").trim();
    const price = r.price_taken != null ? r.price_taken : r.price;
    return Object.assign({}, r, {
      sport: r.sport || "NBA",
      market: r.market || "moneyline",
      side: side,
      selection: String(r.selection || side).trim(),
      price_taken: price,
      book: r.book || r.price_book || r.bookie || "",
    });
  }
  async function loadNbaPriceGap() {
    let remote = { open_bets: [], results: [], generated_at: null, about: null };
    try {
      const loaded = await loadIsolatedBlock("nba-price-gap");
      remote.open_bets = loaded.open_bets || [];
      remote.results = loaded.results || [];
    } catch (_) {}
    let file = null;
    try {
      const res = await fetch("/data/tipsters/nba-price-gap.json", { cache: "no-store" });
      if (res.ok) file = await res.json();
    } catch (_) {}
    const fileOpen = file && Array.isArray(file.open_bets) && file.open_bets.length ? file.open_bets : null;
    const fileRes = file && Array.isArray(file.results) && file.results.length ? file.results : null;
    const norm = (xs) => (xs || []).filter((r) => r && r.published !== false).map(normalizeGapBet);
    const usingFile = !!(fileOpen || fileRes);
    const schedule = await loadNbaSchedule();
    return {
      open_bets: norm(fileOpen || remote.open_bets),
      results: norm(fileRes || remote.results),
      generated_at: usingFile ? (file.generated_at || null) : ((file && file.generated_at) || null),
      about: (file && file.about) || null,
      schedule: schedule,
    };
  }
  const NHL_ABOUT = "This desk does not just pick the favourite. It takes ProbaLab NHL v3's win chance for each team, sets a minimum price of 1.06 ÷ chance, and flags when the best Australian book (Sportsbet, Ladbrokes, Neds, TAB, PointsBet, Unibet, or Betfair after 8% commission) is still at or above that price. At most one side per game (the bigger gap). NHL moneylines only. Flat paper 1 unit. Record starts 7 Nov 2026.";
  const NHL_WINDOW_MS = 24 * 60 * 60 * 1000;
  function nhlChance(r) {
    const raw = M.number(r.model_chance != null ? r.model_chance : (r.probalab_chance != null ? r.probalab_chance : (r.win_pct != null ? r.win_pct : (r.chance != null ? r.chance : r.fair_chance))));
    if (raw == null) return null;
    return raw > 1 ? raw / 100 : raw;
  }
  function nhlMin(r) {
    const stated = M.number(r.min_price);
    if (stated != null) return stated;
    const chance = nhlChance(r);
    return chance != null && chance > 0 ? 1.06 / chance : null;
  }
  function nhlGap(r) {
    const stated = M.number(r.gap_pct != null ? r.gap_pct : r.gap);
    if (stated != null) return stated;
    const price = M.number(r.price_taken != null ? r.price_taken : r.price);
    const chance = nhlChance(r);
    return price != null && chance != null ? price * chance - 1 : null;
  }
  function nhlRows(rows) {
    return (rows || [])
      .filter((r) => r && r.published !== false && M.visibleFor(tipsterId, r) && inRange(r))
      .filter((r) => String(r.sport || "NHL").toUpperCase() === "NHL")
      .filter((r) => !$("fSport").value || r.sport === $("fSport").value);
  }
  function renderNhlTable(rows, emptyMsg, mode) {
    if (!rows.length) return '<p class="muted">' + esc(emptyMsg) + "</p>";
    const body = rows.map((r) => {
      const price = r.price_taken != null ? r.price_taken : r.price;
      const units = mode === "results" ? M.pnl(r) : r.units;
      return "<tr><td>" + esc(dateTime(r.kickoff_utc || r.placed_utc)) + "</td>"
        + '<td class="game">' + esc(short(r.game) || r.game || "") + "</td>"
        + "<td>" + esc(shortSel(r.side || r.selection)) + "</td>"
        + "<td>" + esc(gapBook(r)) + "</td>"
        + "<td>" + fmtOdds(price) + "</td>"
        + "<td>" + fmtPct(nhlChance(r)) + "</td>"
        + "<td>" + fmtOdds(nhlMin(r)) + "</td>"
        + "<td>" + fmtSignedPct(nhlGap(r)) + "</td>"
        + "<td>" + esc(mode === "results" ? (r.result || "—") : (r.result && r.result !== "open" ? r.result : "Open")) + "</td>"
        + '<td class="u' + (mode === "results" ? " " + clsU(units) : "") + '">' + fmtU(units) + "</td></tr>";
    }).join("");
    return '<div class="oddsfmt-bar"><button type="button" class="oddsfmt" aria-label="Odds format">DEC ⇄</button></div><div class="table-wrap"><table class="tips compact"><thead><tr>'
      + "<th>Puck drop</th><th>Game</th><th>Side</th><th>Book</th><th>Price</th><th>Model chance</th><th>Min price</th><th>Gap</th><th>Result</th><th>Units</th>"
      + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }
  async function loadNhlSchedule() {
    try {
      const res = await fetch("/data/nhl-picks.json", { cache: "no-store" });
      if (!res.ok) return { games: [], error: true, limited: true };
      const raw = await res.json();
      const list = (Array.isArray(raw) ? raw : (raw.games || [])).map((g) => ({
        game_id: String(g.id || g.game_id || ""),
        away: g.away,
        home: g.home,
        start_utc: g.date || g.start_utc || g.kickoff_utc || g.puck_drop_utc,
        status: g.status || "",
      }));
      const win = M.comingWindow(list, Date.now(), NHL_WINDOW_MS);
      return { games: win.games, error: false, limited: win.limited };
    } catch (_) {
      return { games: [], error: true, limited: true };
    }
  }
  function renderNhlUpcoming() {
    const pack = (tipsterData && tipsterData.schedule) || { games: [], error: true, limited: true };
    const tips = nhlRows((tipsterData && tipsterData.open_bets) || []);
    const sport = $("fSport").value;
    let games = sport && sport !== "NHL" ? [] : (pack.games || []);
    games = games.filter((g) => inRange({ kickoff_utc: g.start_utc }));
    const note = pack.limited
      ? "Coming NHL games in the next 24 hours, from the same schedule as the site. This list is not a tip. A game shows here without a qualified alert. Qualified alerts are on Tips."
      : "No NHL games in the next 24 hours, so this is the next slate on the site schedule. This list is not a tip. Qualified alerts are on Tips.";
    let table;
    if (pack.error) table = '<p class="muted">Could not load upcoming NHL games.</p>';
    else if (!games.length) table = '<p class="muted">No upcoming NHL games.</p>';
    else {
      table = '<div class="table-wrap"><table class="tips compact"><thead><tr>'
        + "<th>Puck drop</th><th>Game</th><th>Alert</th></tr></thead><tbody>"
        + games.map((g) => {
          const matchup = (g.away || "—") + " @ " + (g.home || "—");
          const mark = scheduleHasTip(g, tips) ? '<span class="badge ok">Tip up</span>' : "—";
          return "<tr><td>" + esc(dateTime(g.start_utc)) + '</td><td class="game">' + esc(matchup) + "</td><td>" + mark + "</td></tr>";
        }).join("")
        + "</tbody></table></div>";
    }
    $("today").innerHTML = '<div class="sport-block panel"><h3>Upcoming</h3>'
      + '<p class="note">' + note + "</p>" + table + "</div>";
  }
  function renderNhlSummary() {
    const mine = ((tipsterData && tipsterData.results) || [])
      .filter((r) => r && M.visibleFor(tipsterId, r) && inRange(r) && String(r.sport || "NHL").toUpperCase() === "NHL");
    $("summary").innerHTML = '<p class="note"><b>' + esc(tipster.countNote) + "</b> One growth line for this desk only.</p>"
      + '<div class="cards">' + statsHtml("NHL Value settled", mine) + "</div>"
      + '<section class="panel"><h3>Growth (this desk only)</h3>' + chartHtml(mine, [], false) + "</section>"
      + "<p class=\"note\">Win % excludes ties and voids. Flat paper 1 unit. Dates are Australia/Sydney. This record stays separate from John, Closing Line Sniper, ProbaLab, NFL Totals, and NBA Price Gap. Units only — no bankroll.</p>";
    wireChart();
  }
  function normalizeNhlBet(r) {
    if (!r || typeof r !== "object") return r;
    const side = String(r.side || r.selection || "").trim();
    const price = r.price_taken != null ? r.price_taken : r.price;
    return Object.assign({}, r, {
      sport: r.sport || "NHL",
      market: r.market || "moneyline",
      side: side,
      selection: String(r.selection || side).trim(),
      price_taken: price,
      book: r.book || r.price_book || r.bookie || "",
    });
  }
  async function loadNhlValue() {
    // Own snapshot id=nhl-value only. John's latest row is not read, and its bets are never shown.
    let src = null;
    try {
      const { data: row } = await sb.from("tips_page_snapshot").select("payload, generated_at").eq("id", "nhl-value").maybeSingle();
      if (row && row.payload) {
        src = row.payload;
        if (row.generated_at && !src.generated_at) src.generated_at = row.generated_at;
      }
    } catch (_) {}
    if (!src) {
      try {
        const res = await fetch("/data/tipsters/nhl-value.json", { cache: "no-store" });
        if (res.ok) src = await res.json();
      } catch (_) {}
    }
    src = src || {};
    const norm = (xs) => (xs || []).filter((r) => r && r.published !== false).map(normalizeNhlBet);
    return {
      open_bets: norm(src.open_bets),
      results: norm(src.results),
      generated_at: src.generated_at || null,
      about: src.about || null,
      schedule: await loadNhlSchedule(),
    };
  }
  function renderToday() {
    if (tipsterId === "nba-price-gap") { renderGapUpcoming(); return; }
    if (tipsterId === "nhl-value") { renderNhlUpcoming(); return; }
    if (tipsterId === "nfl-weather") { renderTotalsUpcoming(); return; }
    const now = Date.now();
    const rows = filtered(data.today || []).filter((p) => Date.parse(p.tipoff_utc) > now).sort((a, b) => Date.parse(a.tipoff_utc) - Date.parse(b.tipoff_utc));
    const by = {};
    rows.forEach((p) => { (by[p.sport] ??= []).push(p); });
    const order = sports.filter((s) => by[s]).concat(Object.keys(by).filter((s) => !sports.includes(s)).sort());
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
      return '<div class="sport-block panel"><div class="oddsfmt-bar"><h3>' + esc(sportLabel(sport)) + '</h3><button type="button" class="oddsfmt" aria-label="Odds format">DEC ⇄</button></div><div class="table-wrap"><table class="tips"><thead><tr>'
        + "<th>Tip-off</th><th>Game</th><th>Pick</th><th>Light</th><th>Win %</th><th>Min</th><th>Price</th><th>Flags</th>"
        + "</tr></thead><tbody>" + body + "</tbody></table></div></div>";
    }).join("");
  }
  function betFilter(rows) { return filtered(rows); }
  const shortDate = (v) => v && !Number.isNaN(new Date(v).getTime()) ? new Intl.DateTimeFormat('en-AU', {timeZone:'Australia/Sydney', day:'numeric', month:'short'}).format(new Date(v)) : "—";
  const gameCell = (r) => '<td class="game"><span class="sp">' + esc(String(r.sport || "").toUpperCase() === "CHAMP" ? "CHAMP" : r.sport || "") + '</span> ' + esc(short(r.game)) + "</td>";
  // Tips tab for NFL Totals: only last 4h before kickoff (Upcoming keeps all open tips).
  const NFL_TOTALS_TIPS_WINDOW_MS = 4 * 60 * 60 * 1000;
  function inNflTotalsTipsWindow(r, now) {
    const ko = Date.parse(r.kickoff_utc || "");
    if (!Number.isFinite(ko)) return false;
    return ko - now <= NFL_TOTALS_TIPS_WINDOW_MS;
  }
  function renderOpen() {
    if (tipsterId === "nba-price-gap") {
      const rows = gapRows((tipsterData && tipsterData.open_bets) || [])
        .sort((a, b) => Date.parse(a.kickoff_utc || a.placed_utc || 0) - Date.parse(b.kickoff_utc || b.placed_utc || 0));
      $("open").innerHTML = renderGapTable(rows, "No open alerts yet.", "open");
      return;
    }
    if (tipsterId === "nhl-value") {
      const rows = nhlRows((tipsterData && tipsterData.open_bets) || [])
        .sort((a, b) => Date.parse(a.kickoff_utc || a.placed_utc || 0) - Date.parse(b.kickoff_utc || b.placed_utc || 0));
      $("open").innerHTML = renderNhlTable(rows, "No qualified alerts yet.", "open");
      return;
    }
    if (tipsterId === "nfl-weather") {
      const now = Date.now();
      const rows = ((tipsterData && tipsterData.open_bets) || [])
        .filter((r) => r.published !== false)
        .filter((r) => inNflTotalsTipsWindow(r, now))
        .filter((r) => inRange(r))
        .filter((r) => !$("fSport").value || r.sport === $("fSport").value)
        .sort((a, b) => Date.parse(a.kickoff_utc || 0) - Date.parse(b.kickoff_utc || 0));
      $("open").innerHTML = renderTotalsRows(rows, "No tips live yet — they appear here in the last 4 hours before kickoff.");
      return;
    }
    let rows = betFilter((tipsterData && tipsterData.open_bets) || []);
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
    if (tipsterId === "nba-price-gap") {
      const rows = gapRows((tipsterData && tipsterData.results) || [])
        .filter((r) => r.result === "W" || r.result === "L" || r.result === "T" || r.result === "void")
        .sort((a, b) => String(b.kickoff_utc || b.placed_utc || "").localeCompare(String(a.kickoff_utc || a.placed_utc || "")));
      $("results").innerHTML = renderGapTable(rows, "No results yet.", "results");
      return;
    }
    if (tipsterId === "nhl-value") {
      const rows = nhlRows((tipsterData && tipsterData.results) || [])
        .filter((r) => r.result === "W" || r.result === "L" || r.result === "T" || r.result === "void")
        .sort((a, b) => String(b.kickoff_utc || b.placed_utc || "").localeCompare(String(a.kickoff_utc || a.placed_utc || "")));
      $("results").innerHTML = renderNhlTable(rows, "No results yet.", "results");
      return;
    }
    if (tipsterId === "nfl-weather") {
      const rows = ((tipsterData && tipsterData.results) || [])
        .filter((r) => r.result === "W" || r.result === "L" || r.result === "T")
        .filter((r) => inRange(r))
        .filter((r) => !$("fSport").value || r.sport === $("fSport").value)
        .sort((a, b) => String(b.placed_utc || "").localeCompare(String(a.placed_utc || "")));
      $("results").innerHTML = renderTotalsRows(rows, "No results yet.");
      return;
    }
    let rows = betFilter((tipsterData && tipsterData.results) || []).filter((r) => r.result === "W" || r.result === "L" || r.result === "T").sort((a, b) => String(b.placed_utc || "").localeCompare(String(a.placed_utc || "")));
    rows = rows.filter((r) => r.result === "W" || r.result === "L");
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
    $("meta").textContent = tipsterId === "nfl-weather"
      ? ("Updated " + gen + " · units only · NFL Totals")
      : tipsterId === "nba-price-gap"
        ? ("Updated " + gen + " · units only · NBA Price Gap")
        : tipsterId === "nhl-value"
          ? ("Updated " + gen + " · units only · NHL Value")
          : ("Updated " + gen + " · units only · " + tipster.name + " vs PL board");
    const pitch = $("deskPitch"); if (pitch) pitch.textContent = tipster.pitch + " · " + tipster.focus;
    if ((tipsterId === "nba-price-gap" || tipsterId === "nhl-value") && pitch) {
      const rulesId = tipsterId === "nhl-value" ? "nhlRules" : "gapRules";
      let rules = $(rulesId);
      if (!rules) {
        rules = document.createElement("p");
        rules.id = rulesId;
        rules.className = "note";
        pitch.insertAdjacentElement("afterend", rules);
      }
      rules.textContent = (tipsterData && tipsterData.about) || (tipsterId === "nhl-value" ? NHL_ABOUT : GAP_ABOUT);
    }
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
    if (tipsterId === "nba-price-gap") {
      // Own snapshot only. John's latest row is not required, and its bets are never shown.
      data = { generated_at: null, today: [], open_bets: [], results: [], pl_results: [], needs_attention: [] };
      tipsterData = await loadNbaPriceGap();
      if (tipsterData.generated_at) data.generated_at = tipsterData.generated_at;
      renderAll();
      return;
    }
    if (tipsterId === "nhl-value") {
      data = { generated_at: null, today: [], open_bets: [], results: [], pl_results: [], needs_attention: [] };
      tipsterData = await loadNhlValue();
      if (tipsterData.generated_at) data.generated_at = tipsterData.generated_at;
      renderAll();
      return;
    }
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
    } else if (tipsterId === "nfl-weather") {
      tipsterData = await loadIsolatedBlock("nfl-weather");
      try {
        const j = await (await fetch("/data/tipsters/nfl-weather.json", { cache: "no-store" })).json();
        const pub = (xs) => (xs || []).filter((r) => r.published !== false);
        // Prefer the published file snapshot; never surface watch_list or method to the desk.
        tipsterData = {
          open_bets: pub(j.open_bets && j.open_bets.length ? j.open_bets : tipsterData.open_bets),
          results: (j.results && j.results.length ? j.results : tipsterData.results) || [],
          generated_at: j.generated_at || tipsterData.generated_at || null,
          summary: j.summary || null,
        };
        if (j.generated_at) data.generated_at = j.generated_at;
      } catch (_) {
        tipsterData.open_bets = (tipsterData.open_bets || []).filter((r) => r.published !== false);
      }
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
