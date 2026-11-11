/* John-only Sportsbet multi form. Writes to public.john_multis (RLS owner). Alerts via john-multi-alert edge function. */
(function () {
  const SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  const ALERT_FN = SB_URL + "/functions/v1/john-multi-alert";
  const SPORTS = ["NBA", "NFL", "NHL", "EPL", "CHAMP", "TENNIS"];
  let sb = null;
  let session = null;
  let isOwner = false;
  let upcoming = [];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function aedtLocalValue(d) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
  function localInputToAedtIso(v) {
    // datetime-local as Australia/Sydney wall time
    if (!v) return null;
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
  }
  function nextId(existing, when) {
    const day = aedtLocalValue(when || new Date()).slice(0, 10);
    const base = `SB-MULTI-${day}-`;
    let n = 1;
    for (const row of existing || []) {
      const id = String(row.id || "");
      if (id.startsWith(base)) {
        const tail = Number(id.slice(base.length));
        if (Number.isFinite(tail) && tail >= n) n = tail + 1;
      }
    }
    return base + n;
  }
  function legRow(data, idx) {
    const d = data || {};
    const opts = SPORTS.map((s) => `<option value="${s}"${String(d.sport || "").toUpperCase() === s ? " selected" : ""}>${s === "CHAMP" ? "Championship" : s}</option>`).join("");
    const games = (upcoming || []).map((g) => {
      const label = `${g.sport} · ${g.game} · ${g.tipoff_aedt || g.tipoff_utc || ""}`;
      return `<option value="${esc(g.game)}" data-sport="${esc(g.sport)}" data-start="${esc(g.tipoff_utc || "")}" data-aedt="${esc((g.tipoff_aedt || "").replace(/^[A-Za-z]+ /, ""))}"></option>`;
    }).join("");
    return `<div class="multi-leg" data-idx="${idx}">
      <label>Sport<select class="leg-sport" required>${opts}</select></label>
      <label>Game<input class="leg-game" list="upcomingGames" required value="${esc(d.game || "")}" placeholder="AWAY @ HOME"></label>
      <label>Selection<input class="leg-selection" required value="${esc(d.selection || "")}" placeholder="Team / player"></label>
      <label>Leg price<input class="leg-price" type="number" min="1.01" step="0.01" required value="${d.leg_price != null ? esc(d.leg_price) : ""}"></label>
      <label>Start (AEDT)<input class="leg-start" type="datetime-local" required value="${esc(d.start_local || "")}"></label>
      <button type="button" class="btn-secondary leg-remove" aria-label="Remove leg">Remove</button>
    </div>`;
  }
  function ensureDatalist() {
    let dl = $("upcomingGames");
    if (!dl) {
      dl = document.createElement("datalist");
      dl.id = "upcomingGames";
      document.body.appendChild(dl);
    }
    dl.innerHTML = (upcoming || []).map((g) => {
      const label = `${g.sport} · ${g.game}`;
      return `<option value="${esc(g.game)}" label="${esc(label)}"></option>`;
    }).join("");
  }
  function setLegCount(n, seed) {
    const wrap = $("multiLegs");
    if (!wrap) return;
    const rows = [];
    for (let i = 0; i < Math.max(2, n); i++) rows.push(legRow((seed && seed[i]) || {}, i));
    wrap.innerHTML = rows.join("");
    wrap.querySelectorAll(".leg-remove").forEach((btn) => btn.addEventListener("click", () => {
      if (wrap.querySelectorAll(".multi-leg").length <= 2) return;
      btn.closest(".multi-leg").remove();
    }));
    wrap.querySelectorAll(".leg-game").forEach((inp) => inp.addEventListener("change", () => {
      const g = (upcoming || []).find((x) => x.game === inp.value);
      if (!g) return;
      const row = inp.closest(".multi-leg");
      const sport = row.querySelector(".leg-sport");
      if (sport && g.sport) sport.value = String(g.sport).toUpperCase() === "CHAMPIONSHIP" ? "CHAMP" : String(g.sport).toUpperCase();
      const start = row.querySelector(".leg-start");
      if (start && g.tipoff_utc) start.value = aedtLocalValue(new Date(g.tipoff_utc));
      if (!row.querySelector(".leg-selection").value && g.selection) row.querySelector(".leg-selection").value = g.selection;
    }));
  }
  function readForm() {
    const legs = [...document.querySelectorAll(".multi-leg")].map((row) => ({
      sport: row.querySelector(".leg-sport").value,
      game: row.querySelector(".leg-game").value.trim(),
      selection: row.querySelector(".leg-selection").value.trim(),
      market: "Moneyline",
      leg_price: Number(row.querySelector(".leg-price").value),
      start_aedt: localInputToAedtIso(row.querySelector(".leg-start").value),
    }));
    return {
      id: $("multiId").value || undefined,
      bookie: $("multiBookie").value,
      placed_at: localInputToAedtIso($("multiPlaced").value),
      stake_units: Number($("multiStakeUnits").value),
      combined_price: Number($("multiCombined").value),
      legs,
    };
  }
  function openForm(edit) {
    const panel = $("multiFormPanel");
    if (!panel) return;
    panel.classList.remove("hidden");
    $("multiFormTitle").textContent = edit ? "Edit multi" : "Add multi";
    $("multiDelete").classList.toggle("hidden", !edit);
    $("multiFormMsg").textContent = "";
    if (!edit) {
      $("multiId").value = "";
      $("multiBookie").value = "Sportsbet";
      $("multiStakeUnits").value = "1";
      $("multiCombined").value = "";
      $("multiPlaced").value = aedtLocalValue(new Date());
      setLegCount(2);
    } else {
      $("multiId").value = edit.id;
      $("multiBookie").value = edit.bookie || "Sportsbet";
      $("multiStakeUnits").value = edit.stake_units;
      $("multiCombined").value = edit.combined_price;
      $("multiPlaced").value = edit.placed_at ? aedtLocalValue(new Date(edit.placed_at)) : aedtLocalValue(new Date());
      const seeds = (edit.legs || []).map((leg) => ({
        ...leg,
        start_local: leg.start_utc ? aedtLocalValue(new Date(leg.start_utc)) : "",
      }));
      setLegCount(Math.max(2, seeds.length), seeds);
    }
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function loadOpenMultis() {
    if (!sb || !isOwner) return [];
    const { data, error } = await sb.from("john_multis").select("*").is("deleted_at", null).eq("status", "open").order("placed_at", { ascending: false });
    if (error) throw error;
    const box = $("openMultisAdmin");
    if (!box) return data || [];
    const rows = data || [];
    if (!rows.length) { box.innerHTML = '<p class="muted">No open multis in Supabase yet.</p>'; return rows; }
    box.innerHTML = '<h3>Open multis</h3><ul class="multi-admin-list">' + rows.map((m) =>
      `<li><button type="button" data-edit-multi="${esc(m.id)}">${esc(m.id)}</button> · $${Number(m.combined_price).toFixed(2)} · ${Number(m.stake_units)}u · ${(m.legs || []).length} legs</li>`
    ).join("") + "</ul>";
    box.querySelectorAll("[data-edit-multi]").forEach((btn) => btn.addEventListener("click", () => {
      const row = rows.find((r) => r.id === btn.getAttribute("data-edit-multi"));
      if (row) openForm(row);
    }));
    return rows;
  }
  async function alertDiscord(multiId) {
    if (!session) return;
    try {
      await fetch(ALERT_FN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
          apikey: window.__SB_ANON || "",
        },
        body: JSON.stringify({ multi_id: multiId }),
      });
    } catch (_) { /* save still succeeded; export backup can alert later */ }
  }
  async function saveMulti(ev) {
    ev.preventDefault();
    const msg = $("multiFormMsg");
    msg.textContent = "Saving…";
    try {
      const payload = readForm();
      if (!payload.legs || payload.legs.length < 2) throw new Error("Need at least 2 legs");
      for (const leg of payload.legs) {
        if (!leg.game || !leg.selection || !(leg.leg_price > 1) || !leg.start_aedt) throw new Error("Each leg needs game, selection, price and start");
      }
      const existing = await loadOpenMultis();
      const id = payload.id || nextId(existing);
      // Convert AEDT wall times to ISO with +11/+10 via Date parsing in Sydney — store as timestamptz by appending offset guess
      function aedtToIso(wall) {
        // wall: YYYY-MM-DD HH:MM — treat as Australia/Sydney using a fixed format the DB accepts
        return wall.replace(" ", "T") + ":00+11:00";
      }
      const legs = payload.legs.map((leg) => ({
        sport: leg.sport,
        game: leg.game,
        selection: leg.selection,
        market: leg.market || "Moneyline",
        leg_price: leg.leg_price,
        start_aedt: leg.start_aedt,
        start_utc: new Date(aedtToIso(leg.start_aedt)).toISOString(),
        result: "open",
      }));
      const row = {
        id,
        bookie: payload.bookie,
        placed_at: new Date(aedtToIso(payload.placed_at)).toISOString(),
        stake_units: payload.stake_units,
        combined_price: payload.combined_price,
        legs,
        status: "open",
        created_by: session.user.id,
        updated_at: new Date().toISOString(),
      };
      const { error } = await sb.from("john_multis").upsert(row, { onConflict: "id" });
      if (error) throw error;
      // Alert before reset. New saves get a #john alert; edits are deduped or marked updated by the edge function.
      await alertDiscord(id);
      await loadOpenMultis();
      // Always return to a blank "new multi" so a second save cannot upsert over the one just written.
      openForm(null);
      msg.textContent = "Saved " + id + ". Form cleared — you can enter another multi. It will show on Tips after the next desk publish (or refresh once export runs). Discord #john alerted when configured.";
    } catch (err) {
      msg.textContent = "Could not save: " + (err && err.message ? err.message : err);
    }
  }
  async function deleteMulti() {
    const id = $("multiId").value;
    if (!id) return;
    if (!confirm("Delete open multi " + id + "?")) return;
    const { error } = await sb.from("john_multis").update({ deleted_at: new Date().toISOString(), status: "open" }).eq("id", id);
    if (error) { $("multiFormMsg").textContent = error.message; return; }
    $("multiFormMsg").textContent = "Deleted " + id;
    $("multiId").value = "";
    await loadOpenMultis();
    setLegCount(2);
  }
  window.JohnMultis = {
    nextId,
    init(supabaseClient, sess, owner, todayRows) {
      sb = supabaseClient;
      session = sess;
      isOwner = !!owner;
      upcoming = Array.isArray(todayRows) ? todayRows : [];
      const actions = $("johnMultiActions");
      if (actions) actions.classList.toggle("hidden", !(tipsterIsJohn() && isOwner));
      if (!(tipsterIsJohn() && isOwner)) return;
      ensureDatalist();
      const btn = $("addMultiBtn");
      if (btn && !btn._wired) {
        btn._wired = true;
        btn.addEventListener("click", () => openForm(null));
        $("multiAddLeg").addEventListener("click", () => {
          const n = document.querySelectorAll(".multi-leg").length + 1;
          const cur = [...document.querySelectorAll(".multi-leg")].map((row) => ({
            sport: row.querySelector(".leg-sport").value,
            game: row.querySelector(".leg-game").value,
            selection: row.querySelector(".leg-selection").value,
            leg_price: row.querySelector(".leg-price").value,
            start_local: row.querySelector(".leg-start").value,
          }));
          setLegCount(n, cur);
        });
        $("multiForm").addEventListener("submit", saveMulti);
        $("multiCancel").addEventListener("click", () => $("multiFormPanel").classList.add("hidden"));
        $("multiDelete").addEventListener("click", deleteMulti);
      }
      setLegCount(2);
      loadOpenMultis().catch(() => {});
    },
    setUpcoming(rows) { upcoming = rows || []; ensureDatalist(); },
  };
  function tipsterIsJohn() {
    const root = document.querySelector(".tips-app[data-tipster]");
    const id = (root && root.dataset.tipster) || "john";
    return String(id).toLowerCase() === "john";
  }
})();
