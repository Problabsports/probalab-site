// Props Chance (chance-v1): the bookie's price with the margin removed, moved toward the season hit rate on the line.
// Vectors in tests/fixtures/props-chance-vectors.json are shared with the mini pipeline tests (site and mini never drift).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CHANCE_VERSION, PRIOR_WEIGHT, CLAMP, fairOver, bookProb, propChance, chanceLight, _chanceParts } from "../functions/_shared/props-chance.js";
import { propRow, renderSportBoard, HEAD } from "../functions/_shared/sport-props.js";
import { itemFromSportRow, cardHtml } from "../functions/_shared/prop-cards.js";
import { chanceText } from "../functions/_shared/lights.js";

const V = JSON.parse(fs.readFileSync(new URL("./fixtures/props-chance-vectors.json", import.meta.url)));
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const SB = (over, under) => [{ key: "sportsbet", name: "Sportsbet", over, under }];

test("constants", () => {
  assert.equal(CHANCE_VERSION, "chance-v1");
  assert.deepEqual(PRIOR_WEIGHT, { nfl: 10, nhl: 10, nba: 10 });
  assert.deepEqual(CLAMP, [0.05, 0.95]);
  assert.equal(V.version, CHANCE_VERSION);
});

test("shared vectors (cases 1-7)", () => {
  assert.ok(V.cases.length >= 12);
  for (const c of V.cases) {
    const got = chanceLight(c.row, c.sport);
    assert.equal(got.side, c.expected.side, `${c.id} side`);
    assert.equal(r4(got.p), c.expected.p, `${c.id} p`);
    assert.equal(`${got.side} ${chanceText(got.p)}`, c.expected.shown, `${c.id} shown`);
    assert.equal(got.light, c.expected.light, `${c.id} light`);
    if (c.expected.src) assert.equal(propChance(c.row, c.sport).src, c.expected.src, `${c.id} src`);
  }
});

test("1. worked example: C.J. Stroud Over 57% ORANGE (11 / 19)", () => {
  const row = { kind: "ou", line: 257.5, books: SB(1.88, 1.88), hits: { season: { n: 9, over: 6, under: 3 } } };
  assert.equal(fairOver(row.books[0]), 0.5);
  const c = propChance(row, "nfl");
  assert.equal(c.p, 11 / 19);
  assert.deepEqual({ side: c.side, n: c.n, k: c.k, m: c.m, src: c.src }, { side: "Over", n: 9, k: 6, m: 10, src: "sportsbet" });
  assert.deepEqual(chanceLight(row, "nfl"), { light: "ORANGE", side: "Over", p: 11 / 19 });
});

test("2. boundaries on the shown (rounded-down) %: no float slip", () => {
  const L = (over, under, n) => chanceLight({ kind: "ou", line: 1.5, books: SB(1.88, 1.88), hits: { season: { n, over, under } } }, "nfl");
  assert.deepEqual([L(7, 3, 10).side, chanceText(L(7, 3, 10).p), L(7, 3, 10).light], ["Over", "60%", "GREEN"]);
  assert.deepEqual([L(4, 6, 10).side, chanceText(L(4, 6, 10).p), L(4, 6, 10).light], ["Under", "55%", "ORANGE"]);
  assert.deepEqual([L(1, 4, 5).side, chanceText(L(1, 4, 5).p), L(1, 4, 5).light], ["Under", "60%", "GREEN"]);
});

test("3. side flip: the Chance side wins over the season-rate side", () => {
  const row = { kind: "ou", line: 19.5, books: SB(1.98, 1.8), hits: { season: { n: 10, over: 5, under: 5 } } };
  assert.equal(r4(fairOver(row.books[0])), 0.4762);
  const parts = _chanceParts(row, "nfl");
  assert.equal(r4(parts.p_over), 0.4881);
  assert.equal(r4(parts.p_under), 0.5119);
  assert.deepEqual(chanceLight(row, "nfl").light, "RED");
  const html = propRow("nfl", { ...row, player: "Daniel Jones", market: "player_pass_completions", log: [] });
  assert.ok(html.includes("<b>Under 51%</b>"), "Chance cell shows the Under side");
  assert.ok(html.includes('<small>5/10</small>'), "hit cells follow the shown side");
});

