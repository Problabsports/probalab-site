import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('enrichment', Path(__file__).resolve().parents[1] / 'tools/tips_snapshot_enrichment.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class EnrichmentTest(unittest.TestCase):
    def test_history_and_null_prices(self):
        base = {'source': 'probalab', 'sport': 'NBA', 'game': 'BOS @ DET', 'selection': 'DET', 'light': 'GREEN'}
        latest = {'a': dict(base, result='win', price='1.4'), 'b': dict(base, result='lose', price=''),
                  'c': dict(base, result='loss', price='2.0'), 'd': dict(base, result=''),
                  'e': dict(base, source='closing_line', result='win', price='2.0')}
        doc = {'results': [{'tag': 'CL'}], 'summary': {'keep': True}}
        out = m.enrich_snapshot(doc, latest, lambda r: r['sport'])
        self.assertEqual(len(out['pl_results']), 3)
        self.assertEqual(out['pl_results'][0]['pnl_units'], .4)
        self.assertIsNone(out['pl_results'][1]['units'])
        self.assertIsNone(out['pl_results'][1]['pnl_units'])
        self.assertEqual(out['pl_results'][2]['pnl_units'], -1)
        self.assertEqual(out['results'], [{'tag': 'CL'}])
        self.assertTrue(out['summary']['keep'])

if __name__ == '__main__':
    unittest.main()
