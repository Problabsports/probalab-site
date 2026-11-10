import { createHmac } from "node:crypto";
import {
  FOUNDING_CAP, PRICES, countsTowardFoundingCap, foundingSlotsRemaining,
  offerFromUsedCount, nextMemberRole, shouldSendWelcomeTo, fillWelcomeEmail,
  encodeStripeParams, timingSafeEqual, verifyStripeSignature, isValidEmail,
  isProtectedRole, isOwnerEmail, priceForInterval, hexFromBuffer,
} from "../functions/_shared/membership.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }

assert(FOUNDING_CAP === 10, "founding cap is first 10, not 50");
assert(PRICES.pl_founding_monthly.id === "price_1Ua8YXJefFXwpgSuU20CcfKA", "founding monthly id");
assert(PRICES.pl_founding_yearly.unit_amount === 24000, "founding yearly amount");
assert(PRICES.pl_standard_monthly.label === "US$39/month", "standard monthly label");
assert(PRICES.pl_standard_yearly.label === "US$390/year", "standard yearly label");

for (let i = 0; i < 10; i++) {
  const o = offerFromUsedCount(i, 10);
  assert(o.foundingOpen && o.tier === "founding", "founding open at " + i);
  assert(o.foundingRemaining === 10 - i, "remaining at " + i);
  assert(priceForInterval(o, "month").lookup_key === "pl_founding_monthly", "monthly founding");
  assert(priceForInterval(o, "year").lookup_key === "pl_founding_yearly", "yearly founding");
}
const closed = offerFromUsedCount(10, 10);
assert(!closed.foundingOpen && closed.tier === "standard" && closed.foundingRemaining === 0, "cap reached");
assert(priceForInterval(closed, "month").lookup_key === "pl_standard_monthly", "standard monthly after cap");
assert(priceForInterval(closed, "year").lookup_key === "pl_standard_yearly", "standard yearly after cap");
assert(offerFromUsedCount(11, 10).tier === "standard", "over cap stays standard");
assert(foundingSlotsRemaining(0) === 10 && foundingSlotsRemaining(10) === 0, "slots");

assert(countsTowardFoundingCap({ status: "active", items: { data: [{ price: { id: PRICES.pl_founding_monthly.id } }] } }), "active founding counts");
assert(countsTowardFoundingCap({ status: "canceled", items: { data: [{ price: { lookup_key: "pl_founding_yearly" } }] } }), "canceled founding still counts");
assert(!countsTowardFoundingCap({ status: "incomplete", items: { data: [{ price: { id: PRICES.pl_founding_monthly.id } }] } }), "incomplete does not count");
assert(!countsTowardFoundingCap({ status: "active", items: { data: [{ price: { id: PRICES.pl_standard_monthly.id } }] } }), "standard does not count");

assert(nextMemberRole("owner", true) === "owner", "never demote owner on grant");
assert(nextMemberRole("admin", false) === "admin", "nextMemberRole keeps protected on revoke path");
assert(isProtectedRole("owner") && isProtectedRole("admin") && !isProtectedRole("member"), "protected roles");
assert(isOwnerEmail("jwcobley@gmail.com") && !isOwnerEmail("member@example.com"), "owner email");
assert(nextMemberRole(null, true) === "member", "new member role");
assert(nextMemberRole("member", false) == null, "revoke member");

assert(shouldSendWelcomeTo("jwcobley@gmail.com", "preview-members-checkout.probalab-site.pages.dev", {}), "preview can email John");
assert(!shouldSendWelcomeTo("someone@example.com", "preview-members-checkout.probalab-site.pages.dev", {}), "preview does not email others");
assert(shouldSendWelcomeTo("someone@example.com", "probalabsports.com", {}), "production can email the customer");
assert(!shouldSendWelcomeTo("someone@example.com", "probalabsports.com", { WELCOME_EMAIL_MODE: "test" }), "test mode stays on John");

