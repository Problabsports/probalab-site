// Generates the browser copies of /lights.json (the single source of truth for lights):
//   /lights.js   classic script (window.PLLights; require() in Node) for phone-core.js, phone.js, index.html, members desk
//   /lights.mjs  ES module for the Pages Functions (functions/_shared/lights.js) and browser modules (props-results-core.js)
//   the light colour variables between the "lights:begin" / "lights:end" markers in page.css and index.html
// Both JS copies embed lights-core.mjs, the same rules the Pages Functions use.
// Usage: node tools/build_lights.mjs          write the copies
//        node tools/build_lights.mjs --check  exit 1 if any copy is out of date (run by tests/lights.test.mjs)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const HEAD = "Generated from lights.json by tools/build_lights.mjs. Do not edit: edit lights.json and run node tools/build_lights.mjs.";

export function outputs() {
  const data = JSON.parse(read("lights.json"));
  const core = read("lights-core.mjs").replace(/^export function makeLights/m, "function makeLights").replace(/\r\n/g, "\n");
  const json = JSON.stringify(data);
  const js = `/* ${HEAD} */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PLLights = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
${core.replace(/^/gm, "  ").replace(/^ +$/gm, "")}
  return makeLights(${json});
});
`;
  const mjs = `/* ${HEAD} */
${core}
export const data = ${json};
const lights = makeLights(data);
export default lights;
`;
  const vars = data.order.map((k) => {
    const l = data.lights[k];
    return `  --${l.css_var}: ${l.colour}; --${l.css_var}-soft: ${l.soft};`;
  }).join("\n");
  const block = `/* lights:begin (${HEAD}) */\n${vars}\n  /* lights:end */`;
  const files = { "lights.js": js, "lights.mjs": mjs };
  for (const f of ["page.css", "index.html"]) {
    const src = read(f);
    const re = /\/\* lights:begin[\s\S]*?\/\* lights:end \*\//;
    if (!re.test(src)) throw new Error(`${f}: lights:begin / lights:end markers missing`);
    files[f] = src.replace(re, block.trimStart());
  }
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const stale = [];
  for (const [f, body] of Object.entries(outputs())) {
    const p = path.join(ROOT, f);
    const cur = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
    const same = cur != null && cur.replace(/\r\n/g, "\n") === body.replace(/\r\n/g, "\n");
    if (same) continue;
    if (check) stale.push(f);
    else { fs.writeFileSync(p, body); console.log("wrote", f); }
  }
  if (check && stale.length) { console.error("out of date (run node tools/build_lights.mjs): " + stale.join(", ")); process.exit(1); }
  if (check) console.log("lights copies up to date");
}
