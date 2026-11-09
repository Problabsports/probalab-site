// /about: About ProbaLab. Record figures are loaded live from the same source as /results.
import { shell, html, esc, ORIGIN, asHead } from "./_shared/site.js";
import { loadSportRecord, lightTally } from "./_shared/record-pages.js";
const BOOKS = [
  ["Sprawlball: A Visual Tour of the New Era of the NBA", "Kirk Goldsberry", "https://www.amazon.com/dp/0358329752?tag=altafgroupus-20", "How shot location changed the modern NBA."],
  ["Basketball on Paper: Rules and Tools for Performance Analysis", "Dean Oliver", "https://www.amazon.com/dp/1574886886?tag=altafgroupus-20", "The book that set out the Four Factors many basketball models still use."],
];
const wl = (w, n) => (n ? `${w} from ${n}` : "no finished picks yet");
const pct = (w, n) => (n ? `${Math.round((100 * w) / n)}%` : "—");

export async function onRequestGet(ctx) {
  const nba = await loadSportRecord(ctx, "nba");
  const rows = nba.error ? [] : (nba.rows || []);
  const g = lightTally(rows, "GREEN");
  const allW = rows.filter((r) => r.won).length;
  const allN = rows.length;
  const greenLine = g.n ? `${wl(g.w, g.n)} (${pct(g.w, g.n)})` : "no finished green picks yet";
  const allLine = allN ? `${wl(allW, allN)} (${pct(allW, allN)})` : "no finished games yet";
  const title = "About ProbaLab | Free NBA win probabilities with a public record";
  const description = "ProbaLab is a free sports prediction site. Every NBA game gets a win probability from our own data model, and every pick stays on the public record.";
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>About</span></nav>
<h1>About ProbaLab</h1>
<section class="panel prose"><h2>Our GREEN picks are ${esc(greenLine)} this NBA season</h2>
<p>ProbaLab is a free sports prediction site. Every NBA game gets a win probability from our own data model, and the strongest picks are marked GREEN. So far this season, ${g.n ? `${g.w} of our ${g.n} GREEN picks have won (${esc(pct(g.w, g.n))})` : "we have no finished green picks yet"}. Across every NBA game we have called, we are ${esc(allLine)}.</p>
<p>Those numbers include the misses and come from the same source as our <a href="/results?sport=nba">Results</a> page. Nothing gets removed from the record.</p></section>
<section class="panel prose"><h2>What ProbaLab does</h2>
<p>The model rates every player from recent box scores, reads the live injury report, and blends team strength, form and schedule into one number for each game. That number is the chance we give each team to win.</p>
<p>Picks are timestamped before game time and then frozen. When the game finishes, the result goes on the record, right or wrong.</p>
<p>We publish probabilities, not certainties. A 70% pick still loses about three times in ten, and we want you to see that happen in the record rather than hear about it later.</p></section>
<section class="panel prose"><h2>What the lights mean</h2>
<p>Every pick carries a light, so you can see at a glance how strongly the model leans.</p>
<ul><li><b>SUPER</b> — Super, best value (NBA only): a value flag, not a higher-confidence green. The bookmaker price beats our fair price. <a href="/lights">How the lights work</a>.</li>
<li><b>GREEN</b>: The model gives the pick 65% or more. One of our top picks.</li>
<li><b>ORANGE</b>: A lean, 55 to 65%.</li>
<li><b>RED</b>: Under 55%. Close to a coin flip.</li></ul></section>
<section class="panel prose"><h2>How we check ourselves</h2>
<p>Our <a href="/results">results page</a> shows every finished game. We also track calibration: if the model says 70%, those picks should win about 70% of the time. Past-season tests, kept separate from the live record, are on the <a href="/backtest">backtest page</a>. The method is explained on <a href="/how-it-works">How it works</a>.</p></section>
<section class="panel prose"><h2>What we cover</h2>
<p>NBA is our main focus, and every game is on the site with its own page. We also publish NFL, NHL, Premier League, Championship and tennis predictions.</p>
<p>ProbaLab is free to use and is supported by advertising.</p></section>
<section class="panel prose reading"><h2>Further reading</h2><ul>
${BOOKS.map(([t, a, u, b]) => `<li><a href="${esc(u)}" rel="sponsored nofollow noopener" target="_blank">${esc(t)}</a>, ${esc(a)} (paid link). ${esc(b)}</li>`).join("\n")}
</ul><p class="small">Links marked (paid link) earn us a small commission.</p></section>
<p class="note">18+. For free and confidential support call 1800 858 858 or visit gamblinghelponline.org.au</p>`;
  return html(shell({ title, description, path: "/about", body, jsonld: { "@context": "https://schema.org", "@type": "AboutPage", name: "About ProbaLab", url: `${ORIGIN}/about`, description } }));
}
export const onRequestHead = (ctx) => asHead(onRequestGet, ctx);
