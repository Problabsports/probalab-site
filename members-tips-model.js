/* Unit-only view model. Never mutates the source snapshot. */
(function (root) {
  const number = (v) => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const colours = ['SUPER', 'GREEN', 'ORANGE', 'RED', 'UNRATED'];
  const colour = (r) => colours.includes(String(r.light).toUpperCase()) ? String(r.light).toUpperCase() : 'UNRATED';
  const settled = (r) => ['W', 'L', 'T', 'void'].includes(r.result);
  const valid = (r) => !!String(r.game || '').trim() && !!String(r.selection || '').trim() && !/^\d+$/.test(String(r.selection).trim());
  // John's desk: hide Closing Line (Sniper) bets. Sniper desk uses visibleFor('sniper', …).
  const visible = (r) => String(r.tag || '').toUpperCase() !== 'CL' && valid(r);
  function visibleFor(tipster, r) {
    const t = String(tipster || 'john').toLowerCase();
    if (t === 'sniper' || t === 'probalab') return valid(r);
    return visible(r);
  }
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
  const TIPSTERS = {
    john: {
      id: 'john',
      name: 'John',
      shortLabel: 'Tips',
      focus: 'NBA, NFL, NHL and EPL',
      pitch: 'Tips selected from ProbaLab greens across four sports.',
      countNote: 'Only bets on a PL pick are counted.',
      openNote: 'Tips already placed, awaiting settlement — not tips to make.',
    },
    sniper: {
      id: 'sniper',
      name: 'Closing Line Sniper',
      shortLabel: 'Tips',
      focus: 'Selective Closing Line tips',
      pitch: 'Fewer tips, only when the market agrees — aimed at beating the close.',
      countNote: 'Every Closing Line tip that was sent counts here, including tips John did not take (paper units). This is the system’s public record.',
      openNote: 'Sent Closing Line tips still open (or awaiting tip-off), including paper tips John did not take.',
    },
    probalab: {
      id: 'probalab',
      name: 'ProbaLab',
      shortLabel: 'Tips',
      focus: 'NBA, NFL, NHL and EPL',
      pitch: "Tips the site's green and super picks (about 65%+) across NBA, NFL, NHL and EPL.",
      countNote: 'Every green or super site pick from 7 Nov 2026 counts (paper 1u at the site fair price).',
      openNote: 'Green and super site picks awaiting tip-off or settlement.',
    },
  };
  function tipsterMeta(id) {
    const key = String(id || 'john').toLowerCase();
    return TIPSTERS[key] || TIPSTERS.john;
  }
  const api = {number, colours, colour, settled, valid, visible, visibleFor, day, date, pnl, stats, series, tipsterMeta, TIPSTERS};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  root.TipsModel=api;
})(typeof window !== 'undefined' ? window : globalThis);
