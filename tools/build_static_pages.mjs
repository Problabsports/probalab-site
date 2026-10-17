// Builds the static content pages (privacy, terms, contact, 404) with the same shell as the game pages.
// Run: node tools/build_static_pages.mjs   (from the repo root)
import { writeFileSync } from "node:fs";
import { shell } from "../functions/_shared/site.js";

const UPDATED = "17 October 2026";
const EMAIL = `<a href="mailto:hello@probalabsports.com">hello@probalabsports.com</a>`;

const pages = {
  "privacy.html": {
    title: "Privacy Policy | ProbaLab", path: "/privacy",
    description: "How ProbaLab handles personal information.",
    body: `<div class="legal"><h1>Privacy policy</h1><p class="note">Last updated ${UPDATED}</p>
<section class="panel">
<p>ProbaLab (probalabsports.com) publishes sports predictions. This policy explains what personal information we handle and why. We follow the Australian Privacy Principles in the <i>Privacy Act 1988</i> (Cth).</p>
<h2>What we collect</h2>
<ul>
<li><b>No accounts.</b> You can use the whole site without signing up or telling us who you are.</li>
<li><b>Hosting and security logs.</b> Our site is served by Cloudflare. Like any web host, it processes your IP address, browser type and the pages you request, to deliver the site and protect it from abuse. Our prediction data is served from Supabase, which processes similar request data.</li>
<li><b>Fonts.</b> Pages load fonts from Google Fonts, which receives your IP address when the fonts are fetched.</li>
<li><b>Email.</b> If you email us, we keep your email address and message so we can reply.</li>
<li><b>Newsletter.</b> If you subscribe to our newsletter, we keep your email address to send it to you. Every email includes an unsubscribe link, and we never sell or share your address.</li>
</ul>
<h2>Cookies and advertising</h2>
<p>We don't set advertising or tracking cookies today. If we add advertising in future (for example Google AdSense), Google and its partners may use cookies to show and measure ads, including ads based on your visits to this and other sites. Before that happens we'll update this policy and ask for consent where the law requires it. You can control personalised Google ads at <a href="https://adssettings.google.com" rel="nofollow">adssettings.google.com</a>.</p>
<h2>How we use and share information</h2>
<p>We use it only to run the site, reply to you and send emails you've asked for. We don't sell personal information. Our service providers (Cloudflare, Supabase, Google Fonts and, if you subscribe, our newsletter provider) may store data outside Australia, including in the United States.</p>
<h2>Age</h2>
<p>This site is for adults. You must be 18 or over to gamble.</p>
<h2>Your choices</h2>
<p>You can ask to see, correct or delete the personal information we hold about you by emailing ${EMAIL}. If you're unhappy with how we've handled your information, contact us first; you can also complain to the Office of the Australian Information Commissioner at <a href="https://www.oaic.gov.au" rel="nofollow">oaic.gov.au</a>.</p>
<h2>Changes</h2>
<p>We'll post any changes to this policy on this page with a new date.</p>
</section></div>`,
  },
  "terms.html": {
    title: "Terms of Use | ProbaLab", path: "/terms",
    description: "The terms for using ProbaLab's predictions and website.",
    body: `<div class="legal"><h1>Terms of use</h1><p class="note">Last updated ${UPDATED}</p>
<section class="panel">
<p>By using probalabsports.com you agree to these terms.</p>
<h2>Information only, not advice</h2>
<ul>
<li>Our predictions are probabilities from a statistical model. They are for information and entertainment only and are not financial, betting or professional advice.</li>
<li>No prediction is a guarantee. A 70% pick should lose about three times in ten. Past results don't promise future results.</li>
<li>Any decision you make, including any bet, is your own responsibility.</li>
</ul>
<h2>Gambling</h2>
<p>You must be 18 or over to gamble. We don't take bets, and we don't promote or link to any bookmaker. If gambling is causing harm to you or someone you know, call Gambling Help Online on 1800 858 858 or visit <a href="https://www.gamblinghelponline.org.au" rel="nofollow">gamblinghelponline.org.au</a>.</p>
<h2>Accuracy</h2>
<p>We build our numbers from public sports data, including schedules, scores and injury reports. That data can be wrong or late, and our model can be wrong. We publish every pick and its result, win or lose, but we don't promise the site will be accurate, complete or always available.</p>
<h2>Our content</h2>
<p>The predictions, text, design and code on this site belong to ProbaLab. You may share links and quote small parts with credit to ProbaLab. You may not copy the site, scrape it at scale or resell our predictions without written permission. Team and league names belong to their owners; ProbaLab is not affiliated with the NBA, the NFL, any team or any bookmaker.</p>
<h2>Liability</h2>
<p>To the extent the law allows, ProbaLab is not liable for any loss arising from your use of the site or reliance on its predictions. Nothing in these terms excludes rights you have under the Australian Consumer Law that can't be excluded.</p>
<h2>Changes and law</h2>
<p>We may update these terms by posting a new version here. These terms are governed by the laws of Victoria, Australia.</p>
<h2>Contact</h2>
<p>${EMAIL}</p>
</section></div>`,
  },
  "contact.html": {
    title: "Contact | ProbaLab", path: "/contact",
    description: "Get in touch with ProbaLab.",
    body: `<div class="legal"><h1>Contact</h1>
<section class="panel">
<p>Email ${EMAIL}. We read every message and usually reply within two working days.</p>
<h2>Good reasons to write</h2>
<ul>
<li>A result, score or injury status on the site looks wrong.</li>
<li>Something on the site doesn't work on your device.</li>
<li>Questions about how the model or our record works.</li>
<li>Privacy requests, such as deleting your email address.</li>
</ul>
<p>We can't give personal betting advice or tell you what to bet.</p>
<p class="note">Need help with gambling? Call Gambling Help Online on 1800 858 858 (24/7) or visit <a href="https://www.gamblinghelponline.org.au" rel="nofollow">gamblinghelponline.org.au</a>.</p>
</section></div>`,
  },
  "404.html": {
    title: "Page not found | ProbaLab", path: "/404", noindex: true,
    description: "This page doesn't exist.",
    body: `<h1>Page not found</h1><section class="panel"><p>That page doesn't exist.</p><p><a href="/nba">NBA predictions</a> · <a href="/nfl">NFL predictions</a> · <a href="/">Home</a></p></section>`,
  },
};

for (const [file, p] of Object.entries(pages)) {
  writeFileSync(new URL(`../${file}`, import.meta.url), shell(p));
  console.log("wrote", file);
}
