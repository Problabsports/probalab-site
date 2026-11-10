// POST /api/checkout — create a Stripe Checkout Session in subscription mode.
// Preview testing stops at the session URL. Do not collect a live payment here.
import {
  currentOffer, findCustomerByEmail, isValidEmail, jsonResponse, normalizeEmail,
  priceForInterval, publicOrigin, randomSuffix, stripeRequest,
} from "../_shared/membership.js";

export async function onRequestPost(ctx) {
  const env = ctx.env || {};
  let body = {};
  try { body = await ctx.request.json(); } catch { body = {}; }
  const email = normalizeEmail(body.email);
  const interval = body.interval === "year" || body.interval === "yearly" ? "year" : "month";
  if (!isValidEmail(email)) return jsonResponse({ ok: false, error: "Please enter a valid email address." }, 400);

  try {
    const offer = await currentOffer(env);
    const price = priceForInterval(offer, interval);
    const origin = publicOrigin(ctx.request, env);

    const existing = await findCustomerByEmail(env, email);
    if (existing && existing.id) {
      const subs = await stripeRequest(env, "GET", "/subscriptions", {
        customer: existing.id,
        status: "all",
        limit: 20,
      });
      const active = (subs.data || []).find((s) => ["active", "trialing", "past_due", "paused"].includes(s.status));
      if (active) {
        return jsonResponse({
          ok: false,
          error: "This email already has a ProbaLab Members subscription. Sign in, or use Manage billing to update it.",
        }, 409);
      }
    }

    const params = {
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${origin}/members/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/join`,
      client_reference_id: email,
      metadata: {
        email,
        tier: offer.tier,
        interval,
        lookup_key: price.lookup_key,
        public_origin: origin,
      },
      subscription_data: {
        metadata: {
          email,
          tier: offer.tier,
          interval,
          lookup_key: price.lookup_key,
        },
      },
      custom_text: {
        submit: { message: "18+ only. Predictions are for entertainment, not advice. Gamble responsibly." },
      },
      billing_address_collection: "auto",
      allow_promotion_codes: false,
      integration_identifier: `probalab-join-${randomSuffix(8)}`,
    };
    if (existing && existing.id) params.customer = existing.id;
    else params.customer_email = email;

    const session = await stripeRequest(env, "POST", "/checkout/sessions", params);
    return jsonResponse({
      ok: true,
      url: session.url,
      id: session.id,
      tier: offer.tier,
      interval,
      price: price.label,
    });
  } catch (err) {
    console.log("checkout failed", err && err.message);
    return jsonResponse({ ok: false, error: "Could not start checkout. Please try again." }, 502);
  }
}

export async function onRequestGet() {
  return jsonResponse({ ok: false, error: "Use POST" }, 405);
}
