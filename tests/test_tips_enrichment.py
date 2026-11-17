import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('enrichment', Path(__file__).resolve().parents[1] / 'tools/tips_snapshot_enrichment.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

# pl_results is the whole public Record (record_rows: feed + nhl-pretip), priced from the ledger where a PL price was
# captured. The record is stubbed here so the test never touches the live feed.
RECORD = [
    {'game_id': '101', 'sport': 'NBA', 'game': 'BOS @ DET', 'selection': 'DET', 'light': 'GREEN', 'won': True,
     'tipoff_utc': '2026-11-01T00:00:00Z', 'win_pct': .66},
    {'game_id': '102', 'sport': 'NBA', 'game': 'NYK @ MIA', 'selection': 'MIA', 'light': 'ORANGE', 'won': True,
     'tipoff_utc': '2026-11-02T00:00:00Z', 'win_pct': .57},
    {'game_id': '103', 'sport': 'NFL', 'game': 'KC @ BUF', 'selection': 'BUF', 'light': 'GREEN', 'won': False,
     'tipoff_utc': '2026-11-03T00:00:00Z', 'win_pct': .68},
    {'game_id': '104', 'sport': 'NHL', 'game': 'TOR @ BOS', 'selection': 'BOS', 'light': 'RED', 'won': False,
     'tipoff_utc': '2026-11-04', 'win_pct': .51},
]


class EnrichmentTest(unittest.TestCase):
    def setUp(self):
        self._rows = m.record_rows
        m.record_rows = lambda: [dict(r) for r in RECORD]

    def tearDown(self):
        m.record_rows = self._rows

    def test_full_record_with_ledger_prices(self):
        base = {'source': 'probalab', 'sport': 'NBA', 'game': 'BOS @ DET', 'selection': 'DET', 'light': 'GREEN'}
        latest = {'nba-101': dict(base, result='win', price='1.4'),
                  'nba-102': dict(base, game='NYK @ MIA', selection='MIA', result='win', price=''),
                  'nfl-103': dict(base, sport='NFL', game='KC @ BUF', selection='BUF', result='loss', price='2.0'),
                  # a closing-line row never prices the PL record
                  'cl-104': dict(base, source='closing_line', sport='NHL', game='TOR @ BOS', result='win', price='2.0')}
        doc = {'results': [{'tag': 'CL'}], 'summary': {'keep': True}}
        out = m.enrich_snapshot(doc, latest, lambda r: r['sport'])
        pl = out['pl_results']
        # every settled public Record game, not just the ledger rows
        self.assertEqual([r['pick_id'] for r in pl], ['101', '102', '103', '104'])
        self.assertEqual([r['result'] for r in pl], ['W', 'W', 'L', 'L'])
        self.assertEqual([r['light'] for r in pl], ['GREEN', 'ORANGE', 'GREEN', 'RED'])
        self.assertTrue(all(r['tag'] == 'PL' for r in pl))
        # priced win: 1u at 1.4 -> +0.4
        self.assertEqual((pl[0]['price_taken'], pl[0]['units'], pl[0]['pnl_units']), (1.4, 1, .4))
        # no captured price: kept on the record, out of units
        self.assertIsNone(pl[1]['price_taken'])
        self.assertIsNone(pl[1]['units'])
        self.assertIsNone(pl[1]['pnl_units'])
        # priced loss -> -1
        self.assertEqual(pl[2]['pnl_units'], -1)
        # closing_line price ignored
        self.assertIsNone(pl[3]['units'])
        # CL bets pass through (only the placement light is recorded); other keys kept
        self.assertEqual(out['results'], [{'tag': 'CL', 'light_at_placement': None}])
        self.assertTrue(out['summary']['keep'])
        self.assertIn('pl_source', out['comparison_assumptions'])


if __name__ == '__main__':
    unittest.main()
