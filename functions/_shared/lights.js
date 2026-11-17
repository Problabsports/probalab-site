// Lights: every cut-off, label, colour and range text the site shows comes from /lights.json (single source of truth),
// read here through /lights.mjs: generated from lights.json by tools/build_lights.mjs and checked by tests/lights.test.mjs
// (plain ESM, so every Pages build can bundle it; JSON import attributes are not supported by all builders).
import L, { data as LIGHTS_JSON } from "../../lights.mjs";

export { L };
export const LIGHTS = LIGHTS_JSON;
export const {
  order, label, labelLong, colour, emoji, gameSports, sportCfg, gameLight, shownLight, propsLight,
  rangeText, scaleText, keyText, greenSummary, orangeSummary, bestValueSports, bestValueMinP, bestValueText,
  propsText, isTip, pctText,
} = L;
