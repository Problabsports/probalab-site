// /join — ProbaLab Members pricing and checkout. Preview only until John says "make live".
import { shell, html } from "./_shared/site.js";
import { currentOffer, FOUNDING_CAP, offerFromUsedCount } from "./_shared/membership.js";

function offerOrFallback(env) {
  return currentOffer(env).catch((err) => {
    console.log("join offer failed", err && err.message);
    return offerFromUsedCount(0, FOUNDING_CAP);
  });
}

export async function onRequestGet(ctx) {
  const offer = await offerOrFallback(ctx.env || {});
  const founding = offer.foundingOpen;
  const remaining = offer.foundingRemaining;
  const monthly = offer.monthly;
  const yearly = offer.yearly;
  const heading = founding ? "Join ProbaLab Members" : "Join ProbaLab Members";
  const priceNote = founding
    ? `Founding price for the first ${FOUNDING_CAP} members, locked for life while you stay subscribed.`
    : "The founding offer for the first 10 members is now closed. Standard pricing is shown below.";
  const remainingLine = founding
    ? (remaining == null
      ? `First ${FOUNDING_CAP} members.`
      : `${remaining} of ${FOUNDING_CAP} founding spots left.`)
    : "";
  const yearlySave = founding ? "Two months free versus monthly." : "Two months free versus monthly.";

  const body = `
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/members">Members</a> › <span>Join</span></nav>
  <p class="eyebrow">// join</p>
  <h1>${heading}</h1>
  <p>Members get the John, ProbaLab and Sniper desks, live tip alerts in Discord, and the members newsletter. There are no guaranteed winners. Every pick, including losses, stays on the public <a href="/results">Results</a> record.</p>
  <p class="note">${priceNote}${remainingLine ? " " + remainingLine : ""}</p>

  <form id="joinForm" class="join-form">
    <section class="panel">
      <label for="joinEmail"><b>Email</b></label>
      <p class="note">We'll send your welcome email and sign-in to this address.</p>
      <input id="joinEmail" name="email" type="email" required maxlength="254" autocomplete="email" placeholder="you@example.com" style="width:100%;max-width:420px;background:var(--bg);color:var(--ink);border:1px solid var(--line-hi);padding:10px 12px;font:15px var(--f-body);margin:0 0 16px">

      <fieldset class="join-plans">
        <legend>Choose a plan</legend>
        <label class="join-plan">
          <input type="radio" name="interval" value="month" checked>
          <span>
            <b>${founding ? "Founding monthly" : "Monthly"}</b>
            <span class="join-price">${monthly.label}</span>
            ${founding ? `<span class="note">Locked for life. First ${FOUNDING_CAP} members.</span>` : ""}
          </span>
        </label>
        <label class="join-plan">
          <input type="radio" name="interval" value="year">
          <span>
            <b>${founding ? "Founding yearly" : "Yearly"}</b>
            <span class="join-price">${yearly.label}</span>
            <span class="note">${yearlySave}</span>
          </span>
        </label>
      </fieldset>

      <label class="join-agree">
        <input id="joinAgree" type="checkbox" required>
        <span>I am 18 or over and agree to the <a href="/terms">Terms</a>, <a href="/privacy">Privacy policy</a> and <a href="/refund">Refunds</a>. I understand this is not betting advice.</span>
      </label>

      <div><button class="btn" type="submit" style="display:inline-block;border:0;cursor:pointer;font-family:var(--f-display);font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#07080f;background:var(--cyan);padding:10px 18px;margin-top:12px">Continue to payment</button></div>
      <p id="joinMsg" class="msg" role="status"></p>
      <p class="small">Checkout is in US dollars, through Stripe. Cancel any time from <a href="/members/billing">Manage billing</a>. 18+. <a href="/responsible-gambling">Gamble responsibly</a>.</p>
    </section>
  </form>

  <style>
    .join-plans { border:0; padding:0; margin:0 0 16px; display:grid; gap:10px; max-width:520px; }
    .join-plan { display:flex; gap:12px; align-items:flex-start; border:1px solid var(--line-hi); padding:12px 14px; cursor:pointer; }
    .join-plan:has(input:checked) { border-color: var(--cyan); box-shadow: 0 0 0 1px var(--cyan); }
    .join-plan b { display:block; }
    .join-price { display:block; font-family:var(--f-display); font-weight:700; font-size:22px; margin:4px 0; }
    .join-agree { display:flex; gap:10px; align-items:flex-start; max-width:520px; }
  </style>
  <script>
  (function () {
    var f = document.getElementById("joinForm");
    if (!f) return;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var m = document.getElementById("joinMsg");
      var b = f.querySelector("button[type=submit]");
      var email = document.getElementById("joinEmail").value;
      var interval = (f.querySelector("input[name=interval]:checked") || {}).value || "month";
      b.disabled = true;
      m.textContent = "Starting checkout…";
      fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email, interval: interval })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          var j = x.j || {};
          if (j.ok && j.url) { location.href = j.url; return; }
          m.textContent = j.error || "Could not start checkout. Please try again.";
        })
        .catch(function () { m.textContent = "Could not start checkout. Please try again."; })
        .finally(function () { b.disabled = false; });
    });
  })();
  </script>`;

  return html(shell({
    title: "Join ProbaLab Members | ProbaLab",
    description: founding
      ? `Join ProbaLab Members. Founding price US$24/month or US$240/year for the first ${FOUNDING_CAP} members, locked for life.`
      : "Join ProbaLab Members. US$39/month or US$390/year. Cancel any time.",
    path: "/join",
    body,
    signup: false,
  }), 200, 60);
}

export const onRequestHead = async (ctx) => {
  const r = await onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
