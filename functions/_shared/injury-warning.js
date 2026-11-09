// NBA injury warning badge: driven only by public feed fields injury_warning + injury_note.
// If those keys are absent, show nothing. Light colours are never changed here.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** @returns {{ note: string } | null} */
export function injuryOf(g) {
  if (!g || typeof g !== "object") return null;
  if (!Object.prototype.hasOwnProperty.call(g, "injury_warning")) return null;
  if (!g.injury_warning) return null;
  const note = g.injury_note == null ? "" : String(g.injury_note).trim();
  return { note: note || "Key players are uncertain." };
}

/** Small amber ⚠️ control; note rides in data-injury-note for the client popover. */
export function injuryBadge(g) {
  const info = injuryOf(g);
  if (!info) return "";
  return `<button type="button" class="injury-warn-btn" data-injury-note="${esc(info.note)}" aria-expanded="false" aria-label="Injury warning" title="Injury warning">⚠️</button>`;
}

/**
 * Preview-only demo: when the feed has not shipped injury_* keys yet, mark MEM@TOR
 * so the preview branch can be visually checked. Never runs once any game carries the key,
 * and never on production hostnames.
 */
export function applyInjuryPreviewDemo(games, hostname) {
  if (!Array.isArray(games) || !hostname) return;
  if (!/preview-injury-warning/i.test(hostname)) return;
  if (games.some((g) => g && Object.prototype.hasOwnProperty.call(g, "injury_warning"))) return;
  for (const g of games) {
    if (String(g?.game_id) !== "401909955") continue;
    g.injury_warning = true;
    g.injury_note = "Barnes, Quickley and Murray-Boyles are uncertain (GTD).";
  }
}
