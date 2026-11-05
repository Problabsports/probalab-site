/* Private tips desk client. Units only. Logged-out users go to /members. */
(function () {
  const SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
  const HIDDEN = new Set(["EPL"]);
  let sb, data = null, tab = "today";
  const $ = (id) => document.getElementById(id);
  const fmtPct = (x) => (x == null || Number.isNaN(Number(x)) ? "—" : (Number(x) * 100).toFixed(1).replace(/\.0$/, "") + "%");
  const fmtOdds = (x) => (x == null || Number.isNaN(Number(x)) ? "—" : Number(x).toFixed(2));
  const fmtU = (x) => {
    if (x == null || Number.isNaN(Number(x))) return "—";
    const n = Number(x);
    return (n > 0 ? "+" : "") + n.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") + "u";
  };
  const clsU = (x) => (x == null ? "" : Number(x) > 0 ? "pos" : Number(x) < 0 ? "neg" : "");
  const chip = (l) => (l ? '<span class="chip ' + esc(l) + '">' + esc(l) + "</span>" : "—");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dash = (v) => (v == null || v === "" ? "—" : esc(v));
  const flags = (arr) => (arr || []).map((f) => {
    const br = /BREAK|UNDER_MIN/i.test(f);
    return '<span class="badge ' + (br ? "break" : "ok") + '">' + esc(f) + "</span>";
  }).join(" ");
  const showEpl = () => !!($("showEpl") && $("showEpl").checked);
  const sportOk = (s) => showEpl() || !HIDDEN.has(String(s || "").toUpperCase());

  function statsHtml(title, st) {
    st = st || {};
    const wl = (st.wins ?? 0) + "-" + (st.losses ?? 0) + ((st.ties || st.voids) ? "-" + ((st.ties || 0) + (st.voids || 0)) : "");
    return '<div class="stat-card"><h3>' + esc(title) + '</h3><dl class="stat-grid">'
      + "<div><dt>Bets</dt><dd>" + dash(st.bets) + "</dd></div>"
      + "<div><dt>W-L</dt><dd>" + esc(wl) + "</dd></div>"
      + '<div><dt>Units</dt><dd class="' + clsU(st.units) + '">' + fmtU(st.units) + "</dd></div>"
      + "<div><dt>ROI</dt><dd>" + fmtPct(st.roi) + "</dd></div>"
      + "<div><dt>Avg odds</dt><dd>" + fmtOdds(st.avg_odds) + "</dd></div>"
      + "<div><dt>Avg CLV</dt><dd>" + fmtPct(st.avg_clv) + "</dd></div>"
      + (st.open_bets != null ? "<div><dt>Open</dt><dd>" + dash(st.open_bets) + "</dd></div>" : "")
      + "</dl></div>";
  }
  function sportLines(st) {
    const by = (st && st.by_sport) || {};
    const keys = Object.keys(by).filter(sportOk);
    if (!keys.length) return "";
    return '<div class="subline">' + keys.map((k) => {
      const s = by[k] || {};
      return esc(k) + ": " + fmtU(s.units) + " (" + (s.wins ?? 0) + "-" + (s.losses ?? 0) + ")";
    }).join(" · ") + "</div>";
  }
  function lightLines(st) {
    const by = (st && st.by_light) || {};
    const keys = Object.keys(by);
    if (!keys.length) return "";
    return '<div class="subline">By light: ' + keys.map((k) => esc(k) + " " + fmtU((by[k] || {}).units)).join(" · ") + "</div>";
  }
  function nbaRuleLines(st) {
    const nr = st && st.nba_rule;
    if (!nr) return "";
    return '<div class="subline">NBA_RULE_V2 follow ' + fmtU((nr.follow || {}).units)
      + ' · break <span class="' + clsU((nr.break || {}).units) + '">' + fmtU((nr.break || {}).units) + "</span></div>";
  }
  function renderSummary() {
    const sum = data.summary || {};
    const all = sum.all || {};
    const cl = (sum.by_system || {}).CL || {};
    const pl = (sum.by_system || {}).PL || {};
    $("summary").innerHTML = '<div class="cards cols-3">'
      + statsHtml("All bets (first)", all)
      + statsHtml("Closing Line", cl)
      + statsHtml("ProbaLab", pl)
      + '</div><div class="panel">' + sportLines(all) + lightLines(all) + nbaRuleLines(all)
      + '<div class="subline" style="margin-top:8px">CL and PL stay side by side — never merged.</div></div>';
  }
  function renderAttention() {
    const items = (data.needs_attention || []).filter((a) => sportOk(a.sport));
    if (!items.length) { $("attention").innerHTML = '<p class="muted">Nothing needs attention.</p>'; return; }
    $("attention").innerHTML = items.map((a) =>
      '<div class="attn ' + esc(a.severity || "warn") + '"><b>' + esc((a.severity || "warn").toUpperCase())
      + "</b> " + esc(a.message)
      + (a.game ? ' <span class="muted">(' + esc(a.sport || "") + " · " + esc(a.game) + ")</span>" : "")
      + "</div>"
    ).join("");
  }
  function qualifies(p) {
    if (typeof p.qualifies === "boolean") return p.qualifies;
    if (String(p.sport).toUpperCase() !== "NBA") return null;
    const lightOk = p.light === "GREEN" || p.light === "SUPER";
    const price = p.current_price ?? p.min_price;
    if (!lightOk || price == null || p.min_price == null) return null;
    return price >= p.min_price && price <= 1.49;
  }
  function renderToday() {
    const rows = (data.today || []).filter((p) => sportOk(p.sport));
    const by = {};
    rows.forEach((p) => { (by[p.sport] ??= []).push(p); });
    const order = ["NBA", "NFL", "NHL", "EPL"].filter((s) => by[s]);
    if (!order.length) { $("today").innerHTML = '<p class="muted">No captured picks for today.</p>'; return; }
    $("today").innerHTML = order.map((sport) => {
      const body = by[sport].map((p) => {
        const q = qualifies(p);
        const qBadge = q === true ? '<span class="badge ok">qualifies</span>' : q === false ? '<span class="badge warn">no</span>' : "";
        const taken = p.taken ? '<span class="badge taken">taken</span>' : "";
        return "<tr><td>" + dash(p.tipoff_aedt || p.tipoff_utc) + "</td>"
          + '<td class="game">' + esc(p.game) + "</td>"
          + "<td>" + esc(p.selection) + "</td>"
          + "<td>" + chip(p.light) + "</td>"
          + "<td>" + fmtPct(p.win_pct) + "</td>"
          + "<td>" + fmtOdds(p.min_price) + "</td>"
          + "<td>" + fmtOdds(p.current_price) + "</td>"
          + "<td>" + qBadge + " " + taken + " " + flags(p.rule_flags) + "</td></tr>";
      }).join("");
      return '<div class="sport-block panel"><h3>' + esc(sport) + '</h3><div class="table-wrap"><table class="tips"><thead><tr>'
        + "<th>Tip-off</th><th>Game</th><th>Pick</th><th>Light</th><th>Win %</th><th>Min</th><th>Price</th><th>Flags</th>"
        + "</tr></thead><tbody>" + body + "</tbody></table></div></div>";
    }).join("");
  }
  function betFilter(rows) {
    const sport = $("fSport").value;
    const system = $("fSystem").value;
    const light = $("fLight").value;
    const from = $("fFrom").value;
    const to = $("fTo").value;
    return rows.filter((r) => {
      if (!sportOk(r.sport)) return false;
      if (sport && r.sport !== sport) return false;
      if (system && r.tag !== system) return false;
      if (light && r.light !== light) return false;
      const d = (r.placed_utc || r.kickoff_utc || "").slice(0, 10);
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;
      return true;
    });
  }
  function renderOpen() {
    const rows = betFilter(data.open_bets || []);
    if (!rows.length) { $("open").innerHTML = '<p class="muted">No open bets in this filter.</p>'; return; }
    $("open").innerHTML = '<div class="table-wrap"><table class="tips"><thead><tr>'
      + "<th>Placed</th><th>Sport</th><th>Game</th><th>Pick</th><th>Tag</th><th>Light</th><th>Price</th><th>Units</th><th>Flags</th>"
      + "</tr></thead><tbody>"
      + rows.map((r) => "<tr><td>" + dash((r.placed_utc || "").replace("T", " ").replace("Z", "")) + "</td>"
        + "<td>" + esc(r.sport) + "</td>"
        + '<td class="game">' + esc(r.game) + "</td>"
        + "<td>" + esc(r.selection) + "</td>"
        + "<td>" + esc(r.tag) + "</td>"
        + "<td>" + chip(r.light) + "</td>"
        + "<td>" + fmtOdds(r.price_taken) + "</td>"
        + "<td>" + fmtU(r.units) + "</td>"
        + "<td>" + flags(r.rule_flags) + "</td></tr>").join("")
      + "</tbody></table></div>";
  }
  function renderResults() {
    const rows = betFilter(data.results || []);
    if (!rows.length) { $("results").innerHTML = '<p class="muted">No results in this filter.</p>'; return; }
    $("results").innerHTML = '<div class="table-wrap"><table class="tips"><thead><tr>'
      + "<th>Date</th><th>Sport</th><th>Game</th><th>Pick</th><th>Tag</th><th>Light</th><th>Taken</th><th>Close</th><th>CLV</th><th>Result</th><th>P/L</th><th>Flags</th>"
      + "</tr></thead><tbody>"
      + rows.map((r) => "<tr><td>" + dash((r.placed_utc || "").slice(0, 10)) + "</td>"
        + "<td>" + esc(r.sport) + "</td>"
        + '<td class="game">' + esc(r.game) + "</td>"
        + "<td>" + esc(r.selection) + "</td>"
        + "<td>" + esc(r.tag) + "</td>"
        + "<td>" + chip(r.light) + "</td>"
        + "<td>" + fmtOdds(r.price_taken) + "</td>"
        + "<td>" + fmtOdds(r.closing_price) + "</td>"
        + "<td>" + fmtPct(r.clv_pct) + "</td>"
        + "<td>" + esc(r.result) + "</td>"
        + '<td class="' + clsU(r.pnl_units) + '">' + fmtU(r.pnl_units) + "</td>"
        + "<td>" + flags(r.rule_flags) + "</td></tr>").join("")
      + "</tbody></table></div>";
  }
  function showTab(name) {
    tab = name;
    ["today", "open", "results", "summary"].forEach((t) => {
      $(t + "Pane").classList.toggle("hidden", t !== name);
      const b = document.querySelector('[data-tab="' + t + '"]');
      if (b) b.classList.toggle("on", t === name);
    });
    $("filters").classList.toggle("hidden", name !== "open" && name !== "results");
  }
  function renderAll() {
    const gen = data.generated_at ? String(data.generated_at) : "—";
    $("meta").textContent = "Updated " + gen + " · units only · EPL hidden unless toggled";
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
    ["fSport", "fSystem", "fLight", "fFrom", "fTo", "showEpl"].forEach((id) => {
      $(id).addEventListener("change", () => {
        renderAttention(); renderSummary(); renderToday(); renderOpen(); renderResults();
      });
    });
    showTab("today");

    let sawSession = false;
    sb.auth.onAuthStateChange(async (_event, session) => {
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
    });
  }
  boot();
})();
