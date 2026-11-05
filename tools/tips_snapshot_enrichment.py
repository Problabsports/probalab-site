"""Optional v1 tips snapshot extension: all captured, settled PL site picks.

Used by /workspace/betting/scripts/tips_page/export_tips.py on every refresh.
Never removes or rewrites the original CL data. No bankroll or currency fields.
"""
from math import isfinite


def number(value):
    try:
        n = float(value)
        return n if isfinite(n) else None
    except (ValueError, TypeError):
        return None


def enrich_snapshot(doc, latest, row_sport):
    result_codes = {'win': 'W', 'won': 'W', 'w': 'W', 'lose': 'L', 'loss': 'L', 'lost': 'L', 'l': 'L',
                    'tie': 'T', 'draw': 'T', 't': 'T', 'void': 'void', 'push': 'T'}
    history = []
    for pid, row in latest.items():
        result = result_codes.get(str(row.get('result') or '').lower())
        if row.get('source') != 'probalab' or not result:
            continue
        price = number(row.get('price'))
        covered = price is not None and price > 1
        pnl = (price - 1 if result == 'W' else -1 if result == 'L' else 0) if covered else None
        history.append({
            'pick_id': pid, 'tag': 'PL', 'sport': row_sport(row), 'game': row.get('game'),
            'selection': row.get('selection'), 'light': row.get('light') or None,
            'game_date': row.get('game_date'), 'tipoff_utc': row.get('tipoff_utc'),
            'settled_utc': row.get('settled_at') or None, 'result': result,
            'price_taken': price if covered else None, 'units': 1 if covered else None,
            'pnl_units': round(pnl, 6) if pnl is not None else None,
        })
    doc['pl_results'] = history
    doc['comparison_assumptions'] = {
        'pl_stake': 'flat 1u at captured price, before commission',
        'missing_price': 'excluded from units/ROI; included in count and win rate',
        'history': 'captured PL ledger picks only, not a pre-capture backtest',
    }
    return doc
