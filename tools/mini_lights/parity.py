"""Parity check used by tests/lights.test.mjs: reads [[sport, feed_light, p], ...] on stdin,
prints [[shown_light, best_value_tag], ...] as JSON."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from probalab_lights import Lights  # noqa: E402

L = Lights.load(sys.argv[1])
grid = json.load(sys.stdin)
print(json.dumps([[L.shown_light(s, f, p), L.best_value_tag(s, f, p)] for s, f, p in grid]))