test("4. margin removal with an uneven book", () => {
  assert.equal(r4(fairOver({ over: 1.44, under: 2.73 })), 0.6547);
  const c = propChance({ kind: "ou", line: 1.5, books: SB(1.44, 2.73), hits: { season: { n: 9, over: 6, under: 3 } } }, "nfl");
  assert.equal(r4(c.p), 0.6604);
  assert.equal(fairOver({ over: 1.0, under: 2 }), null, "both prices must be above 1.0");
  assert.equal(fairOver({ over: 1.9 }), null);
});

test("5. fallbacks: lowest-overround AU book, never a US book, never two books mixed, else prior", () => {
  const tab = { key: "tab", name: "TAB", over: 1.95, under: 1.8 }, neds = { key: "neds", name: "Neds", over: 1.8, under: 2.0 };
  const us = { key: "fanduel", name: "FanDuel", region: "us", over: 1.98, under: 1.98 };
  const sbOne = { key: "sportsbet", name: "Sportsbet", over: 1.7, under: null };
  assert.equal(bookProb([sbOne, tab, neds, us]).src, "neds");
  assert.equal(bookProb([sbOne, us]).src, "prior");
  assert.equal(bookProb([sbOne, us]).p_over, 0.5);
  // best Over at one book and best Under at another are never combined
  assert.equal(bookProb([{ key: "a", name: "A", over: 3.0, under: null }, { key: "b", name: "B", over: null, under: 3.0 }]).src, "prior");
  // ties: earliest in books[] order
  assert.equal(bookProb([{ key: "x", over: 1.9, under: 1.9 }, { key: "y", over: 1.9, under: 1.9 }]).src, "x");
  // Sportsbet with both sides wins even when another book has a lower overround
  assert.equal(bookProb([{ key: "sportsbet", over: 1.8, under: 1.8 }, { key: "z", over: 1.98, under: 1.98 }]).src, "sportsbet");
  assert.deepEqual(bookProb([]), { p_over: 0.5, src: "prior" });
});

