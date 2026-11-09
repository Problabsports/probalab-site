// Shared copy and figures for /how-it-works and /backtest.
// Every backtest figure traces to a file listed in FIGURE_SOURCES. Do not invent replacements.
import { shell, ORIGIN, chip } from "./site.js";

export const FIGURE_SOURCES = {
  nbaWalk: "betting/models/nba/elo_netrtg/v2/backtest_predictions_v2.csv joined to v1/backtest_predictions.csv (results and, where present, closing money-line prices). Walk-forward v2 (H2).",
  nbaPrereg: "betting/models/nba/elo_netrtg/v2/preregistration.json and README.md (selection 2008-18, SBR holdout to 16 Jan 2023, Pinnacle 2024-26 scored once).",
  nbaSuperPublished: "Already published on /lights and in nba-collect case-against copy: 2025-26 test of 162 Super games, 63% wins, +0.7% vs close, staking about break-even (−0.3%). Original worksheet not found as a standalone file; a later price dump did not reproduce 162 exactly, so the published figures are used unchanged, with that caveat.",
  nbaGreenCollector: "nba-collect case-against copy (78% of 2025-26 greens won; backing every one lost about 1.8%). Consistent with ops/20261110_held_value_recheck/_hist_super.json at late Pinnacle: 546/697 = 78.3%, −11.70u, −1.7% ROI. The research walk-forward file has the same 697 greens but 536 wins (76.9%) and no 2023-26 closes.",
  nflWalk: "betting/models/nfl/epa_elo/v2/backtest_predictions_v2.csv (p, home_win, season). Closing decimal prices joined by game_id from v3/backtest_predictions_v3.csv (Home/Away Odds Close). v2 is the live NFL model. Pre-registered windows in v2/backtest_results.json: validation 2016-22, holdout 2023-26.",
  eplJson: "probalab-site/data/epl-backtest.json (match counts and 'model right'). Independently matched to betting/probalab-epl/backtest/epl_walk.csv.",
  eplWalkLights: "Green rates at the current 55% cut-off computed from epl_walk.csv probabilities (the walk file's own light column uses the older 60% cut-off in epl_model.mjs). Clean test is 2023-24 to 2025-26, as stated in epl-backtest.json.",
  eplWriteup: "betting/probalab-epl/backtest/SUMMARY.md and results.md; model: epl_model.mjs (results + shots on target; settings tuned on 2021-22 and 2022-23).",
  champJson: "probalab-site/data/championship-backtest.json. No walk-forward CSV was found to re-derive the light column. Live Championship green is 55%+; the file does not record which cut-off produced its green counts.",
  nhlWalk: "Overall n/c in probalab-site/data/nhl-backtest.json match betting/probalab-epl/backtest/nhl_walk.csv exactly. Green rates on this page use the current 65%/55% lights on that walk file. The site JSON's light columns use a 60% green cut-off and fold everything else into orange (no reds) — those columns are not used here.",
  nhlModel: "betting/probalab-epl/backtest/nhl_model.mjs (results + shots on goal; settings tuned on 2021-22 and 2022-23, tested on 2023-24 to 2025-26).",
  tennisJson: "probalab-site/data/tennis-backtest.json (walk-forward; logistic fitted on 2009-2020, never saw 2021-2026). Also shown on the tennis Stats tab.",
};

const pct = (w, n) => `${((100 * w) / n).toFixed(1)}%`;
const frac = (w, n) => `${w.toLocaleString("en-AU")} of ${n.toLocaleString("en-AU")} (${pct(w, n)})`;
const units = (u, n) => `${u.toFixed(1)}u · ${u >= 0 ? "+" : ""}${((100 * u) / n).toFixed(1)}% ROI`;

