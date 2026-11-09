// /faq: short FAQ aligned with /lights. No betting advice.
import { shell, html, ORIGIN } from "./_shared/site.js";

export function onRequestGet() {
  const title = "FAQ | ProbaLab";
  const description = "Short answers about ProbaLab lights, results, Super best-value picks, and how the public record works.";
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>FAQ</span></nav>
<p class="eyebrow">// faq</p>
<h1>Frequently asked questions</h1>
<section class="panel prose">
  <h2>What is ProbaLab?</h2>
  <p>ProbaLab publishes a win chance for every game we cover. Picks are posted before the start, frozen when the game begins, and kept on a public record — wins and losses both.</p>
</section>
<section class="panel prose">
  <h2>What do the lights mean?</h2>
  <p>Green, orange and red show how strongly the model leans. Cut-offs differ by sport: 65%+ green in the NBA, NFL and NHL; 55%+ in the Premier League and Championship; 70%+ in tennis. <a href="/lights">How the lights work</a> explains each scale.</p>
</section>
<section class="panel prose">
  <h2>What is Super — best value?</h2>
  <p>Super is an NBA-only value flag, not a higher-confidence green. It marks a pick where the bookmaker price beats our fair price under the rules on the lights page. Other sports do not use Super.</p>
</section>
<section class="panel prose">
  <h2>Where is the track record?</h2>
  <p>The <a href="/results">Results</a> page shows finished picks across every sport, with green first. Orange and red stay on the record too — nothing is deleted.</p>
</section>
<section class="panel prose">
  <h2>Is this betting advice?</h2>
  <p>No. The figures are for entertainment. We publish probabilities, not guarantees. A 70% pick is still meant to miss about three times in ten.</p>
</section>
<section class="panel prose">
  <h2>How do I get the newsletter?</h2>
  <p>Use the signup form on the <a href="/#newsletter">home page</a>. Free emails go out twice a week with predictions and results.</p>
</section>
<section class="panel prose">
  <h2>Who can join Members?</h2>
  <p>Members is invite-only while tipsters prove their records. You can <a href="/members">sign in or join the waitlist</a>.</p>
</section>
<p class="note">18+. For free and confidential support call 1800 858 858 or visit gamblinghelponline.org.au</p>`;
  return html(shell({
    title,
    description,
    path: "/faq",
    body,
    jsonld: { "@context": "https://schema.org", "@type": "FAQPage", name: "ProbaLab FAQ", url: `${ORIGIN}/faq`, description },
  }));
}
export const onRequestHead = async (ctx) => {
  const r = onRequestGet(ctx);
  return new Response(null, { status: r.status, headers: r.headers });
};