test("6. no hits, under 5 games, Avg line", () => {
  const nohits = chanceLight({ kind: "ou", line: 1.5, books: SB(1.44, 2.73) }, "nfl");
  assert.equal(r4(nohits.p), 0.6547);
  assert.equal(nohits.light, "");
  const few = chanceLight({ kind: "ou", line: 1.5, books: SB(1.88, 1.88), hits: { season: { n: 4, over: 4, under: 0 } } }, "nfl");
  assert.ok(few.p > 0.6 && few.light === "");
  const avg = chanceLight({ kind: "ou", line: 1.5, line_source: "avg", books: [], hits: { season: { n: 20, over: 18, under: 2 } } }, "nhl");
  assert.ok(avg.p > 0.6 && avg.light === "" && avg.side === "Over");
  const html = propRow("nhl", { kind: "ou", line: 1.5, line_source: "avg", books: [], hits: { season: { n: 20, over: 18, under: 2 } }, player: "P", market: "player_shots_on_goal", log: [] });
  assert.ok(html.includes("No AU price") && /pp-chance"><b>Over \d+%<\/b>/.test(html) && html.includes('data-light=""'), "no-price row: Chance from the prior, no light");
});

test("7. clamp to 95%", () => {
  const row = { kind: "ou", line: 0.5, books: SB(1.05, 12), hits: { season: { n: 30, over: 30, under: 0 } } };
  assert.equal(r4(fairOver(row.books[0])), 0.9195);
  assert.equal(r4(_chanceParts(row, "nfl").p_over), 0.9799);
  assert.deepEqual(chanceLight(row, "nfl"), { light: "GREEN", side: "Over", p: 0.95 });
  const low = propChance({ kind: "ou", line: 0.5, books: SB(12, 1.05), hits: { season: { n: 30, over: 0, under: 30 } } }, "nfl");
  assert.equal(low.p, 0.95);
  assert.equal(low.side, "Under");
});

const yesRow = { player: "Jared Mann", team: "Seattle Kraken", team_abbr: "SEA", kind: "yes", line: null, market: "player_goal_scorer_anytime",
  books: [{ key: "sportsbet", name: "Sportsbet", yes: 2.98 }], log: [{ v: 1 }, { v: 0 }], rates: { l8: { n: 8, yes: 5 }, season: { n: 20, yes: 9 } } };

test("8. Yes rows: no Chance, scoring-rate light kept", () => {
  assert.equal(propChance(yesRow, "nhl"), null);
  const html = propRow("nhl", yesRow, "x");
  assert.ok(html.includes('<td class="num pp-chance">-</td>'));
  assert.ok(html.includes("chip ORANGE") && html.includes(">No<"), "scoring rate light: No 11 of 20 = 55% -> ORANGE, shown with its side");
});

const ouRow = { player: "C.J. Stroud", team: "Houston Texans", team_abbr: "HOU", position: "QB", kind: "ou", market: "player_pass_yds", line: 257.5,
  books: [{ key: "sportsbet", name: "Sportsbet", over: 1.88, under: 1.88 }, { key: "tab", name: "TAB", over: 1.44, under: 2.73 }],
  log: [{ date: "2026-11-15", opp: "DAL", ha: "H", v: 280 }], season: { gp: 9, avg: 262 },
  hits: { l5: { n: 5, over: 3, under: 2 }, l10: { n: 9, over: 6, under: 3 }, season: { n: 9, over: 6, under: 3 } } };
const board = { games: [{ event_id: "e1", away: "Dallas Cowboys", home: "Houston Texans", commence_utc: "2099-01-01T00:00:00Z", props: [ouRow, yesRow, ...Array.from({ length: 6 }, (_, i) => ({ ...ouRow, player: `Extra ${i}`, season: { gp: 9, avg: 100 - i } }))] }] };

test("9. privacy: the book chance never reaches HTML or the pp-pv JSON", () => {
  for (const full of [true, false]) {
    const html = renderSportBoard("nfl", board, { full });
    assert.ok(!/p_book|"pb"|p_over|p_under|"src"|"m":|fair/i.test(html), "no book-chance fields");
    assert.ok(!/[^0-9]0\.5[\s<",}]|>50%|0\.6546|0\.6547/.test(html.replace(/<svg[\s\S]*?<\/svg>/g, "")), "no de-margined value (0.5 / 65%) anywhere");
    for (const m of html.matchAll(/<script type="application\/json" class="pp-pv"[^>]*>([\s\S]*?)<\/script>/g)) {
      for (const it of Object.values(JSON.parse(m[1]))) {
        if (it.kind === "ou") assert.deepEqual(Object.keys(it.chance).sort(), ["p", "side"]);
        else assert.equal(it.chance, null);
        assert.ok(["light", "side", "pred"].every((k) => k in it), "field names the Discord bot reads are unchanged");
      }
    }
  }
  const it = itemFromSportRow("nfl", ouRow, "Passing yards", "", "");
  assert.deepEqual(it.chance, { side: "Over", p: 11 / 19 });
  assert.equal(it.light, "ORANGE");
  assert.match(cardHtml(it, "x", ""), /<span class="ppc-pred">Chance <b>Over<\/b> · <b>57%<\/b><\/span>/);
});

test("10. column count: header == O/U row == Yes row == locked row", () => {
  const cells = (s) => (s.match(/<t[hd][\s>]/g) || []).length;
  const head = cells(HEAD);
  assert.equal(head, 11);
  assert.ok(HEAD.includes('<th scope="col" class="num pp-chance">Chance</th><th scope="col" class="lt">'), "Chance sits next to the light");
  assert.ok(HEAD.includes("Hit rate<small>Season</small>"));
  assert.equal(cells(propRow("nfl", ouRow, "x")), head);
  assert.equal(cells(propRow("nhl", yesRow, "x")), head);
  assert.equal(cells(propRow("nhl", { ...ouRow, books: [] }, "x")), head);
  const html = renderSportBoard("nfl", board, { full: false });
  const locked = html.match(/<tr class="pp-row pp-locked-row"[\s\S]*?<\/tr>/);
  assert.ok(locked, "locked rows present in the free view");
  assert.equal(cells(locked[0]), head);
});

test("wording: no Super / value / edge / units / model chance", () => {
  const html = renderSportBoard("nfl", board, { full: true });
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
  for (const w of [/super/i, /\bvalue\b/i, /\bedge\b/i, /fair price/i, /\bunits?\b/i, /\btips?\b/i, /\bstake\b/i, /model chance/i]) assert.ok(!w.test(text), String(w));
  assert.ok(!/super|model chance|\bedge\b/i.test(html));
});
