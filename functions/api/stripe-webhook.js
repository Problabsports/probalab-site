// POST /api/stripe-webhook — grant or revoke members access from Stripe events.
import {
  PRICE_BY_ID, isSubscriptionAccessActive, jsonResponse, normalizeEmail,
  notifyOwnerOfSignup, publicOrigin, sendWelcomeEmail, setMemberAccess, stripeRequest,
  verifyStripeSignature,
} from "../_shared/membership.js";

async function customerEmail(env, object) {
  const direct = normalizeEmail(
    (object && object.customer_details && object.customer_details.email)
    || (object && object.customer_email)
    || (object && object.metadata && object.metadata.email)
    || "",
  );
  if (direct) return direct;
  const customerId = typeof object.customer === "string" ? object.customer : object.customer && object.customer.id;
  if (!customerId) return "";
  try {
    const customer = await stripeRequest(env, "GET", `/customers/${customerId}`);
    return normalizeEmail(customer.email);
  } catch (_) {
    return "";
  }
}

function priceInfoFromSession(session) {
  const items = (session.items && session.items.data)
    || (session.line_items && session.line_items.data)
    || [];
  for (const it of items) {
    const id = (it.price && it.price.id) || it.price;
    if (id && PRICE_BY_ID[id]) return PRICE_BY_ID[id];
  }
  const key = session.metadata && session.metadata.lookup_key;
  return (key && Object.values(PRICE_BY_ID).find((p) => p.lookup_key === key)) || null;
}

async function fulfillCheckout(env, session, hostname) {
  if (!session) return { skipped: "no-session" };
  const paymentOk = !session.payment_status || session.payment_status === "paid" || session.payment_status === "no_payment_required";
  if (session.mode === "subscription" && !paymentOk) return { skipped: "unpaid" };
  const email = await customerEmail(env, session);
  if (!email) return { skipped: "no-email" };
  const grant = await setMemberAccess(env, { email, grant: true });
  const price = priceInfoFromSession(session);
  const founding = (session.metadata && session.metadata.tier === "founding")
    || (price && price.tier === "founding");
  const origin = String((session.metadata && session.metadata.public_origin) || "") || "https://probalabsports.com";
  const portalLink = `${origin.replace(/\/$/, "")}/members/billing`;
  try {
    await sendWelcomeEmail(env, {
      to: email,
      price: price ? price.label : (founding ? "US$24/month" : "US$39/month"),
      portalLink,
      founding: !!founding,
      idempotencyKey: `welcome-email/${session.id}`,
      hostname,
    });
  } catch (err) {
    console.log("welcome email failed", err && err.message);
  }
  const createdSec = Number(session.created);
  const signedUpAt = createdSec > 1e12
    ? new Date(createdSec)
    : (createdSec > 0 ? new Date(createdSec * 1000) : new Date());
  // Fire-and-forget: failures are swallowed inside notifyOwnerOfSignup.
  await notifyOwnerOfSignup(env, {
    memberEmail: email,
    price,
    founding: !!founding,
    signedUpAt,
    idempotencyKey: `owner-signup-email/${session.id}`,
    hostname,
  });
  return { granted: grant, email };
}

async function syncSubscription(env, subscription) {
  const email = await customerEmail(env, subscription);
  if (!email) return { skipped: "no-email" };
  const grant = isSubscriptionAccessActive(subscription.status);
  return setMemberAccess(env, { email, grant });
}

export async function onRequestPost(ctx) {
  const env = ctx.env || {};
  const secret = env.STRIPE_WEBHOOK_SECRET;
  const payload = await ctx.request.text();
  const header = ctx.request.headers.get("stripe-signature") || "";
  try {
    await verifyStripeSignature(payload, header, secret);
  } catch (err) {
    console.log("webhook signature failed", err && err.message);
    return jsonResponse({ ok: false, error: "invalid signature" }, 400);
  }
  let event;
  try { event = JSON.parse(payload); } catch {
    return jsonResponse({ ok: false, error: "invalid json" }, 400);
  }
  const type = event.type;
  const object = event.data && event.data.object;
  let hostname = "";
  try { hostname = new URL(ctx.request.url).hostname; } catch (_) {}
  try {
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const sessionId = object && object.id;
      let session = object;
      if (sessionId) {
        try {
          session = await stripeRequest(env, "GET", `/checkout/sessions/${sessionId}`, {
            expand: ["line_items"],
          });
        } catch (_) { /* use payload object */ }
      }
      await fulfillCheckout(env, session, hostname);
    } else if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      await syncSubscription(env, object);
    }
    return jsonResponse({ ok: true, received: type });
  } catch (err) {
    console.log("webhook handler failed", type, err && err.message);
    return jsonResponse({ ok: false, error: "handler failed" }, 500);
  }
}
