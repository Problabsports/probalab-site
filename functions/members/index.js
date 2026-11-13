// Members: sign in when logged out; tipster lobby when logged in. Waitlist is secondary.
import { shell, html } from "../_shared/site.js";

export async function onRequestGet() {
  const body = `
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Members</span></nav>
  <p class="eyebrow">// members</p>
  <p id="deniedNote" class="note" style="display:none;color:var(--orange)">That email isn't on the members list yet. <a href="/join">Join here</a>, or use the waitlist below.</p>

  <section id="bootPane" class="panel">
    <p class="muted">Checking your sign-in…</p>
  </section>

  <div id="lobbyPane" class="hidden tips-app">
    <h1>Tipsters</h1>
    <p>Public pages rate every game. Members follow tipsters who pick a smaller set with their own strategy and compare that record with the ProbaLab board. Everyone here is still building a track record.</p>
    <div class="tips-toolbar">
      <span id="who" class="muted"></span>
      <a href="/members/billing">Manage billing</a>
      <button type="button" id="signOut">Sign out</button>
    </div>
    <p id="lobbyMeta" class="subline"></p>
    <p id="lobbyMsg" class="msg"></p>
    <div id="tipsterCards" class="tipster-grid"></div>
    <aside class="trust-strip compact" aria-label="How we keep the record honest">
        <a class="trust-item" href="/results"><span class="trust-ico" aria-hidden="true">⏱</span><span>Every pick is timestamped before tip-off</span></a>
        <a class="trust-item" href="/results.csv"><span class="trust-ico" aria-hidden="true">⬇</span><span>Download the full results CSV — losses included</span></a>
        <a class="trust-item" href="/results#picks"><span class="trust-ico" aria-hidden="true">◎</span><span>Each pick shows vs close (CLV) when we have a price</span></a>
      </aside>
  </div>

  <div id="publicPane" class="hidden">
    <h1>Sign in to ProbaLab members</h1>
    <p>Tipster desks are live. Sign in to open the lobby, or <a href="/join">join as a member</a>. Public pages still rate every game; members follow tipsters who pick a smaller set with their own strategy — still building their track records, units only.</p>
    <aside class="trust-strip compact" aria-label="How we keep the record honest">
        <a class="trust-item" href="/results"><span class="trust-ico" aria-hidden="true">⏱</span><span>Every pick is timestamped before tip-off</span></a>
        <a class="trust-item" href="/results.csv"><span class="trust-ico" aria-hidden="true">⬇</span><span>Download the full results CSV — losses included</span></a>
        <a class="trust-item" href="/results#picks"><span class="trust-ico" aria-hidden="true">◎</span><span>Each pick shows vs close (CLV) when we have a price</span></a>
      </aside>

    <section class="panel" id="memberSignIn">
      <h2>Sign in</h2>
      <p class="note">Use your members email and password to open the tipster lobby.</p>
      <form id="memberLoginForm" class="login-box">
        <label for="memberEmail">Email</label><br>
        <input id="memberEmail" type="email" required autocomplete="username" placeholder="you@example.com" style="width:100%;max-width:360px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 10px"><br>
        <label for="memberPassword">Password</label><br>
        <input id="memberPassword" type="password" required autocomplete="current-password" style="width:100%;max-width:360px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 10px">
        <div><button class="btn" type="submit" style="display:inline-block;border:0;cursor:pointer;font-family:var(--f-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#07080f;background:var(--cyan);padding:10px 18px">Open members</button></div>
        <p id="memberLoginMsg" class="msg muted"></p>
      </form>
    </section>

    <section class="panel">
      <h2>Live tipster desks</h2>
      <p>Sign in to open a desk. Each tipster keeps its own record, separate from the public board.</p>
      <ul class="desk-list">
        <li><button type="button" class="tipster-name-btn" data-tipster-info="john" aria-expanded="false" aria-haspopup="dialog"><b>John's Tips</b></button> — sports betting with laser-focused, data-driven analysis</li>
        <li><button type="button" class="tipster-name-btn" data-tipster-info="probalab" aria-expanded="false" aria-haspopup="dialog"><b>ProbaLab</b></button> — site greens and supers across NBA, NFL, NHL and EPL</li>
        <li><button type="button" class="tipster-name-btn" data-tipster-info="sniper" aria-expanded="false" aria-haspopup="dialog"><b>Closing Line Sniper</b></button> — selective Closing Line tips</li>
      </ul>
      <p class="note">Tipsters are still proving themselves. No public staking claims on this page.</p>
    </section>


    <section class="panel prose" id="not-for-everyone">
      <h2>This isn't for everyone</h2>
      <p>ProbaLab members desks publish tipsters' picks and their records. There are <b>no guaranteed winners</b> and <b>no risk-free returns</b>. Models and tipsters have losing runs. Every pick and every result is posted — wins and losses — on the public <a href="/results">Results</a> page and in the CSV.</p>
      <p>This rewards patience and discipline, not quick wins. It is <b>18+ only</b>. If you bet, stake only what you can afford to lose. Read our <a href="/responsible-gambling">responsible gambling</a> commitment.</p>
    </section>

    <section class="panel" id="members-faq">
      <h2>Members FAQ</h2>
      <details class="faq-item"><summary>Which sports are covered?</summary>
        <p>Live desks cover the sports we publish publicly: NBA, NFL, NHL, Premier League, Championship and tennis. Each tipster lists the sports it tips. We do not tip sports that are not live on the site.</p>
      </details>
      <details class="faq-item"><summary>How are tips delivered?</summary>
        <p>Tips appear on the members tipster desks on this site. Some desks also send Discord alerts when a tip qualifies. <a href="/members/discord">Link your Discord</a> to get the Premium role and the members channels. There is no Telegram channel.</p>
      </details>
      <details class="faq-item"><summary>How many tips per day?</summary>
        <p>It varies. Tipsters only post when they see value on their own rules — some days several, some days none. There is no fixed daily quota.</p>
      </details>
      <details class="faq-item"><summary>What is a unit?</summary>
        <p>A unit is a flat stake size used to keep records comparable. Most desks paper-trade at 1 unit per tip unless the tipster states otherwise. Units are for tracking, not a staking plan we tell you to follow.</p>
      </details>
      <details class="faq-item"><summary>How are results verified?</summary>
        <p>Picks are timestamped before the start and frozen when the game begins. Finished results stay on the public <a href="/results">Results</a> page and in the downloadable CSV — nothing is deleted after a loss.</p>
      </details>
      <details class="faq-item"><summary>Can I cancel? How do payments work?</summary>
        <p>Yes. Join on the <a href="/join">join page</a>. Founding pricing is US$24/month or US$240/year for the first 10 members, locked for life while you stay subscribed. After that, new members pay US$39/month or US$390/year. Cancel any time from <a href="/members/billing">Manage billing</a>. Access continues until the end of the period you have paid for. See <a href="/refund">Refunds</a>.</p>
      </details>
    </section>

    <section class="panel" id="joinMembers">
      <h2>Not a member yet?</h2>
      <p>You can join now. Founding pricing is US$24/month or US$240/year for the first 10 members, locked for life while you stay subscribed. After the first 10, the price is US$39/month or US$390/year.</p>
      <p><a class="btn" href="/join">Join ProbaLab Members</a></p>
      <p class="note">18+ only. Cancel any time. <a href="/refund">Refunds</a> · <a href="/responsible-gambling">Gamble responsibly</a>.</p>
    </section>

    <section class="panel">
      <h2>Or join the waitlist</h2>
      <p>If you're not ready to pay, leave your email and we will write when you ask us to.</p>
      <form class="signup main" id="waitlistForm" action="/api/members-waitlist" method="post" data-waitlist>
        <label for="wl-email"><b>Email me when a seat opens</b></label>
        <p>No spam. Waitlist mail only.</p>
        <div class="srow">
          <input id="wl-email" type="email" name="email" required maxlength="254" placeholder="you@example.com" autocomplete="email">
          <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input type="hidden" name="source" value="members">
          <button type="submit">Join waitlist</button>
        </div>
        <p class="small">Unsubscribe any time. 18+. <a href="/privacy">Privacy</a></p>
        <p class="msg" id="wlMsg" role="status"></p>
      </form>
    </section>
  </div>

  <link rel="stylesheet" href="/members-tips.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/members-tips-model.js"></script>
  <script src="/members-owner.js"></script>
  <script src="/members-lobby.js"></script>`;

  const page = shell({
    title: "Members | ProbaLab",
    description: "Sign in to ProbaLab members. Live tipster desks, each with its own record. Founding price for the first 10 members.",
    path: "/members",
    body,
    noindex: false,
    signup: false,
  });
  return html(page, 200, 60);
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