function seasonTable(headers, rows) {
  return `<div class="tablewrap"><table class="cal">
    <thead><tr>${headers.map((h) => `<th${h.n ? ' class="n"' : ""}>${h.t}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${headers[i].n ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

export function renderHowItWorksPage() {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>How it works</span></nav>
  <p class="eyebrow">// method</p>
  <h1>How it works</h1>
  <p>ProbaLab publishes a win chance for every game we cover, from our own models. Picks are timestamped before the start, frozen when the game begins, and kept on a public record — wins and losses both. This page is the method. <a href="/lights">How the lights work</a> is the short guide to the colours. <a href="/backtest">Backtest</a> is the past-season testing, kept separate from the <a href="/results">live results</a>.</p>

  <section class="panel prose">
    <h2>What the model does</h2>
    <p>Each sport has its own model. None of them “knows” the result of the game they are pricing. Ratings and features are built from information that was already available before that game started.</p>

    <h3>NBA</h3>
    <p>The model rates every player from recent box scores, weighted toward recent games. Before tip-off it reads the official injury report, works out the minutes each side is likely to play, and turns that into a team strength for tonight. That is blended with a long-run team rating, recent team strength, rest, back-to-backs, travel and a home-court edge that has declined over the years, to give each side a win probability. Super — best value, described below — is an NBA-only flag on top of that number.</p>

    <h3>NFL</h3>
    <p>The model rates every team from results and winning margins, adds a measure of how efficiently they move the ball (expected points), then home field and rest, and checks who is expected to start at quarterback. A backup or an inexperienced starter counts against that team. Picks can go up as early as a week before kick-off and update as quarterback news comes in, then freeze at kick-off.</p>

    <h3>NHL</h3>
    <p>Team ratings come from official results and shots on goal. They move after each game, shrink a little toward average between seasons, and a back-to-back is a small penalty. Every game is priced from earlier dates’ results only. The pick is which team wins the game, including overtime and shootouts.</p>

    <h3>Premier League</h3>
    <p>The model keeps attack and defence ratings from results and shots on target, and starts newly promoted sides a little below average. It publishes three chances — home, draw and away — and the pick is the most likely of those three. The settings were chosen on 2021–22 and 2022–23; later seasons are a clean test, as the <a href="/backtest">backtest page</a> sets out.</p>

    <h3>Championship</h3>
    <p>The same settings as the Premier League model, never retuned on Championship results. 2019–20 is used only to warm up the ratings. Again the pick is the most likely of home, draw and away.</p>

    <h3>Tennis</h3>
    <p>Every player has a rating that moves after each match, overall and on each surface (hard, clay, grass), built from more than 100,000 ATP and WTA results since 2005. Beating a strong player moves it more than beating a weak one; a retirement counts for half. The win chance blends the two players’ overall and surface ratings, their ranking, and whether the match is best of five. Picks refresh until the first serve. The final step of the model was fitted on 2009–2020 and was not shown the 2021–2026 matches used in the backtest.</p>
  </section>

  <section class="panel prose">
    <h2>How the lights work</h2>
    <p>Every pick gets a coloured light so you can see, at a glance, how strongly the model rates its own call. The cut-offs are not the same in every sport, and that is deliberate. We do not move them to chase a short run of results. The short page — <a href="/lights">How the lights work</a> — is the reference. In brief:</p>
    <div class="lights">
      <div><span>${chip("SUPER")}</span><p>Super — best value. NBA only. A value flag, not a higher-confidence green.</p></div>
      <div><span>${chip("GREEN")}</span><p>65%+ in the NBA, NFL and NHL; 55%+ in the Premier League and Championship (a draw is possible); 70%+ in tennis.</p></div>
      <div><span>${chip("ORANGE")}</span><p>A lean: 55–65% in the NBA, NFL and NHL; 45–55% in football; 60–70% in tennis.</p></div>
      <div><span>${chip("RED")}</span><p>Below that. In a two-way sport this is close to a coin flip; in tennis a red light is a genuinely tight match.</p></div>
    </div>
    <p>Super is different. An NBA pick only gets Super when the model is at least 60% on the side, that chance is at least 3 points above the sharp market’s no-margin price, and the best Australian bookmaker price is at least 3% better than our fair price (with a cap on how large that gap can be).</p>
    <p>If key players are listed as uncertain, a value pick is held back. It keeps its normal confidence light — so a 63% pick stays orange — and we add a note that it would have been Super except for those injuries. We do not promote a held pick to Super, because the Super test knew the real line-ups.</p>
  </section>

  <section class="panel prose">
    <h2>When picks are published</h2>
    <p>Every pick is timestamped before the start and can still update until then, as injuries, quarterbacks or prices change. It is frozen when the game begins (at first serve in tennis). The frozen chance is the one that goes on the record. Lights are not changed after the result.</p>
    <p>The price we show next to a finished pick is the best Australian bookmaker price at our last check before the start — by 7am Sydney time on the day, and at least an hour before. “Vs close” compares that price with the fair closing price (the sharp market’s last price, with the margin removed). Above zero means the price you could get beat the market’s final view.</p>
  </section>

  <section class="panel prose">
    <h2>How results are graded</h2>
    <p>The <a href="/results">Results</a> page is the live record: only picks that were timestamped and frozen before the start. Green leads, but orange and red stay on the page. Nothing is deleted because it lost. You can <a href="/results.csv">download the CSV</a> and check every pick yourself, including the posted time and the vs-close column where we have a price.</p>
    <p>We also publish <a href="/accuracy">calibration</a> — if the model says 70%, those picks should win about 70% of the time. Past-season tests of the same idea live on the <a href="/backtest">backtest page</a>. They are not added into the live green totals or the figures on the home page.</p>
  </section>

  <section class="panel prose">
    <h2>What we don’t claim</h2>
    <ul class="reading">
      <li>These figures are for entertainment, not betting advice, and they are not a guarantee. A 70% pick is still meant to miss about three times in ten.</li>
      <li>A light is not a staking plan. Green is about confidence. Super is about price. Backing every green pick is not the same as backing Super.</li>
      <li>A backtest is a re-run on the past, not a record of tips we published at the time. It can look tidier than live results. That is why it has its own page.</li>
      <li>We do not claim to be the best, the most accurate, or to have a long public live record. The live site is recent. The backtests are how we tested the models before that.</li>
    </ul>
    <p><a href="/results">Live results →</a> · <a href="/backtest">Backtest — not live results →</a> · <a href="/lights">How the lights work →</a> · <a href="/faq">FAQ →</a></p>
  </section>
  <p class="note">18+. For free and confidential support call 1800 858 858 or visit gamblinghelponline.org.au</p>`;

  return shell({
    title: "How it works | ProbaLab",
    description: "How ProbaLab’s models work in the NBA, NFL, NHL, Premier League, Championship and tennis; how the lights are set; and how picks are timestamped, frozen and graded.",
    path: "/how-it-works",
    body,
    jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "How it works", url: `${ORIGIN}/how-it-works`, description: "How ProbaLab’s prediction models, lights and public record work." },
  });
}

export function renderBacktestPage() {
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Backtest</span></nav>
  <p class="eyebrow">// backtest · not the live record</p>
  <h1>Backtest — not live results</h1>
  <section class="panel banner-backtest">
    <h2>This is a re-run on past games, not the live record</h2>
    <p>Every number on this page is a historical test of the model, using only information that would have been available before that game started. It is <b>not</b> a record of tips we published at the time, and it is never added into the green totals on <a href="/results">Results</a> or the home page. For the timestamped, frozen record, go to Results and download the <a href="/results.csv">CSV</a>.</p>
  </section>

  <section class="panel prose caveats">
    <h2>How to read this page</h2>
    <ul class="reading">
      <li>Walk-forward or out-of-sample only. Settings chosen on earlier seasons are called out. In-sample or tuning years are shown separately, or left out of the headline.</li>
      <li>Green hit rate uses each sport’s current public cut-off, except the Championship, where we only have the green column already stored in the published backtest file (see that section).</li>
      <li>Units, where we show them, are flat 1 unit on every qualifying pick at the closing (or recorded close) price. A negative figure means that set of picks lost money at the close. We do not invent a price when the file does not have one — those sports say so.</li>
      <li>Backtests can overstate what happens live. They may use cleaner line-ups, ignore delays in news, or be kinder than a real bookmaker’s price. Past results do not guarantee future results.</li>
      <li>Losing seasons stay on the tables.</li>
    </ul>
  </section>

  <section class="panel prose" id="nba">
    <h2>NBA</h2>
    <p>The live NBA model (v2) was tested walk-forward: each game is priced from earlier games only. The 2008–09 to 2017–18 seasons were used to choose the version. A later holdout, and a 2025–26 season test, were scored after that. Headline figures below are the completed 2025–26 season — the same window the site already cites for calibration — plus the priced holdout, where closing prices exist.</p>
    <p><b>2025–26, 1,322 games:</b> the model picked the winner in ${frac(895, 1322)}. Games it gave 70–75% won ${frac(100, 136)}. Green picks (65%+) won ${frac(536, 697)}. That walk-forward file has no closing prices for 2023–26, so we do not report units for this season from it.</p>
    <p>A separate, already published Super test on 2025–26 — the one quoted on <a href="/lights">How the lights work</a> — looked at 162 Super games: they won 63%, beat the close by about +0.7%, and staking return was about break-even (−0.3%). That test knew the real line-ups. Live Super still depends on the injury report being right, which is why a value pick with uncertain key players is held at its normal light.</p>
    <p>Closing prices are in the older SBR-matched window (2018–19 through 16 January 2023, 5,613 games). Backing every green pick at the close in that window: 2,139 of 2,938 won (72.8%), ${units(-142.14, 2938)}. That is the honest priced sample we have: greens win often, and still lost money at the close, because they are confidence picks, not value picks.</p>
    <p class="small">Sources: ${FIGURE_SOURCES.nbaWalk} ${FIGURE_SOURCES.nbaPrereg} Super figures: ${FIGURE_SOURCES.nbaSuperPublished}</p>
  </section>

  <section class="panel prose" id="nfl">
    <h2>NFL</h2>
    <p>The live NFL model is v2. It was scored walk-forward on 2016 through early 2026. <b>2016–22</b> (1,896 games) was the validation window used to choose the version, so it is not the headline. The clean test is the <b>2023–26 holdout</b> (919 games, including 65 games of 2026 so far).</p>
    <p><b>Holdout 2023–26:</b> the model picked the winner in ${frac(592, 919)}. Games it gave 70–75% won ${frac(91, 123)}. Green picks (65%+) won ${frac(316, 441)}. Where a closing money-line was on file, backing every green pick at that close: 315 of 433 won (72.7%), ${units(-11.90, 433)}. Again, green is a confidence light — the close was not a value price on every green.</p>
    <p>For comparison, the 2021–2025 seasons already mentioned on the site (a mix of validation and holdout): ${frac(915, 1420)} of all picks, and ${frac(132, 177)} in the 70–75% band. That all-picks figure is 64.4%, which the site has rounded to 65%. The file-traced numbers are the ones in this table.</p>
    ${seasonTable(
      [{ t: "Window" }, { t: "Picks", n: 1 }, { t: "Right", n: 1 }, { t: "Green 65%+", n: 1 }, { t: "Green units at close", n: 1 }],
      [
        ["Validation 2016–22 (not the headline)", "1,896", "1,242 (65.5%)", "704/963 (73.1%)", units(-13.50, 963)],
        ["Holdout 2023–26", "919", "592 (64.4%)", "316/441 (71.7%)", "315 priced: " + units(-11.90, 433)],
        ["2021–2025 (mixed window)", "1,420", "915 (64.4%)", "498/694 (71.8%)", "687 priced: " + units(-24.18, 687)],
      ]
    )}
    <p class="small">Source: ${FIGURE_SOURCES.nflWalk}</p>
  </section>

  <section class="panel prose" id="nhl">
    <h2>NHL</h2>
    <p>Walk-forward on official results, one game date at a time. Settings were chosen on 2021–22 and 2022–23; <b>2023–24 to 2025–26</b> are the clean test (4,192 games). Lights below use the current public cut-off (green at 65%+), applied to the same walk-forward probabilities. There are no closing prices in the walk file, so units are not reported — coming when we have a trustworthy priced sample.</p>
    <p><b>Clean test 2023–26:</b> the model picked the winner in ${frac(2414, 4192)}. Green picks won ${frac(609, 867)}. 2025–26 was the weakest season in the test (751 of 1,394, 53.9%), and that season stays in the table.</p>
    ${seasonTable(
      [{ t: "Season" }, { t: "Games", n: 1 }, { t: "Model right", n: 1 }, { t: "Green 65%+", n: 1 }, { t: "Notes" }],
      [
        ["2021–22", "1,401", "885 (63.2%)", "269/375 (71.7%)", "Used to choose settings"],
        ["2022–23", "1,400", "840 (60.0%)", "273/385 (70.9%)", "Used to choose settings"],
        ["2023–24", "1,400", "844 (60.3%)", "251/363 (69.1%)", "Clean test"],
        ["2024–25", "1,398", "819 (58.6%)", "202/281 (71.9%)", "Clean test"],
        ["2025–26", "1,394", "751 (53.9%)", "156/223 (70.0%)", "Clean test"],
        ["2023–26 combined", "4,192", "2,414 (57.6%)", "609/867 (70.2%)", "Headline"],
        ["2026–27 (to late Oct)", "165", "101 (61.2%)", "24/40 (60.0%)", "Partial season; small sample"],
      ]
    )}
    <p class="small">Source: ${FIGURE_SOURCES.nhlWalk} ${FIGURE_SOURCES.nhlModel}</p>
  </section>

  <section class="panel prose" id="epl">
    <h2>Premier League</h2>
    <p>Walk-forward, match by match from earlier days’ results only (2020–21 used to warm up the ratings). <b>2021–22 and 2022–23</b> were used to choose the settings, so they flatter the model a little. <b>2023–24 to 2025–26</b> (1,140 matches) are the clean test. Green rates below use the current public cut-off of 55%+, recomputed from the walk-forward chances. (The walk file’s own light column still uses the older 60% cut-off; we do not quote that as the live green rule.)</p>
    <p><b>Clean test 2023–26:</b> the model was right in ${frac(602, 1140)}. Green picks (55%+) won ${frac(274, 406)}. 2025–26 was a poor season for all picks (185 of 380, 48.7%) and is kept in the test. With three possible results, about half right is a normal season; draws are the hardest to call.</p>
    <p>The walk file has market-implied closing probabilities, not bookmaker payout prices, so we do not report units. Coming when we have a trustworthy priced sample.</p>
    ${seasonTable(
      [{ t: "Season" }, { t: "Matches", n: 1 }, { t: "Model right", n: 1 }, { t: "Green 55%+", n: 1 }, { t: "Notes" }],
      [
        ["2021–22", "380", "213 (56.1%)", "106/144 (73.6%)", "Used to choose settings"],
        ["2022–23", "380", "198 (52.1%)", "90/137 (65.7%)", "Used to choose settings"],
        ["2023–24", "380", "219 (57.6%)", "121/169 (71.6%)", "Clean test"],
        ["2024–25", "380", "198 (52.1%)", "94/140 (67.1%)", "Clean test"],
        ["2025–26", "380", "185 (48.7%)", "59/97 (60.8%)", "Clean test"],
        ["2023–26 combined", "1,140", "602 (52.8%)", "274/406 (67.5%)", "Headline"],
        ["2026–27 (to mid-Oct)", "70", "29 (41.4%)", "15/19 (78.9%)", "Partial season; small sample"],
      ]
    )}
    <p class="small">Sources: ${FIGURE_SOURCES.eplJson} ${FIGURE_SOURCES.eplWalkLights} ${FIGURE_SOURCES.eplWriteup}</p>
  </section>

  <section class="panel prose" id="championship">
    <h2>Championship</h2>
    <p>Past-season re-run with the same settings as the Premier League model, never tuned on Championship data. 2019–20 was used only to warm up the ratings. 2021–22 to 2025–26: ${frac(1294, 2760)} of all picks. The green column stored in the published backtest file is ${frac(347, 579)}. We could not find a walk-forward CSV to confirm which cut-off produced that green column, so we report it as stored rather than re-colour it. Live Championship green on the site is 55%+. No prices are in the file; units are coming when we have them.</p>
    ${seasonTable(
      [{ t: "Season" }, { t: "Matches", n: 1 }, { t: "Model right", n: 1 }, { t: "Green (file)", n: 1 }],
      [
        ["2021–22", "552", "257 (46.6%)", "72/114 (63.2%)"],
        ["2022–23", "552", "257 (46.6%)", "58/106 (54.7%)"],
        ["2023–24", "552", "266 (48.2%)", "89/141 (63.1%)"],
        ["2024–25", "552", "268 (48.6%)", "74/125 (59.2%)"],
        ["2025–26", "552", "246 (44.6%)", "54/93 (58.1%)"],
        ["2021–26 combined", "2,760", "1,294 (46.9%)", "347/579 (59.9%)"],
      ]
    )}
    <p>With three results and a draw about one match in four, under half right is normal for this league. 2025–26 was the weakest of the five seasons and stays in the total.</p>
    <p class="small">Source: ${FIGURE_SOURCES.champJson}</p>
  </section>

  <section class="panel prose" id="tennis">
    <h2>Tennis</h2>
    <p>Walk-forward re-run of ATP and WTA main-draw matches, January 2021 to November 2026. Ratings were built match by match from earlier results only. The final step (a logistic regression) was fitted on 2009–2020 and never saw these matches.</p>
    <p><b>30,189 matches:</b> the model picked the winner in ${frac(19669, 30189)}. Green picks (70%+) won ${frac(8017, 10225)}. Orange (60–70%) won 5,765 of 9,103 (63.3%); red (under 60%) won 5,887 of 10,861 (54.2%). In tennis the favourite wins often, so a red light really does mean a close match. The model’s average stated chance was 66.0%, against 65.2% actual — close, and slightly cautious.</p>
    ${seasonTable(
      [{ t: "Season" }, { t: "Matches", n: 1 }, { t: "Right", n: 1 }, { t: "Green 70%+", n: 1 }],
      [
        ["2021", "4,888", "3,189 (65.2%)", "1,287/1,620 (79.4%)"],
        ["2022", "4,963", "3,253 (65.5%)", "1,332/1,690 (78.8%)"],
        ["2023", "5,163", "3,352 (64.9%)", "1,377/1,805 (76.3%)"],
        ["2024", "5,214", "3,394 (65.1%)", "1,373/1,725 (79.6%)"],
        ["2025", "5,040", "3,249 (64.5%)", "1,329/1,721 (77.2%)"],
        ["2026 (to Nov)", "4,921", "3,232 (65.7%)", "1,319/1,664 (79.3%)"],
        ["ATP", "15,562", "10,096 (64.9%)", "4,333/5,575 (77.7%)"],
        ["WTA", "14,627", "9,573 (65.4%)", "3,684/4,650 (79.2%)"],
        ["Australian Open 2026 replay", "252", "182 (72.2%)", "119/140 (85.0%)"],
      ]
    )}
    <p>No closing prices are stored in the backtest file, so units are not reported here. Live tennis results show vs-close only on events that had an Australian bookmaker price.</p>
    <p class="small">Source: ${FIGURE_SOURCES.tennisJson}</p>
  </section>

  <section class="panel prose">
    <h2>What this page is not</h2>
    <p>It is not the live record, not a promise of future results, and not betting advice. If a sport has no trustworthy priced backtest, we leave units off rather than invent them. The official member-facing record, once you are looking at tips, remains the timestamped Results page and its CSV.</p>
    <p><a href="/results">Live results →</a> · <a href="/how-it-works">How it works →</a> · <a href="/lights">How the lights work →</a> · <a href="/accuracy">Live calibration →</a></p>
  </section>
  <p class="note">18+. For free and confidential support call 1800 858 858 or visit gamblinghelponline.org.au</p>`;

  return shell({
    title: "Backtest — not live results | ProbaLab",
    description: "Walk-forward and out-of-sample tests of ProbaLab’s models, kept separate from the live timestamped record. Includes losing seasons, sample sizes, and units only where closing prices exist.",
    path: "/backtest",
    body,
    jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "Backtest — not live results", url: `${ORIGIN}/backtest`, description: "Historical walk-forward tests of ProbaLab models, labelled as backtests and kept separate from live results." },
  });
}
