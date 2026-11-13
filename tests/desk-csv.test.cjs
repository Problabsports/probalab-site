// CSV download (13 Nov 2026): for each desk, the CSV is built from the same rows as the headline record,
// and its TOTAL row equals that headline (settled, W-L, net units, ROI) — with default filters and with filters on.
const assert = require('node:assert/strict');
const M = require('../members-tips-model.js');

const row = (o) => ({ tag: 'PL', game: 'BOS @ DET', selection: 'DET', sport: 'NBA', light: 'GREEN', result: 'W', units: 1, pnl_units: 0.4, price_taken: 1.4, kickoff_utc: '2026-11-05T20:00:00Z', ...o });
const rows = [
  row({}),
  row({ result: 'L', pnl_units: -1, light: 'ORANGE', sport: 'NHL', kickoff_utc: '2026-11-02T00:00:00Z' }),
  row({ result: 'W', pnl_units: 0.85, light: null, sport: 'NFL', game: 'CHI @ ATL', selection: 'CHI' }),     // off-pick
  row({ result: 'void', pnl_units: 0, sport: 'EPL', game: 'Everton v Chelsea', selection: 'Everton' }),
  row({ result: 'T', pnl_units: 0, light: 'SUPER', sport: 'NFL' }),
  row({ result: 'W', units: null, pnl_units: 0 }),                                                          // no unit data: not in units/ROI
  row({ result: 'L', units: 0.3, pnl_units: -0.3, light: 'RED', kickoff_utc: '2026-10-20T00:00:00Z' }),
  row({ tag: 'CL', result: 'W', pnl_units: 0.5, selection: 'LAY DET', price_taken: 2 }),                     // Closing Line: hidden on John's desk
  row({ tag: 'MULTI', is_multi: true, sport: 'NBA', result: 'L', pnl_units: -1, light: null, game: 'A @ B / C @ D', selection: 'B + D' }),
  row({ result: 'W', pnl_units: 0.2, sport: 'TENNIS', game: 'Shelton v Alcaraz', selection: 'Alcaraz', kickoff_utc: '2026-11-12T10:00:00Z' }),
  row({ result: 'open', pnl_units: null, kickoff_utc: '2026-11-20T00:00:00Z' }),                            // not settled
  row({ game: '', selection: '25610', bet_id: '' }),                                                       // invalid: never shown
];
const SPORTS = ['NBA', 'NFL', 'NHL', 'EPL', 'CHAMP', 'TENNIS'];
const defaults = { colours: M.colours, sports: SPORTS, allSports: true, from: '', to: '' };
const variants = [
  ['default filters', defaults],
  ['green only', { ...defaults, colours: ['GREEN'] }],
  ['NBA + NFL', { ...defaults, sports: ['NBA', 'NFL'], allSports: false }],
  ['date range', { ...defaults, from: '2026-11-01', to: '2026-11-06' }],
  ['nothing matches', { ...defaults, colours: [] }],
];
function totalRow(csv) {
  const lines = csv.trim().split(/\r\n/);
  const last = lines[lines.length - 1].split(',');
  assert.equal(last[0], 'TOTAL', 'last CSV line is the TOTAL row');
  return { lines, settled: last[1], wl: last[2], units: last[3], roi: last[4] };
}
let n = 0;
for (const desk of ['john', 'probalab', 'sniper', 'nfl-weather']) {
  for (const [label, f] of variants) {
    const shown = M.deskRows(desk, rows, f);                 // the rows the page's headline uses
    const head = M.headline(shown);                          // the headline exactly as printed on the page
    const st = M.stats(shown);
    const t = totalRow(M.toCsv(shown));
    const msg = desk + ' / ' + label;
    assert.equal(t.settled, 'settled ' + head.settled, msg);
    assert.equal(t.wl, 'W-L ' + head.wl.replace('–', '-'), msg);
    assert.equal(t.units, 'net units ' + head.units, msg);
    assert.equal(t.roi, 'ROI ' + head.roi, msg);
    assert.equal(head.settled, String(st.bets), msg);
    assert.equal(t.lines.length, shown.length + 2, msg + ': header + one line per shown row + TOTAL');
    n += 6;
  }
}
// The John desk never includes Closing Line or invalid rows; Sniper does include Closing Line.
assert.equal(M.deskRows('john', rows, defaults).some((r) => r.tag === 'CL'), false);
assert.equal(M.deskRows('sniper', rows, defaults).some((r) => r.tag === 'CL'), true);
assert.equal(M.deskRows('john', rows, defaults).some((r) => r.selection === '25610'), false);
// Worked by hand for John's desk, default filters: 9 settled (4 W, 3 L, 1 void, 1 tie); units .4-1+.85-.3-1+.2 = -0.85
// over 7.3 staked units (the W with no unit data is counted as settled but left out of units/ROI) -> ROI -11.6%
const john = M.headline(M.deskRows('john', rows, defaults));
assert.deepEqual(john, { settled: '9', wl: '4–3', units: '-0.85u', roi: '-11.6%' });
// File name: desk + date
assert.equal(M.csvFilename("John's Tips", '2026-11-13'), 'johns-tips_2026-11-13.csv');
assert.equal(M.csvFilename('Closing Line Sniper', '2026-11-13'), 'closing-line-sniper_2026-11-13.csv');
assert.equal(M.csvFilename('ProbaLab', '2026-11-13'), 'probalab_2026-11-13.csv');
// Commas and quotes in a game name stay in one cell
assert.ok(M.toCsv([row({ game: 'Brighton & Hove, "Albion" v Palace' })]).includes('"Brighton & Hove, ""Albion"" v Palace"'));
console.log('Desk CSV: ' + (n + 9) + ' assertions passed (TOTAL row equals the headline on every desk and filter)');
