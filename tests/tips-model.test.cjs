const assert = require('node:assert/strict');
const M = require('../members-tips-model.js');
const base={tag:'PL',game:'BOS @ DET',selection:'DET',sport:'NBA',light:'GREEN',result:'W',units:1,pnl_units:0.4,kickoff_utc:'2026-11-05T20:00:00Z'};
assert.equal(M.number(''),null);
assert.equal(M.number(0),0);
assert.equal(M.pnl({...base,units:null,pnl_units:0}),null);
assert.equal(M.pnl({...base,units:0,pnl_units:0}),0);
assert.equal(M.visible({...base,tag:'CL'}),false);
assert.equal(M.visible({...base,tag:'CL+PL'}),true);
assert.equal(M.valid({...base,game:'',selection:'25610'}),false);
assert.equal(M.day('2026-11-05T20:00:00Z'),'2026-11-06');
assert.equal(M.colour({...base,light:null}),'UNRATED');
const st=M.stats([base,{...base,result:'L',units:null,pnl_units:0},{...base,result:'void',pnl_units:0}]);
assert.equal(st.bets,3); assert.equal(st.covered,2); assert.equal(st.win_pct,.5); assert.equal(st.units,.4); assert.equal(st.roi,.2);
assert.equal(M.series([base,{...base,units:null,pnl_units:0}])[0].units,.4);
assert.equal(M.stats([]).units,null);
console.log('Tips model: 15 assertions passed');
assert.equal(M.visibleFor('john', {...base, tag:'CL'}), false);
assert.equal(M.visibleFor('sniper', {...base, tag:'CL'}), true);
assert.equal(M.tipsterMeta('sniper').name, 'Closing Line Sniper');
assert.equal(M.tipsterMeta('john').name, 'John');
assert.equal(M.tipsterMeta('nhl-value').name, 'NHL Value');
assert.equal(M.tipsterMeta('nhl-value').focus, 'NHL moneylines');
assert.equal(M.visibleFor('nhl-value', {...base, sport:'NHL', tag:'CL'}), true);
assert.equal(M.visibleFor('john', {...base, tag:'CL'}), false);
const DAY = 24 * 60 * 60 * 1000;
const picks = require('../data/nhl-picks.json');
const near = M.comingWindow(picks, Date.parse('2026-11-06T23:11:00Z'), DAY);
assert.equal(near.limited, true);
assert.deepEqual(near.games.map((g) => g.id), ['2026020262','2026020263','2026020264','2026020265','2026020266','2026020267']);
const nextDay = M.comingWindow(picks, Date.parse('2026-11-07T23:30:00Z'), DAY);
assert.equal(nextDay.limited, true);
assert.equal(nextDay.games[0].id, '2026020268');
assert.ok(nextDay.games.every((g) => Date.parse(g.date) <= Date.parse('2026-11-07T23:30:00Z') + DAY));
const fallback = M.comingWindow([
  { id: 'past', date: '2026-11-01T00:00:00Z', status: 'post' },
  { id: 'a', date: '2026-11-20T00:00:00Z', status: 'pre' },
  { id: 'b', date: '2026-11-20T12:00:00Z', status: 'pre' },
  { id: 'c', date: '2026-11-22T00:00:00Z', status: 'pre' },
], Date.parse('2026-11-18T00:00:00Z'), DAY);
assert.equal(fallback.limited, false);
assert.deepEqual(fallback.games.map((g) => g.id), ['a', 'b']);
const snap = require('../data/tipsters/nhl-value.json');
assert.deepEqual(snap.open_bets, []);
assert.deepEqual(snap.results, []);
assert.equal(snap.tipster, 'nhl-value');
assert.equal(snap.summary.bets, 0);
assert.match(snap.generated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+11:00$/);
assert.match(snap.source, /External NHL Value scanner publishes alerts/);
console.log('Tips model tipster helpers: ok');
