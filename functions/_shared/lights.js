// Lights: every cut-off, label, colour and range text the site shows comes from /lights.json (single source of truth).
// Browser scripts read the same data from /lights.js or /lights.mjs (generated: node tools/build_lights.mjs).
import LIGHTS_JSON from "../../lights.json" with { type: "json" };
import { makeLights } from "../../lights-core.mjs";

export const L = makeLights(LIGHTS_JSON);
export const LIGHTS = LIGHTS_JSON;
export const {
  order, label, labelLong, colour, emoji, gameSports, sportCfg, gameLight, shownLight, propsLight,
  rangeText, scaleText, keyText, greenSummary, orangeSummary, bestValueSports, bestValueMinP, bestValueText,
  propsText, isTip, pctText,
} = L;
