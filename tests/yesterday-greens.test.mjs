import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../functions/api/yesterday-greens.js", import.meta.url), "utf8");
assert.match(src, /loadSportRecord/);
assert.match(src, /GREEN/);
assert.match(src, /SUPER/);
assert.match(src, /Australia\/Sydney/);
assert.match(src, /hide:\s*greens\.length === 0|hide: true/);
console.log("yesterday-greens.test.mjs ok");