const mail = fillWelcomeEmail({ price: "US$24/month", portalLink: "https://example.com/members/billing", founding: true });
assert(mail.subject === "You're in! Welcome to ProbaLab Members 🎉", "subject");
assert(mail.text.includes("You're now an official ProbaLab member 🎉"), "headline");
assert(mail.html.includes("You&#39;re now an official ProbaLab member 🎉"), "html headline");
assert(mail.text.includes("US$24/month"), "fills price");
assert(!mail.text.includes("US$24/month (US$24/month"), "no duplicated price");
assert(!mail.text.includes("US$24/month or US$240/year"), "no unused plan in founding copy");
assert(mail.text.includes("first 10 founding members"), "founding first 10");
assert(mail.text.includes("locked for life"), "locked for life");
assert(mail.text.includes("https://example.com/members/billing"), "fills portal");
assert(mail.text.includes("https://discord.gg/KPZ2BdfHuU"), "discord invite");
assert(mail.html.includes("https://discord.gg/KPZ2BdfHuU"), "html discord invite");
assert(mail.html.includes("https://probalabsports.com/icon-192.png"), "logo url");
assert(mail.html.includes(">Join Discord<"), "join discord button");
assert(mail.html.includes(">Open members desks<"), "open desks button");
assert(mail.text.includes("One last step: get your Discord access"), "discord access heading");
assert(mail.text.includes("(or DM @teamjwc)"), "discord handle");
assert(mail.text.includes("send a message in #questions (or DM @teamjwc)"), "questions channel");
assert(mail.html.includes("send a message in #questions (or DM @teamjwc)"), "html questions channel");
assert(mail.html.includes("Join our Discord, then send a message in #questions (or DM @teamjwc)"), "html discord box lead-in");
assert(!mail.html.includes(">Then send a message in #questions"), "html box does not start with Then");
assert(mail.text.includes("Join our Discord here:"), "plain text keeps separate join line");

assert(!mail.text.includes("send a message in #how-to"), "does not message in how-to");
assert(mail.text.includes("Start in #how-to. The pinned posts cover"), "how-to remains reading channel");
assert(mail.html.includes("Start in #how-to."), "html how-to remains reading channel");
assert(mail.html.includes("(or DM @teamjwc)"), "html discord handle");
assert(mail.html.includes("One last step: get your Discord access"), "html discord access heading");
assert(!mail.text.includes("DM @John"), "does not use @John handle");
assert(!mail.html.includes("DM @John"), "html does not use @John handle");
assert(mail.text.includes("John, ProbaLab, and Sniper"), "three desks");
assert(!mail.text.includes("first 50"), "no first-50 copy");
assert(!mail.text.includes("*"), "no asterisks");
assert(!mail.html.includes("*"), "no asterisks in html");
assert(mail.text.includes("no guaranteed winners"), "honest record line");
assert(mail.text.includes("18+"), "responsible gambling footer");
assert(!mail.text.includes("NHL Value") && !mail.text.includes("Price Gap") && !mail.text.includes("NFL Totals"), "no hidden desks");
const yearly = fillWelcomeEmail({ price: "US$240/year", portalLink: "https://example.com/members/billing", founding: true });
assert(yearly.text.includes("US$240/year") && !yearly.text.includes("US$24/month"), "yearly founding uses bought plan only");
const std = fillWelcomeEmail({ price: "US$39/month", portalLink: "https://x/billing", founding: false });
assert(std.text.includes("US$39/month") && !std.text.includes("founding member"), "standard variant");
assert(!std.text.includes("first 10") && !std.text.includes("locked for life"), "standard has no founding lock");
assert(std.subject === mail.subject && std.text.includes("You're now an official ProbaLab member 🎉"), "standard shares headline");

const encoded = encodeStripeParams({ line_items: [{ price: "price_123", quantity: 1 }], metadata: { tier: "founding" } });
assert(encoded.includes("line_items%5B0%5D%5Bprice%5D=price_123"), "encode line items");
assert(encoded.includes("metadata%5Btier%5D=founding"), "encode metadata");

assert(timingSafeEqual("abc", "abc") && !timingSafeEqual("abc", "abd") && !timingSafeEqual("abc", "ab"), "timing safe");
assert(isValidEmail("jwcobley@gmail.com") && !isValidEmail("nope") && !isValidEmail(""), "email");

const secret = "whsec_test_secret";
const payload = "{\"ok\":true}";
const t = "1700000000";
const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
// force timestamp by stubbing Date? verifyStripeSignature checks age.
// Call with a huge tolerance by passing toleranceSec large, but we need current ts.
const now = Math.floor(Date.now() / 1000);
const v1now = createHmac("sha256", secret).update(`${now}.${payload}`).digest("hex");
await verifyStripeSignature(payload, `t=${now},v1=${v1now}`, secret);
let threw = false;
try { await verifyStripeSignature(payload, `t=${now},v1=deadbeef`, secret); } catch { threw = true; }
assert(threw, "bad signature rejected");
// unused v1 from old timestamp kept only to prove hex length
assert(v1.length === 64, "hmac hex length");
assert(typeof hexFromBuffer(new Uint8Array([0, 15, 16]).buffer) === "string", "hexFromBuffer exported");

console.log("membership: ok");
