// Visibility for members tipster desks.
// Flip a desk from OWNER_ONLY_DESKS to MEMBER_DESKS to show it to members again.
export const MEMBER_DESKS = ["john", "probalab", "sniper"];
export const OWNER_ONLY_DESKS = ["nhl-value", "nba-price-gap", "nfl-weather"];
export const OWNER_EMAILS = ["jwcobley@gmail.com"];
export const HIDDEN_SNAPSHOT_FILES = ["nhl-value.json", "nba-price-gap.json", "nfl-weather.json"];
export const OWNER_COOKIE = "pl_owner_session";

export function canonicalDeskId(id) {
  const t = String(id || "").toLowerCase();
  return t === "nfl-totals" ? "nfl-weather" : t;
}

export function isKnownDesk(id) {
  const t = canonicalDeskId(id);
  return MEMBER_DESKS.includes(t) || OWNER_ONLY_DESKS.includes(t);
}

export function isOwnerOnlyDesk(id) {
  return OWNER_ONLY_DESKS.includes(canonicalDeskId(id));
}

export function isMemberDesk(id) {
  return MEMBER_DESKS.includes(canonicalDeskId(id));
}

export function isHiddenSnapshotFile(name) {
  const file = String(name || "").toLowerCase().split("/").pop();
  return HIDDEN_SNAPSHOT_FILES.includes(file);
}

export function isOwnerEmail(email) {
  return OWNER_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export function isOwnerAccount(email, role) {
  const r = String(role || "").trim().toLowerCase();
  return isOwnerEmail(email) || r === "owner" || r === "admin";
}

export function canViewDesk(id, isOwner) {
  const t = canonicalDeskId(id);
  if (isMemberDesk(t)) return true;
  return !!(isOwner && isOwnerOnlyDesk(t));
}

export function desksFor(isOwner) {
  return isOwner ? MEMBER_DESKS.concat(OWNER_ONLY_DESKS) : MEMBER_DESKS.slice();
}
