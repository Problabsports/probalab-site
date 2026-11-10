import {
  MEMBER_DESKS, OWNER_ONLY_DESKS, canonicalDeskId, isKnownDesk, isMemberDesk,
  isOwnerOnlyDesk, isHiddenSnapshotFile, isOwnerEmail, isOwnerAccount, canViewDesk, desksFor,
} from "../functions/_shared/members-desks.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }

assert(canonicalDeskId("nfl-totals") === "nfl-weather", "nfl-totals aliases nfl-weather");
assert(isKnownDesk("john") && isKnownDesk("NHL-Value") && isKnownDesk("nfl-totals"), "known desks");
assert(!isKnownDesk("edgebot") && !isKnownDesk(""), "unknown desks");
assert(isMemberDesk("probalab") && isMemberDesk("sniper") && isMemberDesk("john"), "member desks");
assert(!isMemberDesk("nhl-value") && !isMemberDesk("nba-price-gap") && !isMemberDesk("nfl-weather"), "paper desks are not member-visible");
assert(isOwnerOnlyDesk("nhl-value") && isOwnerOnlyDesk("nba-price-gap") && isOwnerOnlyDesk("nfl-totals"), "owner-only desks");
assert(isHiddenSnapshotFile("nhl-value.json") && isHiddenSnapshotFile("data/nba-price-gap.json"), "hidden snapshots");
assert(!isHiddenSnapshotFile("probalab.json") && !isHiddenSnapshotFile("sniper.json"), "member snapshots stay public");
assert(isOwnerEmail("jwcobley@gmail.com") && isOwnerEmail("  JwCobley@Gmail.com "), "owner email");
assert(!isOwnerEmail("member@example.com"), "other emails are not owner by default");
assert(isOwnerAccount("someone@example.com", "owner") && isOwnerAccount("a@b.com", "admin"), "owner/admin role");
assert(!isOwnerAccount("someone@example.com", "member"), "member role is not owner");
assert(canViewDesk("john", false) && canViewDesk("sniper", false) && canViewDesk("probalab", true), "members can view the three live desks");
assert(!canViewDesk("nhl-value", false) && !canViewDesk("nba-price-gap", false) && !canViewDesk("nfl-weather", false), "members cannot view hidden desks");
assert(canViewDesk("nhl-value", true) && canViewDesk("nfl-totals", true), "owner can view hidden desks");
assert(JSON.stringify(desksFor(false)) === JSON.stringify(MEMBER_DESKS), "member desk list");
assert(desksFor(true).length === MEMBER_DESKS.length + OWNER_ONLY_DESKS.length, "owner sees all desks");
assert(MEMBER_DESKS.length === 3 && OWNER_ONLY_DESKS.length === 3, "three visible, three hidden");
console.log("members-desks: ok");
