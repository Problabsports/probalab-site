// The NBA value light is called "Best value" in public. No public HTML / JS text may say "Super"
// (case-sensitive word). Internal ids, keys and identifiers stay as they are (SUPER, super, showSuper,
// nbaSuperPublished...): they are code, not text anyone reads. Proper names are allowed ("Super Bowl").
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import L from "../lights.js";
import { labelLong as labelLongFn } from "../functions/_shared/lights.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = [/Super Bowl/g]; // the NFL final, a proper name

// public files: every page and browser script at the root, plus the Pages Functions that render pages
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(m?js|html)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = [
  ...fs.readdirSync(ROOT).filter((f) => /\.(m?js|html)$/.test(f)).map((f) => path.join(ROOT, f)),
  ...walk(path.join(ROOT, "functions")),
];
assert.ok(files.length > 20, "found the public files");

/** "Super" as a word in text, ignoring comments, regex sources and allowed proper names. */
function hits(src) {
  let s = src
    .replace(/\/\*[\s\S]*?\*\//g, "")          // block comments
    .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, "$1") // line comments (not the // inside https://)
    .replace(/<!--[\s\S]*?-->/g, "");           // HTML comments
  for (const re of ALLOWED) s = s.replace(re, "");
  const out = [];
  const re = /\bSuper\b/g;
  let m;
  while ((m = re.exec(s))) {
    if (s[m.index + 5] === "\\") continue; // regex source such as /Super\s*[—–-]\s*best value/ (old-label clean-up on phones)
    out.push(s.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\s+/g, " "));
  }
  return out;
}

const bad = [];
for (const f of files) for (const h of hits(fs.readFileSync(f, "utf8"))) bad.push(`${path.relative(ROOT, f)}: …${h}…`);
assert.deepEqual(bad, [], `public text says "Super":\n${bad.join("\n")}`);

// the test itself catches what it should
assert.equal(hits('<p>Super is an NBA flag</p>').length, 1);
assert.equal(hits('const t = "NBA Super picks";').length, 1);
assert.equal(hits("showSuper = true; nbaSuperPublished; SUPER; Superdome; Super Bowl").length, 0);

// the label itself (lights.json → lights.js / lights.mjs); the internal key stays SUPER
assert.equal(L.label("SUPER"), "Best value");
assert.equal(L.labelLong("SUPER"), "Best value");
assert.equal(labelLongFn("SUPER"), "Best value");
assert.ok(L.order.includes("SUPER"), "internal id unchanged");
console.log("no-super-wording ok");
