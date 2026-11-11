import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, "../members-john-multis.js"), "utf8");

const saveStart = src.indexOf("async function saveMulti");
const saveEnd = src.indexOf("async function deleteMulti");
assert(saveStart >= 0 && saveEnd > saveStart, "saveMulti and deleteMulti are present");
const saveFn = src.slice(saveStart, saveEnd);
assert(saveFn.includes("openForm(null)"), "after a successful save the form resets to a blank new multi");
assert(!saveFn.includes('$("multiId").value = id'), "after save the form must not keep the saved id (that overwrote a same-day multi)");
assert(saveFn.includes("await alertDiscord(id)"), "Discord alert still fires after save");
assert(saveFn.includes("payload.id || nextId"), "edits keep the existing id; a blank form uses nextId");

const windowObj = {};
const document = {
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return {}; },
  body: { appendChild() {} },
};
runInNewContext(src, { window: windowObj, document });
const nextId = windowObj.JohnMultis && windowObj.JohnMultis.nextId;
assert(typeof nextId === "function", "nextId is exported for tests");

const when = new Date("2026-11-11T06:30:00+11:00");
assert(nextId([], when) === "SB-MULTI-2026-11-11-1", "first multi of the day is -1");
assert(nextId([{ id: "SB-MULTI-2026-11-11-1" }], when) === "SB-MULTI-2026-11-11-2", "second multi of the same day is -2");
assert(
  nextId([{ id: "SB-MULTI-2026-11-11-1" }, { id: "SB-MULTI-2026-11-11-2" }], when) === "SB-MULTI-2026-11-11-3",
  "ids keep incrementing on the same day",
);
assert(nextId([{ id: "SB-MULTI-2026-11-10-9" }], when) === "SB-MULTI-2026-11-11-1", "a previous day's id does not collide");

function resolveSaveId(payloadId, existing) {
  return payloadId || nextId(existing, when);
}
assert(resolveSaveId("SB-MULTI-2026-11-11-1", [{ id: "SB-MULTI-2026-11-11-1" }]) === "SB-MULTI-2026-11-11-1", "editing keeps that multi's id");
assert(resolveSaveId(undefined, [{ id: "SB-MULTI-2026-11-11-1" }]) === "SB-MULTI-2026-11-11-2", "a reset form allocates a new id and does not overwrite");

console.log("john-multis: ok");
