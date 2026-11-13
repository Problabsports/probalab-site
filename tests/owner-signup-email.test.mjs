import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FOUNDING_CAP, PRICES, ownerSignupAddress, shouldSendOwnerSignupEmail,
  formatAedtTime, describeMemberPlan, fillOwnerSignupEmail,
  notifyOwnerOfSignup, DEFAULT_OWNER_SIGNUP_EMAIL,
} from "../functions/_shared/membership.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }

const root = dirname(fileURLToPath(import.meta.url));
const webhook = readFileSync(join(root, "../functions/api/stripe-webhook.js"), "utf8");
const membership = readFileSync(join(root, "../functions/_shared/membership.js"), "utf8");

assert(DEFAULT_OWNER_SIGNUP_EMAIL === "jwcobley@gmail.com", "default owner address");
assert(ownerSignupAddress({}) === "jwcobley@gmail.com", "defaults without env");
assert(ownerSignupAddress({ OWNER_SIGNUP_EMAIL: " " }) === "jwcobley@gmail.com", "blank env falls back");
assert(ownerSignupAddress({ OWNER_SIGNUP_EMAIL: "John@ProbaLabSports.com" }) === "john@probalabsports.com", "env override is normalised");
assert(ownerSignupAddress({ OWNER_SIGNUP_EMAIL: "not-an-email" }) === "jwcobley@gmail.com", "invalid env falls back");

assert(shouldSendOwnerSignupEmail("probalabsports.com", {}), "send on production");
assert(shouldSendOwnerSignupEmail("www.probalabsports.com", {}), "send on www");
assert(!shouldSendOwnerSignupEmail("preview-owner-signup-email.probalab-site.pages.dev", {}), "no auto send on preview");
assert(!shouldSendOwnerSignupEmail("probalabsports.com", { OWNER_SIGNUP_EMAIL_MODE: "off" }), "mode off disables");
assert(!shouldSendOwnerSignupEmail("localhost", {}), "no send on localhost");

const signedUpAt = new Date("2026-11-11T19:10:56Z"); // 6:10am AEDT on 12 Nov
const when = formatAedtTime(signedUpAt);
assert(when.includes("12 Nov 2026"), "AEDT date: " + when);
assert(/6:10/.test(when), "AEDT time: " + when);
assert(when.includes("AEDT"), "zone labelled AEDT: " + when);
assert(!formatAedtTime("not-a-date"), "invalid date is empty");

assert(describeMemberPlan(PRICES.pl_founding_monthly) === "Founding monthly (US$24/month)", "founding monthly");
assert(describeMemberPlan(PRICES.pl_founding_yearly) === "Founding yearly (US$240/year)", "founding yearly");
assert(describeMemberPlan(PRICES.pl_standard_monthly) === "Standard monthly (US$39/month)", "standard monthly");
assert(describeMemberPlan(PRICES.pl_standard_yearly) === "Standard yearly (US$390/year)", "standard yearly");
assert(describeMemberPlan(null, true) === "Founding monthly (US$24/month)", "founding fallback");
assert(describeMemberPlan(null, false) === "Standard monthly (US$39/month)", "standard fallback");

const mail = fillOwnerSignupEmail({
  memberEmail: "New.Member@example.com",
  price: PRICES.pl_founding_yearly,
  founding: true,
  signedUpAt,
  foundingRemaining: 9,
});
assert(mail.subject === "Someone signed up as a ProbaLab member", "subject");
assert(!mail.subject.startsWith("[TEST]"), "live subject has no test prefix");
assert(mail.text.includes("Email: new.member@example.com"), "normalises member email");
assert(mail.text.includes("Plan: Founding yearly (US$240/year)"), "plan line");
assert(mail.text.includes("Time: ") && mail.text.includes("12 Nov 2026") && mail.text.includes("AEDT"), "time in AEDT");
assert(mail.text.includes("Founding spots left: 9 of 10"), "spots left of cap");
assert(FOUNDING_CAP === 10 && mail.text.includes("of 10"), "cap is 10");
assert(mail.text.includes("No Discord action needed") && mail.text.includes("Premium role automatically"), "discord role is automatic");
assert(!mail.text.includes("Give them the Discord Member role"), "no manual role step");
assert(!mail.text.includes("http") && !mail.text.toLowerCase().includes("telegram") && !mail.text.includes("webhook"), "plain, no extra channels");
assert(mail.html.includes("new.member@example.com"), "html has email");
assert(mail.html.includes("No Discord action needed"), "html discord line");

const testMail = fillOwnerSignupEmail({
  memberEmail: "new.member@example.com",
  price: PRICES.pl_standard_monthly,
  founding: false,
  signedUpAt,
  foundingRemaining: 0,
  test: true,
});
assert(testMail.subject === "[TEST] Someone signed up as a ProbaLab member", "test subject prefix");
assert(testMail.text.includes("Plan: Standard monthly (US$39/month)"), "standard plan");
assert(testMail.text.includes("Founding spots left: 0 of 10"), "zero spots after cap");

const missing = fillOwnerSignupEmail({ foundingRemaining: null, signedUpAt });
assert(missing.text.includes("Founding spots left: could not be counted (cap is 10)"), "count failure fallback");

// Fire-and-forget: a send failure must not throw.
const failed = await notifyOwnerOfSignup(
  { /* no RESEND_API_KEY */ },
  { memberEmail: "new.member@example.com", hostname: "probalabsports.com", signedUpAt, foundingRemaining: 9 },
);
assert(failed && failed.ok === false, "notify reports failure");
assert(typeof failed.error === "string" && failed.error.length > 0, "notify keeps an error message");

const skipped = await notifyOwnerOfSignup(
  {},
  { memberEmail: "new.member@example.com", hostname: "preview-owner-signup-email.probalab-site.pages.dev", signedUpAt },
);
assert(skipped && skipped.ok === true && skipped.skipped === "production-only", "preview webhook does not send");

assert(webhook.includes("notifyOwnerOfSignup"), "webhook calls owner notify");
assert(webhook.includes("idempotencyKey: `owner-signup-email/${session.id}`"), "once per checkout session id");
assert(webhook.includes("await sendWelcomeEmail"), "welcome email still sent");
const welcomeIdx = webhook.indexOf("await sendWelcomeEmail");
const ownerIdx = webhook.indexOf("await notifyOwnerOfSignup");
assert(welcomeIdx >= 0 && ownerIdx > welcomeIdx, "owner email is after welcome, so a welcome throw is already caught");
assert(membership.includes("Never throws: a failure must not break member access or the welcome email"), "notify is documented fire-and-forget");
assert(!webhook.toLowerCase().includes("telegram") && !webhook.includes("DISCORD_WEBHOOK"), "no discord or telegram alerts in webhook");

console.log("owner-signup-email: ok");
