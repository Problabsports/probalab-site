// GET /api/membership-offer — public founding/standard offer, no secrets.
import { currentOffer, jsonResponse, PRICES, FOUNDING_CAP } from "../_shared/membership.js";

export async function onRequestGet(ctx) {
  try {
    const offer = await currentOffer(ctx.env || {});
    return jsonResponse({
      ok: true,
      tier: offer.tier,
      foundingOpen: offer.foundingOpen,
      foundingCap: offer.foundingCap,
      foundingRemaining: offer.foundingRemaining,
      monthly: { lookup_key: offer.monthly.lookup_key, label: offer.monthly.label, unit_amount: offer.monthly.unit_amount },
      yearly: { lookup_key: offer.yearly.lookup_key, label: offer.yearly.label, unit_amount: offer.yearly.unit_amount },
    });
  } catch (err) {
    console.log("membership-offer failed", err && err.message);
    // Fail closed to founding copy only if Stripe is down? Safer to show founding structure without a live remaining count.
    const monthly = PRICES.pl_founding_monthly;
    const yearly = PRICES.pl_founding_yearly;
    return jsonResponse({
      ok: false,
      tier: "founding",
      foundingOpen: true,
      foundingCap: FOUNDING_CAP,
      foundingRemaining: null,
      monthly: { lookup_key: monthly.lookup_key, label: monthly.label, unit_amount: monthly.unit_amount },
      yearly: { lookup_key: yearly.lookup_key, label: yearly.label, unit_amount: yearly.unit_amount },
      error: "Could not refresh the remaining founding spots just now.",
    }, 200);
  }
}
