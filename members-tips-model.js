/* Unit-only view model. Never mutates the source snapshot. */
(function (root) {
  const number = (v) => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const colours = ['SUPER', 'GREEN', 'ORANGE', 'RED', 'UNRATED'];
  const isMulti = (r) => !!(r && (r.is_multi || String(r.tag || '').toUpperCase() === 'MULTI' || String(r.market || '').toLowerCase() === 'multi'));
  const legKey = (game, selection) => (String(game || '').trim().toUpperCase() + '\0' + String(selection || '').trim().toUpperCase());
  let johnLegLights = Object.create(null);
  function bindJohnDocument(doc) {
    const lights = Object.create(null);
    for (const src of ['pl_results', 'today', 'results', 'open_bets']) {
      for (const r of (doc && doc[src]) || []) {
        if (isMulti(r) || String(r.tag || '').toUpperCase() === 'CL') continue;
        const k = legKey(r.game, r.selection);
        const light = String(r.light_at_placement || r.light || '').toUpperCase();
        if (k !== '\0' && light && colours.includes(light) && !lights[k]) lights[k] = light;
      }
    }
    johnLegLights = lights;
  }
  function allGreenLegs(r) {
    if (r && r.all_green_legs) return true;
    const legs = (r && r.legs) || [];
    return !!legs.length && legs.every((l) => johnLegLights[legKey(l.game, l.selection)] === 'GREEN');
  }
  const colour = (r) => {
    const lit = String((r && r.light) || '').toUpperCase();
    if (colours.includes(lit)) return lit;
    if (isMulti(r) && allGreenLegs(r)) return 'GREEN';
    return 'UNRATED';
  };
  const settled = (r) => ['W', 'L', 'T', 'void'].includes(r.result);
  const isSniperLay = (r) => {
    if (!String((r && r.selection) || '').trim().toUpperCase().startsWith('LAY ')) return false;
    const tag = String((r && r.tag) || '').toUpperCase();
    const system = String((r && r.system) || '').toLowerCase();
    return tag === 'CL' || system.includes('sniper') || system.includes('closing line');
  };
  const valid = (r) => {
    const game = String(r.game || '').trim();
    const sel = String(r.selection || '').trim();
    // Taken bets (with a bet_id) still count when the selection is a raw runner id or the game is TBC.
    if (String(r.bet_id || '').trim() && (game || sel)) return true;
    return !!game && !!sel && !/^\d+$/.test(sel);
  };
  // John's desk: hide Closing Line (Sniper) bets. Sniper desk uses visibleFor('sniper', …).
  const visible = (r) => String(r.tag || '').toUpperCase() !== 'CL' && valid(r);
  function visibleFor(tipster, r) {
    const t = String(tipster || 'john').toLowerCase();
    if (t === 'sniper' || t === 'probalab' || t === 'nfl-weather' || t === 'nfl-totals' || t === 'nba-price-gap' || t === 'nhl-value') return valid(r);
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
    // Sniper lays are paper 1u on the backer's stake: win +1u, not +(price-1).
    if (isSniperLay(r) && settled(r)) {
      if (r.result === 'void' || r.result === 'T') return 0;
      if (r.result === 'W') return 1;
      const odds = number(r.price_taken);
      return r.result === 'L' && odds != null && odds > 1 ? -(odds - 1) : null;
    }
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
  // Fresh start (13 Nov 2026): John's Tips, ProbaLab and Sniper open on "Since 16 Nov" (settled bets whose game date is on/after
  // 16 Nov 2026, Sydney time); "All-time" shows everything. View-only: the stored snapshots are never filtered or changed.
  const FRESH_START = '2026-11-16';
  const PERIOD_DESKS = ['john', 'probalab', 'sniper'];
  // Game (event) date in Sydney: kickoff / tip-off first, then the stored game date, then settlement or placement as a last resort.
  const eventDate = (r) => day(r.kickoff_utc || r.tipoff_utc || r.start_utc) || r.game_date || day(r.settled_utc || r.settled_at || r.placed_utc) || '';
  function inPeriod(r, period) {
    if (period !== 'fresh') return true;
    const d = eventDate(r);
    return !!d && d >= FRESH_START;
  }
  const hasPeriod = (id) => PERIOD_DESKS.includes(String(id || '').toLowerCase());
  function series(rows) {
    const daily = new Map();
    rows.filter(settled).forEach(r => {const d=date(r), p=pnl(r); if(d && p != null) daily.set(d,(daily.get(d)||0)+p);});
    let total=0;
    return [...daily].sort(([a],[b])=>a.localeCompare(b)).map(([d,p])=>({date:d, units:(total+=p)}));
  }
  const TIPSTERS = {
    john: {
      id: 'john',
      name: "John's Tips",
      shortLabel: 'Tips',
      focus: '',
      pitch: 'Sports betting with laser-focused, data-driven analysis.',
      blurb: 'Sports betting with laser-focused, data-driven analysis. Units only.',
      countNote: '',
      openNote: 'Tips already placed, awaiting settlement — not tips to make.',
    },
    sniper: {
      id: 'sniper',
      name: 'Closing Line Sniper',
      shortLabel: 'Tips',
      focus: 'Selective Closing Line tips',
      pitch: 'Fewer tips, only when the market agrees — aimed at beating the close.',
      blurb: 'Selective Closing Line tips aimed at beating the close (CLV). Flat paper 1 unit — every sent tip counts, including ones John did not take.',
      countNote: 'Every Closing Line tip that was sent counts here, including tips John did not take (paper units). This is the system’s public record.',
      openNote: 'Sent Closing Line tips still open (or awaiting tip-off), including paper tips John did not take.',
    },
    probalab: {
      id: 'probalab',
      name: 'ProbaLab',
      shortLabel: 'Tips',
      focus: 'NBA, NFL, NHL and EPL',
      pitch: "Tips the site's green and super picks (about 65%+) across NBA, NFL, NHL and EPL.",
      blurb: "Tips the site's green and super model picks (about 65%+) across NBA, NFL, NHL and EPL. Paper 1 unit at the site fair price.",
      countNote: 'Every green or super site pick from 7 Nov 2026 counts (paper 1u at the site fair price).',
      openNote: 'Green and super site picks awaiting tip-off or settlement.',
    },
    'nfl-weather': {
      id: 'nfl-weather',
      name: 'NFL Totals',
      shortLabel: 'Tips',
      focus: 'NFL totals · overs and unders',
      pitch: 'NFL game totals — overs and unders, mostly unders. Flat 1u.',
      blurb: 'NFL game totals — overs and unders, mostly unders. Flat 1 unit.',
      countNote: 'Fresh record only — no backfill. Flat 1u.',
      openNote: 'Tips appear here in the last 4 hours before kickoff. Until then they stay on Upcoming.',
    },
    'nba-price-gap': {
      id: 'nba-price-gap',
      name: 'NBA Price Gap',
      shortLabel: 'Price Gap',
      focus: 'NBA moneylines',
      pitch: "Doesn't try to pick the winner. It treats Pinnacle as the best read on each team's chance, and flags when an Australian book is still offering a better price, usually on the underdog.",
      blurb: "NBA moneylines where an Australian book still beats Pinnacle's fair read — usually the underdog. Flat 1 unit.",
      countNote: 'Flat 1 unit at the alerted price, from 7 Nov 2026. Favourites (Pinnacle fair chance 50% or higher) are tagged separately from underdogs.',
      openNote: 'Qualified price-gap alerts. They show here as soon as they qualify.',
    },
    'nhl-value': {
      id: 'nhl-value',
      name: 'NHL Value',
      shortLabel: 'NHL Value',
      focus: 'NHL moneylines',
      pitch: "Doesn't just pick the favourite. It takes ProbaLab NHL v3's win chance for each team, sets a minimum price of 1.06 ÷ chance, and flags when the best Australian book is still at or above that price. At most one side per game.",
      blurb: "NHL moneylines at or above ProbaLab's model fair price (minimum 1.06 ÷ chance). At most one side per game. Flat paper 1 unit.",
      countNote: 'Flat paper 1 unit, from 7 Nov 2026. Units only.',
      openNote: 'Qualified NHL Value alerts only. Empty until the scanner publishes them.',
    },
  };
  // Upcoming window: games inside the next `windowMs` when any exist, otherwise the next slate of the same length.
  function comingWindow(games, now, windowMs) {
    const startOf = (g) => Date.parse(g.start_utc || g.start || g.date || g.kickoff_utc || '');
    const future = (games || []).filter((g) => {
      if (String(g.status || '').toLowerCase() === 'post') return false;
      const t = startOf(g);
      return Number.isFinite(t) && t > now;
    }).sort((a, b) => startOf(a) - startOf(b));
    const soon = future.filter((g) => startOf(g) <= now + windowMs);
    if (soon.length || !future.length) return { games: soon, limited: true };
    const first = startOf(future[0]);
    return { games: future.filter((g) => startOf(g) <= first + windowMs), limited: false };
  }
  // Visibility: members see MEMBER_DESKS only. OWNER_ONLY_DESKS stay on for John.
  // Move a desk id from OWNER_ONLY_DESKS into MEMBER_DESKS to show it to members again.
  const MEMBER_DESKS = ['john', 'probalab', 'sniper'];
  const OWNER_ONLY_DESKS = ['nhl-value', 'nba-price-gap', 'nfl-weather'];
  const OWNER_EMAILS = ['jwcobley@gmail.com'];
  function canonicalDeskId(id) {
    const t = String(id || 'john').toLowerCase();
    return t === 'nfl-totals' ? 'nfl-weather' : t;
  }
  function isOwnerOnlyDesk(id) { return OWNER_ONLY_DESKS.includes(canonicalDeskId(id)); }
  function isMemberDesk(id) { return MEMBER_DESKS.includes(canonicalDeskId(id)); }
  function isOwnerEmail(email) { return OWNER_EMAILS.includes(String(email || '').trim().toLowerCase()); }
  function isOwnerAccount(email, role) {
    const r = String(role || '').trim().toLowerCase();
    return isOwnerEmail(email) || r === 'owner' || r === 'admin';
  }
  function canViewDesk(id, isOwner) {
    const t = canonicalDeskId(id);
    if (isMemberDesk(t)) return true;
    return !!(isOwner && isOwnerOnlyDesk(t));
  }
  function desksFor(isOwner) {
    return isOwner ? MEMBER_DESKS.concat(OWNER_ONLY_DESKS) : MEMBER_DESKS.slice();
  }
  function tipsterMeta(id) {
    return TIPSTERS[canonicalDeskId(id)] || TIPSTERS.john;
  }
  const api = {number, colours, colour, settled, valid, visible, visibleFor, day, date, pnl, stats, series, bindJohnDocument, tipsterMeta, FRESH_START, PERIOD_DESKS, eventDate, inPeriod, hasPeriod, TIPSTERS, comingWindow, MEMBER_DESKS, OWNER_ONLY_DESKS, OWNER_EMAILS, canonicalDeskId, isOwnerOnlyDesk, isMemberDesk, isOwnerEmail, isOwnerAccount, canViewDesk, desksFor};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  root.TipsModel=api;
})(typeof window !== 'undefined' ? window : globalThis);
