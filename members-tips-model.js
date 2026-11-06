/* Unit-only view model. Never mutates the source snapshot. */
(function (root) {
  const number = (v) => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const colours = ['SUPER', 'GREEN', 'ORANGE', 'RED', 'UNRATED'];
  const colour = (r) => colours.includes(String(r.light).toUpperCase()) ? String(r.light).toUpperCase() : 'UNRATED';
  const settled = (r) => ['W', 'L', 'T', 'void'].includes(r.result);
  const valid = (r) => !!String(r.game || '').trim() && !!String(r.selection || '').trim() && !/^\d+$/.test(String(r.selection).trim());
  const visible = (r) => String(r.tag || '').toUpperCase() !== 'CL' && valid(r);
  function day(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', {timeZone: 'Australia/Sydney', year:'numeric', month:'2-digit', day:'2-digit'}).format(d);
  }
  const date = (r) => day(r.settled_utc || r.settled_at || r.kickoff_utc || r.tipoff_utc || r.placed_utc) || r.game_date || '';
  function pnl(r) {
    // Historical zero placeholders must not masquerade as known returns.
    if (number(r.units) == null) return null;
    const actual = number(r.pnl_units);
    if (actual != null) return actual;
    if (r.result === 'L') return -number(r.units);
    if (r.result === 'void' || r.result === 'T') return 0;
    const odds = number(r.price_taken);
    return r.result === 'W' && odds != null && odds > 1 ? number(r.units) * (odds - 1) : null;
  }
  function stats(rows) {
    const done = rows.filter(settled), covered = done.filter(r => pnl(r) != null);
    const wins = done.filter(r => r.result === 'W').length, losses = done.filter(r => r.result === 'L').length;
    const units = covered.length ? covered.reduce((s,r) => s + pnl(r), 0) : null;
    const stakes = covered.reduce((s,r) => s + number(r.units), 0);
    return {bets:done.length, wins, losses, win_pct:wins + losses ? wins/(wins+losses) : null, units, roi:stakes > 0 ? units/stakes : null, covered:covered.length};
  }
  function series(rows) {
    const daily = new Map();
    rows.filter(settled).forEach(r => {const d=date(r), p=pnl(r); if(d && p != null) daily.set(d,(daily.get(d)||0)+p);});
    let total=0;
    return [...daily].sort(([a],[b])=>a.localeCompare(b)).map(([d,p])=>({date:d, units:(total+=p)}));
  }
  const api = {number, colours, colour, settled, valid, visible, day, date, pnl, stats, series};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  root.TipsModel=api;
})(typeof window !== 'undefined' ? window : globalThis);
