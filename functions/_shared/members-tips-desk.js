// Shared HTML for a tipster's 4-tab tips desk. tipsterId: "john" | "sniper" | "probalab"
export function tipsDeskBody(tipsterId = "john") {
  const id = String(tipsterId || "john").toLowerCase();
  const known = { john: "John", sniper: "Closing Line Sniper", probalab: "ProbaLab", "nfl-weather": "NFL Totals", "nfl-totals": "NFL Totals", "nba-price-gap": "NBA Price Gap", "nhl-value": "NHL Value" };
  const safe = known[id] ? id : "john";
  const title = known[safe];
  return `
  <div class="tips-app" data-tipster="${safe}">
    <p class="eyebrow">// private · members · units only</p>
    <p class="crumbs tips-back"><a href="/members">← All tipsters</a></p>
    <h1 id="deskTitle">${title}</h1>
    <p class="note" id="deskPitch"></p>
    <p class="note">Units only. Bankroll never shown.</p>

    <section id="bootPane" class="panel">
      <p class="muted">Checking your sign-in…</p>
      <p class="note"><a href="/members">Members</a></p>
    </section>

    <div id="appPane" class="hidden">
      <div class="tips-toolbar">
        <span id="who" class="muted"></span>
        <span id="johnMultiActions" class="john-multi-actions hidden">
          <button type="button" id="addMultiBtn" class="btn-secondary">Add multi</button>
        </span>
        <button type="button" id="signOut">Sign out</button>
      </div>
      <p id="meta" class="subline"></p>
      <p id="loadMsg" class="msg"></p>

      <section class="panel hidden" id="multiFormPanel">
        <h2 id="multiFormTitle">Add multi</h2>
        <p class="note">Sportsbet multis only. Units shown on the desk; Discord #john alerts on save. Edit or delete while open.</p>
        <form id="multiForm" class="multi-form">
          <input type="hidden" id="multiId" value="">
          <div class="multi-grid">
            <label>Bookie
              <select id="multiBookie"><option selected>Sportsbet</option><option>Ladbrokes</option><option>PointsBet</option><option>Neds</option><option>bet365</option><option>Unibet</option></select>
            </label>
            <label>Stake (units)
              <input id="multiStakeUnits" type="number" min="0.01" step="0.01" required placeholder="1.0">
            </label>
            <label>Combined price
              <input id="multiCombined" type="number" min="1.01" step="0.01" required placeholder="4.50">
            </label>
            <label>Placed (AEDT)
              <input id="multiPlaced" type="datetime-local" required>
            </label>
          </div>
          <div id="multiLegs" class="multi-legs"></div>
          <p><button type="button" id="multiAddLeg" class="btn-secondary">Add leg</button></p>
          <p id="multiFormMsg" class="msg" role="status"></p>
          <div class="multi-form-actions">
            <button type="submit" id="multiSave">Save multi</button>
            <button type="button" id="multiCancel" class="btn-secondary">Cancel</button>
            <button type="button" id="multiDelete" class="btn-danger hidden">Delete open multi</button>
          </div>
        </form>
        <div id="openMultisAdmin" class="open-multis-admin"></div>
      </section>

      <section class="panel" id="attnPanel">
        <h2>Needs attention</h2>
        <div id="attention"></div>
      </section>

      <div class="tips-tabs" role="tablist">
        <button type="button" data-tab="today" class="on">Upcoming</button>
        <button type="button" data-tab="open">Tips</button>
        <button type="button" data-tab="results">Results</button>
        <button type="button" data-tab="summary">Summary</button>
      </div>

      <div id="filters" class="tips-filters hidden">
        <label>Sport<select id="fSport"><option value="">All</option><option>NBA</option><option>NFL</option><option>NHL</option><option>EPL</option><option value="CHAMP">Championship</option><option value="TENNIS">Tennis</option></select></label>
        <div id="colourFilters" class="colour-filters" role="group" aria-label="Pick colours"></div>
        <label>From<input id="fFrom" type="date"></label>
        <label>To<input id="fTo" type="date"></label>
      </div>

      <section id="todayPane"><div id="today"></div></section>
      <section id="openPane" class="hidden panel"><p class="note" id="openNote">Open tips awaiting settlement.</p><div id="open"></div></section>
      <section id="resultsPane" class="hidden panel"><div id="results"></div></section>
      <section id="summaryPane" class="hidden"><div id="summary"></div></section>
    </div>
  </div>
  <link rel="stylesheet" href="/members-tips.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/members-tips-model.js"></script>
  <script src="/odds.js"></script>
  <script src="/members-john-multis.js"></script>
  <script src="/members-tips-app.js"></script>`;
}

export function tipsDeskResponse(shell, html, tipsterId = "john") {
  const id = String(tipsterId || "john").toLowerCase();
  const known = { john: "John", sniper: "Closing Line Sniper", probalab: "ProbaLab", "nfl-weather": "NFL Totals", "nfl-totals": "NFL Totals", "nba-price-gap": "NBA Price Gap", "nhl-value": "NHL Value" };
  const safe = known[id] ? id : "john";
  const title = known[safe];
  const page = shell({
    title: `${title} tips | ProbaLab`,
    description: "Private tipster desk",
    path: `/members/tips/${safe}`,
    body: tipsDeskBody(safe),
    noindex: true,
    signup: false,
  });
  const res = html(page, 200, 0);
  const headers = new Headers(res.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(res.body, { status: res.status, headers });
}
