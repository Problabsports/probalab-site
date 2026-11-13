/* Members tipster lobby. Logged-out → sign in (waitlist secondary). Logged-in → tipster cards. */
(function () {
  const SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";
  const M = window.TipsModel;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtU = (x) => {
    if (M.number(x) == null) return "—";
    const n = Number(x);
    return (n > 0 ? "+" : "") + n.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") + "u";
  };
  const clsU = (x) => (x == null ? "" : Number(x) > 0 ? "pos" : Number(x) < 0 ? "neg" : "");

  let sb, memberSession = null, memberRole = null, isOwner = false;

  function johnCardStats(payload) {
    const rows = (payload.results || []).filter((r) => M.visible(r) && (r.result === "W" || r.result === "L"));
    return M.stats(rows);
  }

  function sniperCardStats(payload, sniperPayload) {
    const block = sniperPayload
      || ((payload.tipsters && payload.tipsters.sniper) || {});
    const rows = (block.results || []).filter((r) => M.valid(r) && (r.result === "W" || r.result === "L"));
    return M.stats(rows);
  }

  function tipsterBlurb(id) {
    const meta = (M && M.tipsterMeta) ? M.tipsterMeta(id) : null;
    return (meta && meta.blurb) || (meta && meta.pitch) || "";
  }

  function nameBtn(id, name) {
    return '<button type="button" class="tipster-name-btn" data-tipster-info="' + esc(id)
      + '" aria-expanded="false" aria-haspopup="dialog">' + esc(name) + '</button>';
  }

  function liveCard(opts) {
    const st = opts.stats || {};
    const wl = (st.wins != null && st.losses != null) ? (st.wins + "–" + st.losses) : "—";
    const tid = opts.id || "john";
    const badge = opts.badge || "Live";
    const badgeCls = opts.badgeClass || "ok";
    return '<a class="tipster-card live" href="' + esc(opts.href) + '">'
      + '<div class="tipster-card-top"><h2>' + nameBtn(tid, opts.name) + '</h2><span class="badge ' + esc(badgeCls) + '">' + esc(badge) + '</span></div>'
      + (opts.focus ? '<p class="tipster-focus">' + esc(opts.focus) + '</p>' : '')
      + '<p class="tipster-pitch">' + esc(opts.pitch) + '</p>'
      + '<dl class="stat-grid tipster-stats">'
      + '<div><dt>W–L</dt><dd>' + esc(wl) + '</dd></div>'
      + '<div><dt>Net units</dt><dd class="' + clsU(st.units) + '">' + fmtU(st.units) + '</dd></div>'
      + '</dl>'
      + '<p class="note tipster-footnote">' + esc(opts.footnote) + '</p>'
      + '<span class="tipster-cta">Open desk →</span></a>';
  }

  function renderLobby(payload, sniperPayload, plPayload, weatherPayload, gapPayload, nhlPayload) {
    const john = johnCardStats(payload);
    const sniper = sniperCardStats(payload, sniperPayload);
    const probalab = sniperCardStats({}, plPayload || { results: [] });
    const weather = sniperCardStats({}, weatherPayload || { results: [], open_bets: [] });
    const gap = sniperCardStats({}, gapPayload || { results: [] });
    const nhl = sniperCardStats({}, nhlPayload || { results: [] });
    const gen = payload.generated_at
      ? new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(payload.generated_at))
      : "—";
    $("lobbyMeta").textContent = "Updated " + gen + " · units only · still proving the record";
    $("tipsterCards").innerHTML =
      liveCard({
        id: "john",
        name: "John's Tips",
        focus: "NBA · NFL · NHL (NBA greens capped at 1.49 from 13 Nov)",
        pitch: "Sports betting with laser-focused, data-driven analysis.",
        footnote: "All-time record. The desk opens on the fresh start from 16 Nov.",
        href: "/members/tips/john",
        stats: john,
      })
      + liveCard({
        id: "sniper",
        name: "Closing Line Sniper",
        focus: "",
        pitch: "Fewer shots. When the market agrees, the Sniper takes aim with crosshair focus on strong closing-line value (CLV).",
        footnote: "Every tip that was sent counts, including ones John did not take (paper units).",
        href: "/members/tips/sniper",
        stats: sniper,
      })
      + liveCard({
        id: "probalab",
        name: "ProbaLab",
        focus: "NBA · NFL · NHL · EPL",
        pitch: "Tips the site's green and super picks (about 65%+) across NBA, NFL, NHL and EPL.",
        footnote: "Fresh record from 7 Nov 2026. Paper units at the site's fair price.",
        href: "/members/tips/probalab",
        stats: probalab,
      });
    if (isOwner) {
      $("tipsterCards").innerHTML +=
        liveCard({
          id: "nfl-weather",
          name: "NFL Totals",
          focus: "NFL totals · overs and unders",
          pitch: "NFL game totals — overs and unders, mostly unders. Flat 1u.",
          footnote: "Private — members cannot see this desk. Fresh record. Flat 1u.",
          href: "/members/tips/nfl-weather",
          stats: weather,
          badge: "Private",
          badgeClass: "warn",
        })
        + liveCard({
          id: "nba-price-gap",
          name: "NBA Price Gap",
          focus: "NBA moneylines",
          pitch: "Doesn't try to pick the winner. It treats Pinnacle as the best read on each team's chance, and flags when an Australian book is still offering a better price, usually on the underdog.",
          footnote: "Private — members cannot see this desk. Flat 1 unit at the alerted price. Record starts 7 Nov 2026.",
          href: "/members/tips/nba-price-gap",
          stats: gap,
          badge: "Private",
          badgeClass: "warn",
        })
        + liveCard({
          id: "nhl-value",
          name: "NHL Value",
          focus: "NHL moneylines",
          pitch: "Doesn't just pick the favourite. It takes ProbaLab NHL v3's win chance for each team, sets a minimum price of 1.06 ÷ chance, and flags when the best Australian book is still at or above that price. At most one side per game.",
          footnote: "Private — members cannot see this desk. Flat paper 1 unit. Record starts 7 Nov 2026.",
          href: "/members/tips/nhl-value",
          stats: nhl,
          badge: "Private",
          badgeClass: "warn",
        });
    }
  }

  async function ensureProfile(session) {
    const email = session.user.email;
    const { data: allow } = await sb.from("member_allowlist").select("role").ilike("email", email).maybeSingle();
    if (!allow) return false;
    memberRole = allow.role;
    isOwner = M.isOwnerAccount(email, allow.role);
    await sb.from("member_profiles").upsert({ user_id: session.user.id, email, role: allow.role }, { onConflict: "user_id" });
    return true;
  }

  async function loadSnapshot() {
    const { data: row, error } = await sb.from("tips_page_snapshot").select("payload, generated_at").eq("id", "latest").maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("No tips snapshot yet");
    const payload = row.payload || {};
    if (M.bindJohnDocument) M.bindJohnDocument(payload);
    if (row.generated_at && !payload.generated_at) payload.generated_at = row.generated_at;
    let sniperPayload = null;
    const { data: snRow } = await sb.from("tips_page_snapshot").select("payload").eq("id", "sniper").maybeSingle();
    if (snRow && snRow.payload && (Array.isArray(snRow.payload.results) || Array.isArray(snRow.payload.open_bets))) {
      sniperPayload = snRow.payload;
    }
    let plPayload = null;
    const { data: plRow } = await sb.from("tips_page_snapshot").select("payload").eq("id", "probalab").maybeSingle();
    if (plRow && plRow.payload) plPayload = plRow.payload;
    let weatherPayload = null, gapPayload = null, nhlPayload = null;
    if (isOwner) {
      const hiddenFetch = (url) => (window.MembersOwner
        ? MembersOwner.authFetch(url, { cache: "no-store" }, memberSession)
        : fetch(url, { cache: "no-store" }));
      for (const snapId of ["nfl-totals", "nfl-weather"]) {
        const { data: wxRow } = await sb.from("tips_page_snapshot").select("payload").eq("id", snapId).maybeSingle();
        if (wxRow && wxRow.payload) { weatherPayload = wxRow.payload; break; }
      }
      if (!weatherPayload) {
        try {
          const j = await (await hiddenFetch("/data/tipsters/nfl-weather.json")).json();
          if (j && (Array.isArray(j.open_bets) || Array.isArray(j.results))) weatherPayload = j;
        } catch (_) {}
      }
      const { data: gapRow } = await sb.from("tips_page_snapshot").select("payload").eq("id", "nba-price-gap").maybeSingle();
      if (gapRow && gapRow.payload) gapPayload = gapRow.payload;
      if (!gapPayload) {
        try {
          const j = await (await hiddenFetch("/data/tipsters/nba-price-gap.json")).json();
          if (j && (Array.isArray(j.open_bets) || Array.isArray(j.results))) gapPayload = j;
        } catch (_) {}
      }
      const { data: nhlRow } = await sb.from("tips_page_snapshot").select("payload").eq("id", "nhl-value").maybeSingle();
      if (nhlRow && nhlRow.payload) nhlPayload = nhlRow.payload;
      if (!nhlPayload) {
        try {
          const j = await (await hiddenFetch("/data/tipsters/nhl-value.json")).json();
          if (j && (Array.isArray(j.open_bets) || Array.isArray(j.results))) nhlPayload = j;
        } catch (_) {}
      }
    }
    renderLobby(payload, sniperPayload, plPayload, weatherPayload, gapPayload, nhlPayload);
  }

  function show(mode) {
    $("bootPane").classList.toggle("hidden", mode !== "boot");
    $("lobbyPane").classList.toggle("hidden", mode !== "lobby");
    $("publicPane").classList.toggle("hidden", mode !== "public");
  }

  function wirePublic() {
    wireTipsterInfo(document);
    if (/[?&]denied=1/.test(location.search)) {
      const dn = $("deniedNote");
      if (dn) dn.style.display = "block";
    }
    const f = $("waitlistForm");
    if (f) f.addEventListener("submit", function (e) {
      e.preventDefault();
      const m = $("wlMsg"), b = f.querySelector("button");
      b.disabled = true; m.textContent = "Joining…";
      fetch("/api/members-waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: f.email.value, website: f.website.value, source: f.source.value })
      }).then((r) => r.json()).then((j) => {
        m.textContent = j.ok
          ? "Thanks — you're on the waitlist. We'll email you when a seat opens."
          : (j.error || "Something went wrong. Please try again.");
        if (j.ok) f.email.value = "";
        b.disabled = false;
      }).catch(() => {
        m.textContent = "Something went wrong. Please try again.";
        b.disabled = false;
      });
    });

    const lf = $("memberLoginForm");
    if (lf && window.supabase) {
      lf.addEventListener("submit", function (e) {
        e.preventDefault();
        const msg = $("memberLoginMsg");
        msg.textContent = "Signing in…";
        sb.auth.signInWithPassword({
          email: $("memberEmail").value.trim(),
          password: $("memberPassword").value
        }).then((res) => {
          if (res.error) { msg.textContent = res.error.message; return; }
          msg.textContent = "Signed in — opening tipsters…";
          location.replace("/members");
        });
      });
    }
  }


  let openPop = null;

  function closeTipsterPop() {
    if (!openPop) return;
    const { btn, pop } = openPop;
    btn.setAttribute("aria-expanded", "false");
    btn.removeAttribute("aria-controls");
    pop.remove();
    openPop = null;
  }

  function openTipsterPop(btn) {
    const id = btn.getAttribute("data-tipster-info") || "john";
    const meta = (M && M.tipsterMeta) ? M.tipsterMeta(id) : { name: btn.textContent.trim(), blurb: tipsterBlurb(id) };
    const text = meta.blurb || meta.pitch || tipsterBlurb(id);
    if (!text) return;
    closeTipsterPop();
    const pop = document.createElement("div");
    pop.className = "tipster-popover";
    pop.id = "tipster-pop-" + id;
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", (meta.name || id) + " tipster");
    pop.innerHTML = '<p class="tipster-pop-title">' + esc(meta.name || btn.textContent.trim()) + '</p>'
      + '<p class="tipster-pop-body">' + esc(text) + '</p>';
    const host = btn.closest("li, .tipster-card-top, h2") || btn.parentElement || document.body;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.appendChild(pop);
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-controls", pop.id);
    openPop = { btn, pop };
    // Keep inside viewport on small screens
    requestAnimationFrame(() => {
      const r = pop.getBoundingClientRect();
      if (r.right > window.innerWidth - 8) pop.style.left = Math.max(8, window.innerWidth - r.width - 8 - host.getBoundingClientRect().left) + "px";
      if (r.bottom > window.innerHeight - 8) pop.style.top = "auto", pop.style.bottom = "calc(100% + 8px)";
    });
  }

  function wireTipsterInfo(root) {
    const scope = root || document;
    scope.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("[data-tipster-info]");
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        if (openPop && openPop.btn === btn) { closeTipsterPop(); return; }
        openTipsterPop(btn);
        return;
      }
      if (openPop && !(e.target.closest && e.target.closest(".tipster-popover"))) closeTipsterPop();
    }, true);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeTipsterPop();
    });
  }

  async function boot() {
    show("boot");
    wirePublic();
    if (!window.supabase) { show("public"); return; }
    sb = window.supabase.createClient(SB_URL, SB_ANON, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    $("signOut").addEventListener("click", async () => {
      if (window.MembersOwner) await MembersOwner.clear();
      await sb.auth.signOut();
      location.replace("/members");
    });
    const { data } = await sb.auth.getSession();
    const session = data && data.session;
    if (!session) { show("public"); return; }
    const ok = await ensureProfile(session);
    if (!ok) {
      await sb.auth.signOut();
      location.replace("/members?denied=1");
      return;
    }
    memberSession = session;
    if (isOwner && window.MembersOwner) await MembersOwner.claim(session);
    $("who").textContent = "Signed in as " + session.user.email + (isOwner ? " · owner" : "");
    show("lobby");
    try {
      await loadSnapshot();
      $("lobbyMsg").textContent = "";
    } catch (err) {
      $("lobbyMsg").textContent = "Could not load tipster cards: " + (err.message || err);
      // Still show coming-soon + empty live shells so the lobby is usable
      renderLobby({ results: [], tipsters: { sniper: { results: [] } } });
    }
  }
  boot();
})();
