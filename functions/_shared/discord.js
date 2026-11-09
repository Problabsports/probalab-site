// Social CTAs: free Discord join + Follow @probalabsports on X.
// Set DISCORD_INVITE_URL to a non-expiring https://discord.gg/... or
// https://discord.com/invite/... link. Leave "" to hide Discord CTAs only.
// Never put webhook URLs here. X always links to ProbaLab Sports (never Closing Line).
export const DISCORD_INVITE_URL = "https://discord.gg/B8Q2hH26hV";
export const X_PROFILE_URL = "https://x.com/probalabsports";

const DISCORD_ICON = `<svg class="discord-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.11 13.11 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`;

const X_ICON = `<svg class="x-ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.851L1.99 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>`;

export function discordInviteConfigured() {
  const u = String(DISCORD_INVITE_URL || "").trim();
  if (!u) return false;
  if (/discord\.com\/api\/webhooks/i.test(u)) return false;
  return /^https?:\/\/(www\.)?(discord\.gg\/|discord\.com\/invite\/)/i.test(u);
}

function hrefAttr() {
  return String(DISCORD_INVITE_URL).trim().replace(/"/g, "&quot;");
}

function xHrefAttr() {
  return String(X_PROFILE_URL).trim().replace(/"/g, "&quot;");
}

/** Compact nav / drawer Discord link. */
export function discordNavLink() {
  if (!discordInviteConfigured()) return "";
  return `<a class="discord-cta discord-cta-nav" href="${hrefAttr()}" target="_blank" rel="noopener noreferrer">${DISCORD_ICON}<span>Join free Discord</span></a>`;
}

/** Compact nav X icon (desktop) / full label in drawer. */
export function xNavLink() {
  return `<a class="x-cta x-cta-nav" href="${xHrefAttr()}" target="_blank" rel="noopener noreferrer" aria-label="Follow @probalabsports on X">${X_ICON}<span class="x-cta-nav-label">Follow @probalabsports</span></a>`;
}

/** Home hero Discord chip. */
export function discordHeroCta() {
  if (!discordInviteConfigured()) return "";
  return `<a class="discord-cta discord-cta-hero" href="${hrefAttr()}" target="_blank" rel="noopener noreferrer">${DISCORD_ICON}<span class="discord-cta-text"><b>Join our free Discord</b><small>Tips drop in members channels</small></span></a>`;
}

/** Home hero X chip (directly under Discord). */
export function xHeroCta() {
  return `<a class="x-cta x-cta-hero" href="${xHrefAttr()}" target="_blank" rel="noopener noreferrer">${X_ICON}<span class="x-cta-text"><b>Follow @probalabsports on X</b><small>ProbaLab Sports only</small></span></a>`;
}

/** Footer Discord CTA. */
export function discordFooterCta() {
  if (!discordInviteConfigured()) return "";
  return `<a class="discord-cta discord-cta-footer" href="${hrefAttr()}" target="_blank" rel="noopener noreferrer">${DISCORD_ICON}<span><b>Join our free Discord</b> — tips in members channels</span></a>`;
}

/** Footer X CTA (directly under Discord). */
export function xFooterCta() {
  return `<a class="x-cta x-cta-footer" href="${xHrefAttr()}" target="_blank" rel="noopener noreferrer">${X_ICON}<span><b>Follow @probalabsports on X</b></span></a>`;
}

/** Hero stack: Discord then X. */
export function socialHeroStack() {
  const parts = [discordHeroCta(), xHeroCta()].filter(Boolean);
  return parts.length ? `<div class="social-cta-stack">${parts.join("")}</div>` : "";
}

/** Footer stack: Discord then X. */
export function socialFooterStack() {
  const parts = [discordFooterCta(), xFooterCta()].filter(Boolean);
  return parts.length ? `<div class="social-cta-stack social-footer">${parts.join("")}</div>` : "";
}
