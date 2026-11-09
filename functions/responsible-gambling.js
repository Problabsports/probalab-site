// /responsible-gambling: ProbaLab statement of commitment (original wording).
import { shell, html, ORIGIN } from "./_shared/site.js";

export function onRequestGet() {
  const title = "Responsible gambling | ProbaLab";
  const description = "ProbaLab's commitment to responsible gambling: we publish predictions, we are not a bookmaker, and we promote help services for anyone who needs support.";
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Responsible gambling</span></nav>
<p class="eyebrow">// responsible gambling</p>
<h1>Our commitment to responsible gambling</h1>
<section class="panel prose">
  <p>ProbaLab publishes probabilities and predictions for sports. We are <b>not a bookmaker</b>, we do not take bets, and we do not offer wagering accounts. The figures on this site are for entertainment. They are not financial advice and they are not a recommendation to bet.</p>
  <p><b>18+ only.</b> If you are under 18, please leave this site.</p>
</section>
<section class="panel prose">
  <h2>Gambling involves risk</h2>
  <p>Anyone who chooses to gamble can lose money. Predictions are not guarantees. A high win chance can still lose, and past results do not guarantee future results. Never stake money you cannot afford to lose.</p>
</section>
<section class="panel prose">
  <h2>What responsible gambling means</h2>
  <ul>
    <li>Gamble only for entertainment, not as a way to make money.</li>
    <li>Stay in control of time and spend.</li>
    <li>Set personal limits before you start, and stick to them.</li>
    <li>Do not chase losses.</li>
    <li>Take a break if gambling stops being fun.</li>
  </ul>
</section>
<section class="panel prose">
  <h2>Our commitments</h2>
  <ul>
    <li>We do not glorify excessive gambling or portray betting as a path to wealth.</li>
    <li>We publish an honest public record of our picks, including losses — nothing is deleted to make the model look better.</li>
    <li>Every page carries a clear responsible-gambling message and a path to help.</li>
    <li>We promote free, confidential help services for people who need support.</li>
  </ul>
</section>
<section class="panel prose">
  <h2>Get help</h2>
  <p>If gambling is causing harm for you or someone you know, free and confidential support is available in Australia:</p>
  <ul>
    <li><a href="https://www.gamblinghelponline.org.au" rel="noopener" target="_blank">Gambling Help Online</a> — or call <a href="tel:1800858858">1800 858 858</a></li>
    <li><a href="https://www.betstop.gov.au" rel="noopener" target="_blank">BetStop</a> — the national self-exclusion register</li>
  </ul>
  <p class="small">Outside Australia, look for your local gambling-support service or speak with a health professional.</p>
</section>
<p class="note">Questions about this page? <a href="/contact">Contact us</a>. See also the <a href="/faq">FAQ</a> and <a href="/terms">Terms</a>.</p>`;
  return html(shell({
    title,
    description,
    path: "/responsible-gambling",
    body,
    jsonld: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Responsible gambling | ProbaLab",
      url: `${ORIGIN}/responsible-gambling`,
      description,
    },
  }));
}
export const onRequestHead = async (ctx) => {
  const r = onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
