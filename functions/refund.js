// /refund — membership refund and cancellation policy.
import { shell, html, ORIGIN } from "./_shared/site.js";

export function onRequestGet() {
  const title = "Refunds | ProbaLab";
  const description = "How ProbaLab Members subscriptions are billed, cancelled, and refunded, including 18+ and responsible gambling information.";
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Refunds</span></nav>
<p class="eyebrow">// refunds</p>
<h1>Refunds and cancellation</h1>
<section class="panel prose">
  <p>This page covers paid ProbaLab Members subscriptions. The public site is free. Membership is <b>18+ only</b>. Predictions are for entertainment, not advice. If you gamble, stake only what you can afford to lose. Read our <a href="/responsible-gambling">responsible gambling</a> commitment.</p>
</section>
<section class="panel prose">
  <h2>How billing works</h2>
  <ul>
    <li>Subscriptions are priced in US dollars and billed through Stripe.</li>
    <li>The founding price of US$24/month or US$240/year is for the first 10 members and stays locked for as long as that subscription remains active.</li>
    <li>After those 10 founding subscriptions, new members are offered the standard prices of US$39/month or US$390/year.</li>
    <li>If a founding member cancels and later rejoins after the founding offer has closed, the standard price applies.</li>
  </ul>
</section>
<section class="panel prose">
  <h2>Cancellation</h2>
  <p>You can cancel at any time from <a href="/members/billing">Manage billing</a>, or by emailing <a href="mailto:hello@probalabsports.com">hello@probalabsports.com</a>. Cancellation takes effect at the end of the period you have already paid for. You keep access until then. We do not prorate unused time, except where the Australian Consumer Law requires otherwise.</p>
</section>
<section class="panel prose">
  <h2>Refunds</h2>
  <p>Membership is a digital service that starts as soon as payment succeeds (desks, Discord access and the members newsletter). We do not offer change-of-mind refunds as a matter of course. Nothing on this page limits rights you have under the Australian Consumer Law that cannot be excluded. If the service is not provided as described, or something has gone wrong with billing, email <a href="mailto:hello@probalabsports.com">hello@probalabsports.com</a> and we will look at it promptly.</p>
</section>
<section class="panel prose">
  <h2>Get help</h2>
  <p>If gambling is causing harm for you or someone you know, call <a href="tel:1800858858">1800 858 858</a> or visit <a href="https://www.gamblinghelponline.org.au" rel="noopener" target="_blank">gamblinghelponline.org.au</a>. You can also use <a href="https://www.betstop.gov.au" rel="noopener" target="_blank">BetStop</a>, the national self-exclusion register.</p>
</section>
<p class="note">See also our <a href="/terms">Terms</a> and <a href="/privacy">Privacy policy</a>.</p>`;
  return html(shell({
    title,
    description,
    path: "/refund",
    body,
    jsonld: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      url: `${ORIGIN}/refund`,
      description,
    },
  }));
}
export const onRequestHead = async (ctx) => {
  const r = onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
